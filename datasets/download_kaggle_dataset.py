"""
ATMOSCHAIN — Kaggle Waste Image Dataset Downloader
download_kaggle_dataset.py

Downloads, extracts, cleans, and organises real waste images from Kaggle
into the project's waste_images_dataset/ folder structure expected by
ml_models/wastevision/dataset_loader.py.

Datasets used:
  1. TrashNet  — kaggle.com/datasets/asdasdasasdas/garbage-classification
     Classes   : cardboard | glass | metal | paper | plastic | trash
  2. Waste Classification v2 — kaggle.com/datasets/techsash/waste-classification-data
     Classes   : O (Organic) | R (Recyclable)

Final folder layout:
  datasets/waste_images_dataset/
    train / val / test /
      cardboard / glass / metal / organic / paper / plastic /

Prerequisites:
  pip install kaggle pillow tqdm
  Place kaggle.json at C:\\Users\\<you>\\.kaggle\\kaggle.json
  (Get it from https://www.kaggle.com/settings -> API -> Create New Token)

Usage:
  cd d:\\ATMOSCHAIN
  python datasets/download_kaggle_dataset.py

  # Skip re-download if ZIPs already present:
  python datasets/download_kaggle_dataset.py --skip-download

Author: ATMOSCHAIN Dev Team
"""

import argparse
import os
import random
import shutil
import sys
import zipfile
from pathlib import Path
from typing import Dict, List, Optional

# ─── Paths ────────────────────────────────────────────────────────────────────
DATASETS_DIR   = Path(__file__).parent
WASTE_IMG_DIR  = DATASETS_DIR / "waste_images_dataset"
TEMP_DIR       = DATASETS_DIR / "_kaggle_tmp"

# ─── ATMOSCHAIN target classes ────────────────────────────────────────────────
TARGET_CLASSES = ["cardboard", "glass", "metal", "organic", "paper", "plastic"]
SPLITS         = {"train": 0.70, "val": 0.20, "test": 0.10}
RANDOM_SEED    = 42

# ─── Kaggle dataset slugs ─────────────────────────────────────────────────────
KAGGLE_DATASETS = [
    "asdasdasasdas/garbage-classification",   # TrashNet
    "techsash/waste-classification-data",     # Waste Classification v2
]

# ─── Class name mapping (source folder name → ATMOSCHAIN class) ───────────────
# All comparisons are done in lowercase.
FOLDER_MAP = {
    # TrashNet classes
    "cardboard":   "cardboard",
    "glass":       "glass",
    "metal":       "metal",
    "paper":       "paper",
    "plastic":     "plastic",
    "trash":       None,          # ambiguous — skip

    # Waste Classification v2 classes
    "o":           "organic",     # top-level folder named "O"
    "organic":     "organic",
    "r":           None,          # "Recyclable" – handled via sub-inspection below
    "recyclable":  None,
}

# Sub-class words that appear in filenames or sub-folder names for "Recyclable"
# images — we map them to our classes where possible.
RECYCLABLE_SUBMAP = {
    "plastic":    "plastic",
    "glass":      "glass",
    "metal":      "metal",
    "paper":      "paper",
    "cardboard":  "cardboard",
    "tin":        "metal",
    "aluminium":  "metal",
    "aluminum":   "metal",
    "can":        "metal",
    "bottle":     "plastic",
}

VALID_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _check_kaggle_credentials():
    """
    Supports two Kaggle auth methods (checked in order):
      1. KAGGLE_API_TOKEN env var  — new token format (KGAT_...)
      2. ~/.kaggle/kaggle.json     — legacy username/key JSON
    """
    # Method 1: new API token via environment variable
    if os.environ.get("KAGGLE_API_TOKEN"):
        print("  ✓ Kaggle credentials: KAGGLE_API_TOKEN env var detected")
        return

    # Method 2: legacy kaggle.json
    kaggle_json = Path.home() / ".kaggle" / "kaggle.json"
    if kaggle_json.exists():
        print(f"  ✓ Kaggle credentials: kaggle.json found at {kaggle_json}")
        return

    # Neither found — print clear instructions for both approaches
    print("\n[ERROR] Kaggle credentials not found!")
    print()
    print("  Option A — New API Token (recommended):")
    print("    1. Go to https://www.kaggle.com/settings -> API -> 'Create New Token'")
    print("    2. Copy the token shown (starts with KGAT_...)")
    print("    3. In this terminal, run:")
    print("         set KAGGLE_API_TOKEN=KGAT_<your_token_here>     (Windows CMD)")
    print("         $env:KAGGLE_API_TOKEN='KGAT_<your_token>'       (PowerShell)")
    print()
    print("  Option B — Legacy kaggle.json:")
    print("    1. Go to https://www.kaggle.com/settings -> API -> 'Create New Token'")
    print("    2. Download kaggle.json and save it to:", kaggle_json)
    sys.exit(1)


