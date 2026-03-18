"""
ATMOSCHAIN — WasteVision AI
train_classifier.py

Trains a ResNet-18 image classifier on the waste_images_dataset using
transfer learning. Saves the best checkpoint as wastevision_classifier.pth.

Features:
  - ResNet-18 backbone (pretrained on ImageNet)
  - Fine-tunes the final FC layer while freezing earlier layers first,
    then unfreezes for full fine-tuning (two-stage training)
  - Early stopping to prevent overfitting
  - Confusion matrix printed at end of training
  - Trained model saved for use in production pipeline

Usage:
    python ml_models/wastevision/train_classifier.py

Author: ATMOSCHAIN Dev Team
"""

import sys
import json
import time
from pathlib import Path

import torch
import torch.nn as nn
import torch.optim as optim
from torch.optim.lr_scheduler import CosineAnnealingLR

# ─── Fix import paths ─────────────────────────────────────────────────────────
ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ROOT))

from ml_models.wastevision.dataset_loader import get_dataloaders, get_dataset_info

# ─── Config ───────────────────────────────────────────────────────────────────
SAVE_PATH     = Path(__file__).parent / "wastevision_classifier.pth"
META_PATH     = Path(__file__).parent / "wastevision_classifier_meta.json"

# Training hyperparameters
BATCH_SIZE    = 32
EPOCHS_FROZEN = 5     # Train only the FC layer with backbone frozen
EPOCHS_FULL   = 15    # Full fine-tune with lower LR
LR_FROZEN     = 1e-3
LR_FULL       = 1e-4
WEIGHT_DECAY  = 1e-4
PATIENCE      = 5     # Early stopping patience (epochs)

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")


def build_model(num_classes: int) -> nn.Module:
    """
    Builds a ResNet-18 model with a custom head for num_classes.
    """
    try:
        from torchvision.models import resnet18, ResNet18_Weights
        model = resnet18(weights=ResNet18_Weights.IMAGENET1K_V1)
    except Exception:
        # Older torchvision fallback
        from torchvision.models import resnet18
        model = resnet18(pretrained=True)

    in_features = model.fc.in_features
    model.fc = nn.Sequential(
        nn.Dropout(p=0.4),
        nn.Linear(in_features, 256),
        nn.ReLU(inplace=True),
        nn.Dropout(p=0.3),
        nn.Linear(256, num_classes),
    )
    return model


def freeze_backbone(model: nn.Module):
    """Freeze all layers except the FC head."""
    for name, param in model.named_parameters():
        if "fc" not in name:
            param.requires_grad = False


def unfreeze_all(model: nn.Module):
    """Unfreeze all parameters for full fine-tuning."""
    for param in model.parameters():
        param.requires_grad = True


def train_one_epoch(model, loader, criterion, optimizer):
    model.train()
    total_loss, correct, total = 0.0, 0, 0

    for images, labels in loader:
        images, labels = images.to(DEVICE), labels.to(DEVICE)
        optimizer.zero_grad()
        outputs = model(images)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()

        total_loss += loss.item() * images.size(0)
        preds = outputs.argmax(dim=1)
        correct += (preds == labels).sum().item()
        total   += images.size(0)

    return total_loss / total, correct / total


@torch.no_grad()
def evaluate(model, loader, criterion):
    model.eval()
    total_loss, correct, total = 0.0, 0, 0

    for images, labels in loader:
        images, labels = images.to(DEVICE), labels.to(DEVICE)
        outputs = model(images)
        loss = criterion(outputs, labels)

        total_loss += loss.item() * images.size(0)
        preds = outputs.argmax(dim=1)
        correct += (preds == labels).sum().item()
        total   += images.size(0)

    return total_loss / total, correct / total


@torch.no_grad()
def confusion_matrix_report(model, loader, class_names):
    model.eval()
    n = len(class_names)
    cm = [[0] * n for _ in range(n)]

    for images, labels in loader:
        images, labels = images.to(DEVICE), labels.to(DEVICE)
        preds = model(images).argmax(dim=1)
        for t, p in zip(labels.cpu().tolist(), preds.cpu().tolist()):
            cm[t][p] += 1

    print("\n  Confusion Matrix (rows=actual, cols=predicted):")
    header = "         " + " ".join(f"{c[:7]:>8}" for c in class_names)
    print(header)
    for i, row in enumerate(cm):
        row_str = " ".join(f"{v:>8}" for v in row)
        print(f"  {class_names[i][:7]:>7}: {row_str}")

    # Per-class accuracy
    print("\n  Per-class accuracy:")
    for i, cls in enumerate(class_names):
        total_cls = sum(cm[i])
        acc = cm[i][i] / total_cls if total_cls > 0 else 0.0
        print(f"    {cls:<12}: {acc:.1%}")


