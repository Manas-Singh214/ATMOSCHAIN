"""
ATMOSCHAIN — WasteVision AI
dataset_loader.py

PyTorch Dataset and DataLoader wrappers for the waste_images_dataset.
Supports:
  - Train / Val / Test splits
  - Data augmentation (train only)
  - Class-to-index mapping matching ATMOSCHAIN WASTE_CLASSES
  - Optional oversampling for imbalanced datasets

Usage:
    from ml_models.wastevision.dataset_loader import get_dataloaders
    loaders = get_dataloaders(batch_size=32)

Author: ATMOSCHAIN Dev Team
"""

import os
from pathlib import Path
from typing import Dict, Tuple, Optional

import torch
from torch.utils.data import DataLoader, WeightedRandomSampler
from torchvision import datasets, transforms

# ─── Dataset root ─────────────────────────────────────────────────────────────
DATASET_ROOT = Path(__file__).parent.parent.parent / "datasets" / "waste_images_dataset"

# ─── ATMOSCHAIN canonical class labels ────────────────────────────────────────
# Map folder names → canonical ATMOSCHAIN waste classes
FOLDER_TO_CLASS = {
    "cardboard": "paper",      # cardboard is classified as paper in IPCC model
    "glass":     "glass",
    "metal":     "metal",
    "organic":   "organic",
    "paper":     "paper",
    "plastic":   "plastic",
    "textile":   "textile",
    "wood":      "wood",
    "inert":     "inert",
    "mixed":     "mixed",
}

# Final ordered class list (indices used by the model)
CLASSES = ["cardboard", "glass", "metal", "organic", "paper", "plastic"]

# Image size for ResNet
IMG_SIZE = 224


def _get_transforms(split: str) -> transforms.Compose:
    """
    Returns augmentation transforms for train, and normalization-only for val/test.
    Uses ImageNet stats for compatibility with torchvision pre-trained weights.
    """
    imagenet_mean = [0.485, 0.456, 0.406]
    imagenet_std  = [0.229, 0.224, 0.225]

    if split == "train":
        return transforms.Compose([
            transforms.Resize((IMG_SIZE + 32, IMG_SIZE + 32)),
            transforms.RandomCrop(IMG_SIZE),
            transforms.RandomHorizontalFlip(p=0.5),
            transforms.RandomVerticalFlip(p=0.2),
            transforms.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.2, hue=0.1),
            transforms.RandomRotation(15),
            transforms.ToTensor(),
            transforms.Normalize(mean=imagenet_mean, std=imagenet_std),
        ])
    else:
        return transforms.Compose([
            transforms.Resize((IMG_SIZE, IMG_SIZE)),
            transforms.ToTensor(),
            transforms.Normalize(mean=imagenet_mean, std=imagenet_std),
        ])


def get_dataset(split: str) -> datasets.ImageFolder:
    """
    Returns an ImageFolder dataset for the given split.

    Args:
        split: one of 'train', 'val', 'test'

    Returns:
        torchvision.datasets.ImageFolder
    """
    split_dir = DATASET_ROOT / split
    if not split_dir.exists():
        raise FileNotFoundError(
            f"Dataset split '{split}' not found at {split_dir}.\n"
            f"Run: python datasets/generate_datasets.py"
        )
    return datasets.ImageFolder(str(split_dir), transform=_get_transforms(split))


def get_class_weights(dataset: datasets.ImageFolder) -> torch.Tensor:
    """
    Computes per-class weights for WeightedRandomSampler to handle class imbalance.

    Returns:
        1-D tensor of per-sample weights.
    """
    class_counts = [0] * len(dataset.classes)
    for _, label in dataset.samples:
        class_counts[label] += 1

    total = sum(class_counts)
    class_weights = [total / (len(class_counts) * c) if c > 0 else 0.0 for c in class_counts]

    sample_weights = torch.tensor(
        [class_weights[label] for _, label in dataset.samples],
        dtype=torch.float
    )
    return sample_weights


def get_dataloaders(
    batch_size: int = 32,
    num_workers: int = 0,
    weighted_sampling: bool = True,
) -> Dict[str, DataLoader]:
    """
    Creates DataLoaders for all splits.

    Args:
        batch_size:         mini-batch size
        num_workers:        parallel data loading workers (0 = main thread, safe on Windows)
        weighted_sampling:  use WeightedRandomSampler for train to balance classes

    Returns:
        dict with keys 'train', 'val', 'test' → DataLoader
    """
    loaders = {}
    for split in ["train", "val", "test"]:
        ds = get_dataset(split)
        if split == "train" and weighted_sampling:
            weights = get_class_weights(ds)
            sampler = WeightedRandomSampler(
                weights, num_samples=len(weights), replacement=True
            )
            loader = DataLoader(
                ds,
                batch_size=batch_size,
                sampler=sampler,
                num_workers=num_workers,
                pin_memory=torch.cuda.is_available(),
            )
        else:
            loader = DataLoader(
                ds,
                batch_size=batch_size,
                shuffle=(split == "train"),
                num_workers=num_workers,
                pin_memory=torch.cuda.is_available(),
            )
        loaders[split] = loader

    return loaders


def get_dataset_info() -> Dict:
    """
    Returns a summary dict of dataset statistics.
    """
    info = {}
    for split in ["train", "val", "test"]:
        try:
            ds = get_dataset(split)
            info[split] = {
                "total_images": len(ds),
                "classes":      ds.classes,
                "class_to_idx": ds.class_to_idx,
            }
        except FileNotFoundError as e:
            info[split] = {"error": str(e)}
    return info


# ─── Standalone test ──────────────────────────────────────────────────────────
if __name__ == "__main__":
    import json
    print("=== Dataset Info ===")
    info = get_dataset_info()
    print(json.dumps(info, indent=2))

    print("\n=== DataLoader Test ===")
    loaders = get_dataloaders(batch_size=8)
    for split, loader in loaders.items():
        batch = next(iter(loader))
        images, labels = batch
        print(f"  {split}: images shape={images.shape}, labels={labels.tolist()}")