def _check_kaggle_package():
    """Ensure the kaggle Python package is installed."""
    try:
        import kaggle  # noqa: F401
        print("  ✓ kaggle package is installed")
    except ImportError:
        print("[ERROR] The 'kaggle' package is not installed.")
        print("  Run:  pip install kaggle")
        sys.exit(1)


def _download_datasets(skip: bool):
    """Download all Kaggle datasets into TEMP_DIR."""
    TEMP_DIR.mkdir(parents=True, exist_ok=True)

    if skip:
        print("  [--skip-download] Skipping Kaggle download step.")
        return

    for slug in KAGGLE_DATASETS:
        name = slug.replace("/", "_")
        out_zip = TEMP_DIR / f"{name}.zip"
        if out_zip.exists():
            print(f"  ✓ Already downloaded: {out_zip.name} (delete to re-download)")
            continue

        print(f"  Downloading: {slug} …")
        ret = os.system(
            f'kaggle datasets download -d "{slug}" -p "{TEMP_DIR}" --quiet'
        )
        if ret != 0:
            print(f"[ERROR] Download failed for {slug}. Check slug & credentials.")
            sys.exit(1)
        print(f"  ✓ Downloaded: {out_zip.name}")


def _extract_datasets():
    """Extract all ZIPs in TEMP_DIR into their own sub-folders."""
    for zip_path in TEMP_DIR.glob("*.zip"):
        extract_dir = TEMP_DIR / zip_path.stem
        if extract_dir.exists():
            print(f"  ✓ Already extracted: {zip_path.name}")
            continue
        print(f"  Extracting {zip_path.name} …")
        with zipfile.ZipFile(zip_path, "r") as z:
            z.extractall(extract_dir)
        print(f"  ✓ Extracted to: {extract_dir}")


def _verify_image(path: Path) -> bool:
    """Return True if the image file is not corrupt and is a valid image."""
    try:
        from PIL import Image
        with Image.open(path) as img:
            img.verify()
        return True
    except Exception:
        return False


def _infer_recyclable_class(img_path: Path) -> Optional[str]:
    """
    Try to determine a specific ATMOSCHAIN class for a 'Recyclable' image
    by inspecting its filename and parent folder names.
    Returns None if it can't be determined.
    """
    text = " ".join([img_path.stem] + [p.name for p in img_path.parents[:4]]).lower()
    for keyword, cls in RECYCLABLE_SUBMAP.items():
        if keyword in text:
            return cls
    return None  # cannot determine — will be skipped


def _collect_images() -> Dict[str, List[Path]]:
    """
    Walk all extracted sub-folders, infer class from folder names,
    return {class_name: [list of valid image paths]}.
    """
    collected: Dict[str, List[Path]] = {c: [] for c in TARGET_CLASSES}
    skipped = 0
    corrupt = 0

    for extract_dir in TEMP_DIR.iterdir():
        if not extract_dir.is_dir() or extract_dir.suffix == ".zip":
            continue

        for img_path in extract_dir.rglob("*"):
            if not img_path.is_file():
                continue
            if img_path.suffix.lower() not in VALID_EXTENSIONS:
                continue

            # Walk up the parent folders to find the class folder
            target_class = None
            for parent in img_path.parents:
                folder_lower = parent.name.lower()
                if folder_lower in FOLDER_MAP:
                    mapped = FOLDER_MAP[folder_lower]
                    if mapped is None:
                        # Could be trash or recyclable
                        if folder_lower in ("r", "recyclable"):
                            target_class = _infer_recyclable_class(img_path)
                        # else trash → skip
                    else:
                        target_class = mapped
                    break

            if target_class is None:
                skipped += 1
                continue

            if not _verify_image(img_path):
                corrupt += 1
                continue

            collected[target_class].append(img_path)

    print(f"\n  Images collected per class:")
    for cls, imgs in collected.items():
        print(f"    {cls:12s}: {len(imgs):>5d} images")
    print(f"  Skipped (unmappable/trash): {skipped}")
    print(f"  Corrupt/unreadable:         {corrupt}")
    return collected


