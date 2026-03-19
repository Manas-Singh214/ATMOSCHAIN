# ATMOSCHAIN: Dataset Repository Links

## Quick Start — Real Kaggle Datasets (Recommended)

Use the automated download script to pull real waste images directly from Kaggle and set up the clean dataset in one command:

### Prerequisites

1. **Install dependencies:**
   ```bash
   pip install kaggle pillow tqdm
   ```

2. **Add your Kaggle API key:**
   - Go to [https://www.kaggle.com/settings](https://www.kaggle.com/settings) → **API** → **Create New Token**
   - Save the downloaded `kaggle.json` to:
     ```
     C:\Users\<YourName>\.kaggle\kaggle.json
     ```

### Download & Setup (One Command)

```bash
cd d:\ATMOSCHAIN
python datasets/download_kaggle_dataset.py
```

This script will:
1. Download both Kaggle datasets (see below)
2. Verify + discard any corrupt images
3. Map source class names → ATMOSCHAIN's 6-class schema
4. Split images **70% train / 20% val / 10% test** (reproducible seed)
5. Populate `datasets/waste_images_dataset/{train,val,test}/{class}/`
6. Clean up temp files automatically

If you have the ZIPs already downloaded, skip re-downloading:
```bash
python datasets/download_kaggle_dataset.py --skip-download
```

---

## Kaggle Datasets Used

### 1. TrashNet (Gary Thung) — *Gold Standard for Recyclables vs Trash*
- **Size:** ~2,527 images (6 classes: Cardboard, Glass, Metal, Paper, Plastic, Trash)
- **Kaggle:** [asdasdasasdas/garbage-classification](https://www.kaggle.com/datasets/asdasdasasdas/garbage-classification)
- **HuggingFace:** [garythung/trashnet](https://huggingface.co/datasets/garythung/trashnet)

### 2. Waste Classification v2 — *Includes Organics (Food/Garden)*
- **Size:** ~30,000 images (Organic vs. Recyclable — crucial for methane modelling!)
- **Kaggle:** [techsash/waste-classification-data](https://www.kaggle.com/datasets/techsash/waste-classification-data)

### Class Mapping

| Source Folder | ATMOSCHAIN Class |
|---|---|
| `cardboard` | `cardboard` |
| `glass` | `glass` |
| `metal` | `metal` |
| `paper` | `paper` |
| `plastic` | `plastic` |
| `O` / `Organic` | `organic` |
| `R` / `Recyclable` | inferred from filename, else skipped |
| `trash` | skipped (ambiguous) |

---

## Additional Real-World Datasets (Optional / Manual)

### Waste Garbage Management Dataset (10 classes)
- **Size:** ~19,762 images (Biological/Organic, Cardboard, Glass, Metal, etc.)
- **HuggingFace:** [omasteam/waste-garbage-management-dataset](https://huggingface.co/datasets/omasteam/waste-garbage-management-dataset)

### Waste Management & Recycling in Indian Cities
- **Contents:** Landfill operations, Daily Tons Generated, Disposal Methods across Indian cities
- **Kaggle:** [rajeshp13/waste-management-and-recycling-in-indian-cities](https://www.kaggle.com/datasets/rajeshp13/waste-management-and-recycling-in-indian-cities)

### Methane Emissions Around The World (1990–2018)
- **Contents:** Historical methane emissions from MSW by country and year
- **Kaggle:** [ruchi798/methane-emissions-around-the-world](https://www.kaggle.com/datasets/ruchi798/methane-emissions-around-the-world)

### EPA LandGEM Default Parameters Tool
- **Contents:** Official `k` and `L0` methane generation parameters for the IPCC model
- **Download:** [EPA CATC Software](https://www.epa.gov/catc/clean-air-technology-center-products#software)

---

## After Download — Verify & Train

```bash
# Verify dataset structure and image counts
python ml_models/wastevision/dataset_loader.py

# Begin training
python ml_models/wastevision/train_classifier.py
```

> **Note:** The project currently ships synthetic placeholder images so you can demo immediately. Running the download script replaces them with real photographic data.
