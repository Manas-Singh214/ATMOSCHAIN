# ATMOSCHAIN: Dataset Repository Links

The current directory contains high-quality **synthetic datasets** generated specifically to match the IPCC First-Order Decay model and your `methane_prediction.py` parameters. These are ready for testing the application right now.

If you want the **exact, massive real-world datasets** for your final project deployment, you must download them using Kaggle or HuggingFace credentials because these platforms require authentication and the files are multiple gigabytes in size. 

Below are the exact direct links and commands for the datasets that perfectly align with this project:

---

## 1. WasteVision AI Image Datasets (Waste Images)

### **A. TrashNet (Gary Thung)** - *Gold Standard for Recyclables vs Trash*
- **Size:** ~2,527 high-quality images (Cardboard, Glass, Metal, Paper, Plastic, Trash).
- **Kaggle Link:** [https://www.kaggle.com/datasets/asdasdasasdas/garbage-classification](https://www.kaggle.com/datasets/asdasdasasdas/garbage-classification)
- **HuggingFace Link:** [https://huggingface.co/datasets/garythung/trashnet](https://huggingface.co/datasets/garythung/trashnet)

### **B. Waste Classification v2** - *Includes Organics (Food/Garden)*
- **Size:** ~30,000 images (Organic vs. Recyclable). Crucial for calculating methane!.
- **Kaggle Link:** [https://www.kaggle.com/datasets/techsash/waste-classification-data](https://www.kaggle.com/datasets/techsash/waste-classification-data)

### **C. Waste Garbage Management Dataset (10 classes)**
- **Size:** ~19,762 images (Biological/Organic, Cardboard, Glass, Metal, etc.).
- **HuggingFace Link:** [https://huggingface.co/datasets/omasteam/waste-garbage-management-dataset](https://huggingface.co/datasets/omasteam/waste-garbage-management-dataset)

---

## 2. Landfill Emissions & MSW Data

### **A. Waste Management and Recycling in Indian Cities**
- **Contents:** Exact dataset showing Landfill operations, Daily Tons Generated, and Disposal Methods across Indian cities.
- **Kaggle Link:** [https://www.kaggle.com/datasets/rajeshp13/waste-management-and-recycling-in-indian-cities](https://www.kaggle.com/datasets/rajeshp13/waste-management-and-recycling-in-indian-cities)

### **B. Methane Emissions Around The World (1990-2018)**
- **Contents:** Historical CSV on methane emissions from MSW (Municipal Solid Waste) sorted by country and year.
- **Kaggle Link:** [https://www.kaggle.com/datasets/ruchi798/methane-emissions-around-the-world](https://www.kaggle.com/datasets/ruchi798/methane-emissions-around-the-world)

### **C. EPA LandGEM Default Parameters Tool**
- **Contents:** The exact "k" and "L0" methane generation parameters mapping to the IPCC model, inside the EPA's official Excel model tool.
- **Download Link:** [https://www.epa.gov/catc/clean-air-technology-center-products#software](https://www.epa.gov/catc/clean-air-technology-center-products#software)

---

### How to use these in your project:
1. Create Kaggle/HuggingFace accounts.
2. Download the ZIP file locally.
3. Extract the contents directly into their respective folders (`datasets/waste_images_dataset`, etc.).
4. The system is currently pointing to the **synthetic files** generated inside these folders so you can demo immediately.
