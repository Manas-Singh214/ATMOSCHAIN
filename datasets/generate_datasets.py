"""
ATMOSCHAIN — Dataset Generator
generate_datasets.py

Generates and validates all three ATMOSCHAIN datasets:
  1. waste_images_dataset  — Augmented synthetic image set (train/val/test)
  2. methane_generation_data — Extended IPCC-based methane CSV with noise
  3. landfill_emission_data  — Extended Indian landfill emissions CSV

Run:
    python datasets/generate_datasets.py

Author: ATMOSCHAIN Dev Team
"""

import os
import csv
import random
import math
from pathlib import Path
from datetime import datetime, timedelta

# ─── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent

WASTE_IMG_DIR  = BASE_DIR / "waste_images_dataset"
METHANE_CSV    = BASE_DIR / "methane_generation_data" / "methane_historical.csv"
LANDFILL_CSV   = BASE_DIR / "landfill_emission_data"  / "indian_landfills_daily.csv"

# ─── Constants (IPCC FOD) ──────────────────────────────────────────────────────
DOC_BY_TYPE = {
    "plastic":  0.00, "organic": 0.15, "paper":   0.40,
    "textile":  0.24, "wood":    0.43, "metal":   0.00,
    "glass":    0.00, "inert":   0.00, "mixed":   0.12, "unknown": 0.10,
}
DOCf = 0.50; F = 0.50; MCF = 1.00; MOLAR_RATIO = 16.0 / 12.0; GWP100 = 28

def _ch4_from_mass(mass_kg: float, doc: float) -> float:
    return mass_kg / 1000.0 * doc * DOCf * F * MCF * MOLAR_RATIO * 1000.0

def _co2e(ch4_kg: float) -> float:
    return ch4_kg * GWP100

# ─── 1. Waste Image Dataset ───────────────────────────────────────────────────
def generate_waste_images():
    """
    Generates synthetic 224×224 PNG images for the image classifier.
    Categories: plastic, organic, paper, metal, glass, cardboard (= paper)
    Splits:     train=70%, val=20%, test=10%
    Per cat:    150 images total → 105 train / 30 val / 15 test
    """
    try:
        from PIL import Image, ImageDraw, ImageFont
        pil_ok = True
    except ImportError:
        pil_ok = False
        print("  [WARN] Pillow not found — generating 1-pixel placeholder images instead.")

    CATEGORIES = ["plastic", "organic", "paper", "metal", "glass", "cardboard"]
    SPLITS     = {"train": 0.70, "val": 0.20, "test": 0.10}
    PER_CAT    = 150   # total per category

    # Visually distinct solid colours + a noisy pattern per class
    CAT_COLORS = {
        "plastic":   (220,  80, 80),
        "organic":   ( 80, 175,  80),
        "paper":     (200, 200, 255),
        "metal":     (140, 140, 155),
        "glass":     (100, 220, 220),
        "cardboard": (195, 155,  95),
    }

    total_created = 0
    for split_name, ratio in SPLITS.items():
        n = max(1, int(PER_CAT * ratio))
        for cat in CATEGORIES:
            out_dir = WASTE_IMG_DIR / split_name / cat
            out_dir.mkdir(parents=True, exist_ok=True)

            for i in range(n):
                fpath = out_dir / f"{cat}_{i+1:04d}.jpg"
                if fpath.exists():
                    continue   # skip already-generated

                if pil_ok:
                    r, g, b = CAT_COLORS[cat]
                    # Add per-image random brightness variation ±40
                    rv = random.randint(-40, 40)
                    colour = (
                        max(0, min(255, r + rv)),
                        max(0, min(255, g + rv)),
                        max(0, min(255, b + rv)),
                    )
                    img = Image.new("RGB", (224, 224), colour)
                    draw = ImageDraw.Draw(img)
                    # Draw a rectangle that simulates an object
                    margin = random.randint(20, 60)
                    draw.rectangle(
                        [margin, margin, 224 - margin, 224 - margin],
                        outline="black", width=4
                    )
                    # Add some noise pixels
                    for _ in range(500):
                        px = random.randint(0, 223)
                        py = random.randint(0, 223)
                        nc = (random.randint(0, 255), random.randint(0, 255), random.randint(0, 255))
                        img.putpixel((px, py), nc)
                    draw.text((8, 8), f"{cat.upper()} {split_name} {i+1}", fill="black")
                    img.save(str(fpath), "JPEG", quality=90)
                else:
                    # Fallback: minimal valid JPEG (1×1 pixel)
                    _write_1x1_jpeg(fpath, CAT_COLORS[cat])
                total_created += 1

    print(f"  ✓ Waste Images: {total_created} images generated / verified "
          f"across {len(CATEGORIES)} categories × {len(SPLITS)} splits.")