def _clean_existing_dataset():
    """Remove all existing content in waste_images_dataset/ (synthetic or old)."""
    if WASTE_IMG_DIR.exists():
        print(f"  Removing existing content from {WASTE_IMG_DIR} …")
        shutil.rmtree(WASTE_IMG_DIR)
    WASTE_IMG_DIR.mkdir(parents=True)

    # Create the full directory tree
    for split in SPLITS:
        for cls in TARGET_CLASSES:
            (WASTE_IMG_DIR / split / cls).mkdir(parents=True, exist_ok=True)
    print("  ✓ Clean directory tree created")


def _split_and_copy(collected: Dict[str, List[Path]]):
    """Split images per class into train/val/test and copy to destination."""
    rng = random.Random(RANDOM_SEED)
    total_copied = 0

    for cls, imgs in collected.items():
        if not imgs:
            print(f"  [WARN] No images for class '{cls}' — folder will be empty!")
            continue

        rng.shuffle(imgs)
        n = len(imgs)
        n_train = int(n * SPLITS["train"])
        n_val   = int(n * SPLITS["val"])

        split_groups = {
            "train": imgs[:n_train],
            "val":   imgs[n_train : n_train + n_val],
            "test":  imgs[n_train + n_val :],
        }

        for split, group in split_groups.items():
            dst_dir = WASTE_IMG_DIR / split / cls
            for i, src in enumerate(group):
                ext = src.suffix.lower()
                if ext == ".jpeg":
                    ext = ".jpg"
                dst = dst_dir / f"{cls}_{i+1:05d}{ext}"
                shutil.copy2(src, dst)
                total_copied += 1

        print(f"  {cls:12s}: {len(split_groups['train']):>4d} train | "
              f"{len(split_groups['val']):>4d} val | "
              f"{len(split_groups['test']):>4d} test")

    print(f"\n  ✓ Total images copied: {total_copied}")


def _print_final_summary():
    """Print a tidy summary of the final dataset layout."""
    print("\n" + "=" * 60)
    print("  FINAL DATASET SUMMARY")
    print("=" * 60)
    grand_total = 0
    for split in SPLITS:
        split_total = 0
        for cls in TARGET_CLASSES:
            count = len(list((WASTE_IMG_DIR / split / cls).glob("*")))
            split_total += count
        grand_total += split_total
        print(f"  {split:5s}: {split_total:>5d} images")
    print(f"  {'TOTAL':5s}: {grand_total:>5d} images")
    print("=" * 60)
    print(f"\n  Dataset path: {WASTE_IMG_DIR.resolve()}")
    print("\n  Ready to train! Run:")
    print("    python ml_models/wastevision/dataset_loader.py")
    print("    python ml_models/wastevision/train_classifier.py")


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Download & set up real Kaggle waste images for ATMOSCHAIN"
    )
    parser.add_argument(
        "--skip-download",
        action="store_true",
        help="Skip Kaggle download (use already-present ZIPs in _kaggle_tmp/)",
    )
    parser.add_argument(
        "--keep-tmp",
        action="store_true",
        help="Keep the _kaggle_tmp/ folder after completion (default: delete it)",
    )
    args = parser.parse_args()

    print("=" * 60)
    print("  ATMOSCHAIN — Kaggle Waste Image Dataset Setup")
    print("=" * 60)

    # 0. Pre-flight checks
    print("\n[0/5] Pre-flight checks …")
    _check_kaggle_package()
    _check_kaggle_credentials()

    # 1. Download
    print("\n[1/5] Downloading Kaggle datasets …")
    _download_datasets(skip=args.skip_download)

    # 2. Extract
    print("\n[2/5] Extracting ZIP files …")
    _extract_datasets()

    # 3. Collect & validate images
    print("\n[3/5] Scanning images and verifying integrity …")
    collected = _collect_images()

    # 4. Clean + rebuild directory tree
    print("\n[4/5] Cleaning existing dataset and building directory tree …")
    _clean_existing_dataset()

    # 5. Split and copy
    print("\n[5/5] Splitting and copying images …")
    _split_and_copy(collected)

    # Cleanup temp
    if not args.keep_tmp:
        print(f"\n  Removing temp folder {TEMP_DIR} …")
        shutil.rmtree(TEMP_DIR, ignore_errors=True)
        print("  ✓ Temp folder removed")

    _print_final_summary()


if __name__ == "__main__":
    main()