def train():
    print("=" * 60)
    print("  ATMOSCHAIN — WasteVision Classifier Training")
    print(f"  Device: {DEVICE}")
    print("=" * 60)

    # 1. Load data
    print("\n[1] Loading datasets...")
    info = get_dataset_info()
    for split, d in info.items():
        if "error" not in d:
            print(f"  {split}: {d['total_images']} images | classes: {d['classes']}")
        else:
            print(f"  {split}: ERROR — {d['error']}")
            print("  → Run: python datasets/generate_datasets.py")
            return

    loaders = get_dataloaders(batch_size=BATCH_SIZE, num_workers=0, weighted_sampling=True)
    class_names = loaders["train"].dataset.classes
    num_classes = len(class_names)
    print(f"  Classes ({num_classes}): {class_names}")

    # 2. Build model
    print("\n[2] Building ResNet-18 model...")
    model = build_model(num_classes).to(DEVICE)
    criterion = nn.CrossEntropyLoss(label_smoothing=0.1)

    # 3. Phase 1: Train head only (backbone frozen)
    print(f"\n[3] Phase 1 — Training head only ({EPOCHS_FROZEN} epochs)...")
    freeze_backbone(model)
    optimizer = optim.Adam(filter(lambda p: p.requires_grad, model.parameters()),
                           lr=LR_FROZEN, weight_decay=WEIGHT_DECAY)
    scheduler = CosineAnnealingLR(optimizer, T_max=EPOCHS_FROZEN)

    best_val_acc = 0.0
    best_state   = None

    for epoch in range(1, EPOCHS_FROZEN + 1):
        t0 = time.time()
        tr_loss, tr_acc = train_one_epoch(model, loaders["train"], criterion, optimizer)
        vl_loss, vl_acc = evaluate(model, loaders["val"], criterion)
        scheduler.step()
        elapsed = time.time() - t0

        print(f"  Epoch {epoch:02d}/{EPOCHS_FROZEN} | "
              f"Train Loss={tr_loss:.4f} Acc={tr_acc:.2%} | "
              f"Val Loss={vl_loss:.4f} Acc={vl_acc:.2%} | "
              f"Time={elapsed:.1f}s")

        if vl_acc > best_val_acc:
            best_val_acc = vl_acc
            best_state   = {k: v.clone() for k, v in model.state_dict().items()}

    # 4. Phase 2: Full fine-tune
    print(f"\n[4] Phase 2 — Full fine-tuning ({EPOCHS_FULL} epochs, LR={LR_FULL})...")
    unfreeze_all(model)
    optimizer = optim.AdamW(model.parameters(), lr=LR_FULL, weight_decay=WEIGHT_DECAY)
    scheduler = CosineAnnealingLR(optimizer, T_max=EPOCHS_FULL, eta_min=1e-6)

    no_improve_count = 0
    history = []

    for epoch in range(1, EPOCHS_FULL + 1):
        t0 = time.time()
        tr_loss, tr_acc = train_one_epoch(model, loaders["train"], criterion, optimizer)
        vl_loss, vl_acc = evaluate(model, loaders["val"], criterion)
        scheduler.step()
        elapsed = time.time() - t0

        print(f"  Epoch {epoch:02d}/{EPOCHS_FULL} | "
              f"Train Loss={tr_loss:.4f} Acc={tr_acc:.2%} | "
              f"Val Loss={vl_loss:.4f} Acc={vl_acc:.2%} | "
              f"Time={elapsed:.1f}s")

        history.append({
            "epoch": epoch, "train_loss": round(tr_loss, 4),
            "train_acc": round(tr_acc, 4),
            "val_loss": round(vl_loss, 4), "val_acc": round(vl_acc, 4)
        })

        if vl_acc > best_val_acc:
            best_val_acc = vl_acc
            best_state   = {k: v.clone() for k, v in model.state_dict().items()}
            no_improve_count = 0
            print(f"    ★ New best val acc: {best_val_acc:.2%}")
        else:
            no_improve_count += 1
            if no_improve_count >= PATIENCE:
                print(f"  ⚡ Early stopping at epoch {epoch} (no improvement for {PATIENCE} epochs).")
                break

    # 5. Load best model and evaluate on test set
    print(f"\n[5] Best val accuracy: {best_val_acc:.2%}")
    if best_state:
        model.load_state_dict(best_state)

    print("\n  Test Set Evaluation:")
    te_loss, te_acc = evaluate(model, loaders["test"], criterion)
    print(f"  Test Loss={te_loss:.4f} | Test Acc={te_acc:.2%}")

    confusion_matrix_report(model, loaders["test"], class_names)

    # 6. Save model
    print(f"\n[6] Saving model to {SAVE_PATH} ...")
    torch.save({
        "model_state_dict": model.state_dict(),
        "class_names":      class_names,
        "num_classes":      num_classes,
        "best_val_acc":     best_val_acc,
        "test_acc":         te_acc,
        "architecture":     "resnet18",
    }, str(SAVE_PATH))

    # Save metadata
    meta = {
        "architecture":  "ResNet-18",
        "num_classes":   num_classes,
        "class_names":   class_names,
        "best_val_acc":  round(best_val_acc, 4),
        "test_acc":      round(te_acc, 4),
        "img_size":      224,
        "training_history": history,
        "device":        str(DEVICE),
        "description":   "ResNet-18 transfer learning on ATMOSCHAIN waste images dataset"
    }
    META_PATH.write_text(json.dumps(meta, indent=2))
    print(f"  Metadata saved to {META_PATH}")

    print("\n" + "=" * 60)
    print(f"  ✅ Training complete! Test Acc: {te_acc:.2%}")
    print("=" * 60)


if __name__ == "__main__":
    train()