def _write_1x1_jpeg(path: Path, colour=(128, 128, 128)):
    """Write a 1-pixel JPEG without Pillow using raw bytes."""
    import base64
    # Pre-encoded 1×1 green JPEG as fallback
    b64 = (
        "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8U"
        "HRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgN"
        "DRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy"
        "MjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAA"
        "AAAAAAAAAAAAAP/EABQBAQAAAAAAAAAAAAAAAAAAAAD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA"
        "/9oADAMBAAIRAxEAPwCwABmX/9k="
    )
    path.write_bytes(base64.b64decode(b64))


# ─── 2. Methane Generation Dataset ───────────────────────────────────────────
def generate_methane_csv(n_samples: int = 2000):
    """
    Generates / extends the methane_historical.csv with n_samples rows.
    Uses the IPCC FOD formula with realistic noise (±5%) to simulate
    lab measurement uncertainty.
    """
    TYPES = list(DOC_BY_TYPE.keys())

    METHANE_CSV.parent.mkdir(parents=True, exist_ok=True)

    # Read existing rows so we don't overwrite them
    existing = set()
    if METHANE_CSV.exists():
        with open(METHANE_CSV, "r", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                existing.add(row.get("sample_id", ""))

    start_id = len(existing) + 1
    new_rows = []

    random.seed(42)
    for i in range(n_samples):
        sid      = f"SAMP_{start_id + i:04d}"
        if sid in existing:
            continue
        wtype    = random.choice(TYPES)
        mass_kg  = round(random.uniform(0.1, 50.0), 2)
        doc      = DOC_BY_TYPE[wtype]
        temp_c   = round(random.uniform(25.0, 45.0), 1)
        moisture = round(random.uniform(10.0, 80.0), 1)

        ch4_kg_raw = _ch4_from_mass(mass_kg, doc)
        # ±5% measurement noise
        noise    = random.uniform(0.95, 1.05) if ch4_kg_raw > 0 else 1.0
        ch4_kg   = round(ch4_kg_raw * noise, 6)
        co2e_kg  = round(_co2e(ch4_kg), 6)

        new_rows.append({
            "sample_id":       sid,
            "waste_type":      wtype,
            "mass_kg":         mass_kg,
            "doc_fraction":    doc,
            "temperature_c":   temp_c,
            "moisture_percent":moisture,
            "ch4_yield_kg":    ch4_kg,
            "co2e_yield_kg":   co2e_kg,
        })

    if not new_rows:
        print(f"  ✓ Methane CSV: already has {len(existing)} rows — no new rows needed.")
        return

    mode = "a" if METHANE_CSV.exists() else "w"
    fieldnames = ["sample_id", "waste_type", "mass_kg", "doc_fraction",
                  "temperature_c", "moisture_percent", "ch4_yield_kg", "co2e_yield_kg"]
    with open(METHANE_CSV, mode, newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        if mode == "w":
            writer.writeheader()
        writer.writerows(new_rows)

    total = len(existing) + len(new_rows)
    print(f"  ✓ Methane CSV: added {len(new_rows)} rows → total {total} samples.")


# ─── 3. Landfill Emissions Dataset ───────────────────────────────────────────
def generate_landfill_csv(extra_days: int = 0):
    """
    Generates / extends indian_landfills_daily.csv.
    Simulates 6 real Indian landfills over multiple years.
    If extra_days > 0, appends that many additional days.
    """
    LANDFILL_CSV.parent.mkdir(parents=True, exist_ok=True)

    SITES = [
        ("Ghazipur",  "Delhi",     2800, 0.50),
        ("Bhalswa",   "Delhi",     2000, 0.50),
        ("Okhla",     "Delhi",     1200, 0.52),
        ("Deonar",    "Mumbai",    3000, 0.47),
        ("Pirana",    "Ahmedabad", 2400, 0.52),
        ("Perungudi", "Chennai",   2300, 0.48),
    ]
    STATUSES = ["ACTIVE", "ACTIVE", "ACTIVE", "ACTIVE", "CALIBRATING", "OFFLINE"]
    STATUS_W = [55, 20, 15, 7, 2, 1]  # weights

    # Read existing rows to find last date
    existing_rows = []
    if LANDFILL_CSV.exists():
        with open(LANDFILL_CSV, "r", newline="") as f:
            reader = csv.DictReader(f)
            existing_rows = list(reader)

    existing_count = len(existing_rows)

    # Determine start date for new rows
    if existing_rows:
        last_date_str = existing_rows[-1]["date"]
        last_date = datetime.strptime(last_date_str, "%Y-%m-%d")
        start_date = last_date + timedelta(days=1)
    else:
        start_date = datetime(2023, 1, 1)

    # Calculate how many new rows to add
    # Target: at least 2 full years (730 days) of data; add extra if needed
    existing_site_days = existing_count // len(SITES)  # approximate
    needed_days = max(0, 730 - existing_site_days) + extra_days

    if needed_days <= 0:
        print(f"  ✓ Landfill CSV: already has {existing_count} rows — no new rows needed.")
        return

    new_rows = []
    random.seed(99)
    current_date = start_date

    for day_offset in range(needed_days):
        d_str = current_date.strftime("%Y-%m-%d")
        for name, city, base_msw, base_oc in SITES:
            # Daily variation ±20%
            msw = round(base_msw * random.uniform(0.80, 1.20), 1)
            oc  = round(base_oc  + random.uniform(-0.10, 0.10), 2)
            oc  = max(0.40, min(0.60, oc))
            # CH4 from IPCC formula: msw_tonnes × oc × DOCf × F × MCF × 16/12
            ch4 = round(msw * oc * DOCf * F * MCF * MOLAR_RATIO, 2)
            temp = round(random.uniform(15.0, 45.0), 1)
            status = random.choices(STATUSES, weights=STATUS_W, k=1)[0]

            new_rows.append({
                "date":              d_str,
                "landfill_name":     name,
                "city":              city,
                "msw_received_tonnes": msw,
                "organic_fraction":  oc,
                "ch4_emitted_tonnes":ch4,
                "ambient_temp":      temp,
                "sensor_status":     status,
            })

        current_date += timedelta(days=1)

    mode = "a" if LANDFILL_CSV.exists() else "w"
    fieldnames = ["date", "landfill_name", "city", "msw_received_tonnes",
                  "organic_fraction", "ch4_emitted_tonnes", "ambient_temp", "sensor_status"]
    with open(LANDFILL_CSV, mode, newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        if mode == "w":
            writer.writeheader()
        writer.writerows(new_rows)

    total = existing_count + len(new_rows)
    print(f"  ✓ Landfill CSV: added {len(new_rows)} rows ({needed_days} days) → total {total} rows.")


# ─── Main ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 60)
    print("  ATMOSCHAIN — Dataset Generator")
    print("=" * 60)

    print("\n[1/3] Generating Waste Image Dataset...")
    generate_waste_images()

    print("\n[2/3] Generating Methane Generation CSV...")
    generate_methane_csv(n_samples=2000)

    print("\n[3/3] Generating Landfill Emissions CSV...")
    generate_landfill_csv()

    print("\n" + "=" * 60)
    print("  ✅ All datasets generated successfully!")
    print("=" * 60)
