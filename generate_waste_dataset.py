"""
ATMOSCHAIN — RealWaste Dataset Generator
=========================================
Scans every image in realwaste-main/RealWaste/<Category>/*.jpg,
computes methane and energy metrics per-image (assuming a default
unit mass per waste type), and writes:

  waste_dataset/
    dataset.csv         — one row per image, all fields
    metadata.json       — schema + category summary stats
    dataset_info.txt    — human-readable description
"""

import os
import csv
import json
import math
from pathlib import Path

# ── Path Configuration ─────────────────────────────────────────────────────────
BASE_DIR       = Path(__file__).parent
SOURCE_DIR     = BASE_DIR / "realwaste-main" / "RealWaste"
OUTPUT_DIR     = BASE_DIR / "waste_dataset"
CSV_PATH       = OUTPUT_DIR / "dataset.csv"
JSON_PATH      = OUTPUT_DIR / "metadata.json"
INFO_PATH      = OUTPUT_DIR / "dataset_info.txt"

# ── Methane Factors (IPCC FOD — consistent with ATMOSCHAIN backend) ────────────
# factor = kg CH4 produced per kg of waste (anaerobic landfill conditions)
# mass_kg = estimated typical unit mass per photo item for that category
GWP_CH4 = 28   # IPCC AR6 GWP100 for methane

WASTE_METADATA = {
    "Cardboard": {
        "factor":         0.080,             # kg CH4 / kg waste
        "mass_kg":        0.50,              # estimated mass of one item in photo
        "color":          "#8d6e63",
        "description":    "Corrugated cardboard boxes, packaging material",
        "degradable":     True,
        "landfill_class": "Slow-degrading organic",
        "doc_fraction":   0.40,              # Degradable Organic Carbon fraction
    },
    "Food Organics": {
        "factor":         0.138,
        "mass_kg":        0.20,
        "color":          "#ff7043",
        "description":    "Kitchen scraps, food leftovers, organic waste",
        "degradable":     True,
        "landfill_class": "Fast-degrading organic",
        "doc_fraction":   0.15,
    },
    "Glass": {
        "factor":         0.000,
        "mass_kg":        0.30,
        "color":          "#26c6da",
        "description":    "Glass bottles, jars, broken glass",
        "degradable":     False,
        "landfill_class": "Inert",
        "doc_fraction":   0.00,
    },
    "Metal": {
        "factor":         0.000,
        "mass_kg":        0.40,
        "color":          "#bdbdbd",
        "description":    "Cans, scrap metal, aluminium, steel",
        "degradable":     False,
        "landfill_class": "Inert",
        "doc_fraction":   0.00,
    },
    "Miscellaneous Trash": {
        "factor":         0.030,
        "mass_kg":        0.15,
        "color":          "#ffa726",
        "description":    "General mixed waste, multi-material refuse",
        "degradable":     True,
        "landfill_class": "Mixed organic/inert",
        "doc_fraction":   0.10,
    },
    "Paper": {
        "factor":         0.075,
        "mass_kg":        0.05,
        "color":          "#90a4ae",
        "description":    "Newspapers, office paper, magazines",
        "degradable":     True,
        "landfill_class": "Slow-degrading organic",
        "doc_fraction":   0.40,
    },
    "Plastic": {
        "factor":         0.000,
        "mass_kg":        0.02,
        "color":          "#42a5f5",
        "description":    "PET, HDPE, LDPE packaging, bags, bottles",
        "degradable":     False,
        "landfill_class": "Persistent / Inert",
        "doc_fraction":   0.00,
    },
    "Textile Trash": {
        "factor":         0.060,
        "mass_kg":        0.15,
        "color":          "#ab47bc",
        "description":    "Clothing fabric scraps, old garments",
        "degradable":     True,
        "landfill_class": "Slow-degrading organic",
        "doc_fraction":   0.20,
    },
    "Vegetation": {
        "factor":         0.040,
        "mass_kg":        0.30,
        "color":          "#66bb6a",
        "description":    "Leaves, grass clippings, garden trimmings",
        "degradable":     True,
        "landfill_class": "Fast-degrading organic",
        "doc_fraction":   0.20,
    },
}

CSV_FIELDS = [
    "filename",
    "category",
    "description",
    "degradable",
    "landfill_class",
    "doc_fraction",
    "estimated_mass_kg",
    "methane_factor_kg_per_kg",
    "ch4_kg",
    "co2e_kg",
    "energy_kwh",
    "carbon_credits",
    "hex_color",
    "relative_path",
]


def compute_metrics(category: str, meta: dict) -> dict:
    """Return per-image numeric predictions for a given waste category."""
    mass   = meta["mass_kg"]
    factor = meta["factor"]
    ch4    = round(mass * factor, 6)
    co2e   = round(ch4 * GWP_CH4, 6)
    energy = round(ch4 * 13.9, 6)   # kWh — same as backend
    creds  = round(co2e / 1000, 8)  # 1 carbon credit = 1 tonne CO2e
    return {
        "estimated_mass_kg":         mass,
        "methane_factor_kg_per_kg":  factor,
        "ch4_kg":                    ch4,
        "co2e_kg":                   co2e,
        "energy_kwh":                energy,
        "carbon_credits":            creds,
    }


def build_dataset():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    rows          = []
    category_stats = {}

    # Walk every category sub-folder
    for category_dir in sorted(SOURCE_DIR.iterdir()):
        if not category_dir.is_dir():
            continue
        cat_name = category_dir.name
        meta     = WASTE_METADATA.get(cat_name)
        if meta is None:
            print(f"  [WARN] Unknown category '{cat_name}', skipping.")
            continue

        images = sorted(
            [f for f in category_dir.iterdir()
             if f.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}]
        )
        print(f"  Processing '{cat_name}': {len(images)} images …")

        metrics = compute_metrics(cat_name, meta)

        cat_total_ch4  = 0
        cat_total_co2e = 0
        cat_total_kwh  = 0

        for img in images:
            rel_path = f"RealWaste/{cat_name}/{img.name}"
            row = {
                "filename":                  img.name,
                "category":                  cat_name,
                "description":               meta["description"],
                "degradable":                meta["degradable"],
                "landfill_class":            meta["landfill_class"],
                "doc_fraction":              meta["doc_fraction"],
                "hex_color":                 meta["color"],
                "relative_path":             rel_path,
            }
            row.update(metrics)
            rows.append(row)

            cat_total_ch4  += metrics["ch4_kg"]
            cat_total_co2e += metrics["co2e_kg"]
            cat_total_kwh  += metrics["energy_kwh"]

        category_stats[cat_name] = {
            "image_count":          len(images),
            "description":          meta["description"],
            "degradable":           meta["degradable"],
            "landfill_class":       meta["landfill_class"],
            "doc_fraction":         meta["doc_fraction"],
            "estimated_mass_kg":    meta["mass_kg"],
            "methane_factor":       meta["factor"],
            "total_ch4_kg":         round(cat_total_ch4, 4),
            "total_co2e_kg":        round(cat_total_co2e, 4),
            "total_energy_kwh":     round(cat_total_kwh, 4),
            "total_carbon_credits": round(cat_total_co2e / 1000, 6),
            "color":                meta["color"],
        }

    # ── Write CSV ──────────────────────────────────────────────────────────────
    with open(CSV_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    print(f"\n  ✔  CSV saved  → {CSV_PATH}  ({len(rows)} rows)")

    # ── Write metadata JSON ────────────────────────────────────────────────────
    total_images = sum(s["image_count"] for s in category_stats.values())
    grand_ch4    = sum(s["total_ch4_kg"]    for s in category_stats.values())
    grand_co2e   = sum(s["total_co2e_kg"]   for s in category_stats.values())
    grand_energy = sum(s["total_energy_kwh"] for s in category_stats.values())

    metadata = {
        "dataset_name":      "ATMOSCHAIN RealWaste Image Dataset",
        "version":           "1.0",
        "source":            "realwaste-main/RealWaste (RealWaste: A Novel Real-Life Data Set for Landfill Waste Classification)",
        "license":           "CC BY-NC-SA 4.0",
        "schema_version":    "2026-03-27",
        "gwp_ch4":           GWP_CH4,
        "energy_factor":     13.9,
        "columns": {
            "filename":                 "Image file name (e.g. Cardboard_1.jpg)",
            "category":                 "Waste category label",
            "description":              "Human-readable description of waste type",
            "degradable":               "Whether waste is biodegradable (bool)",
            "landfill_class":           "Landfill degradation classification",
            "doc_fraction":             "Degradable Organic Carbon fraction (IPCC)",
            "estimated_mass_kg":        "Typical mass of one item in photo (kg)",
            "methane_factor_kg_per_kg": "CH4 yield per kg waste (IPCC FOD)",
            "ch4_kg":                   "Predicted CH4 produced per item (kg)",
            "co2e_kg":                  "CO2-equivalent (ch4_kg × GWP28)",
            "energy_kwh":               "Energy recoverable via plasma reactor (kWh)",
            "carbon_credits":           "Carbon credits earned (1 credit = 1 tonne CO2e)",
            "hex_color":                "UI theme color for this category",
            "relative_path":            "Path relative to realwaste-main/",
        },
        "summary": {
            "total_images":       total_images,
            "total_categories":   len(category_stats),
            "grand_total_ch4_kg": round(grand_ch4, 4),
            "grand_total_co2e_kg":round(grand_co2e, 4),
            "grand_energy_kwh":   round(grand_energy, 4),
        },
        "categories": category_stats,
    }

    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    print(f"  ✔  JSON saved → {JSON_PATH}")

    # ── Write human-readable info ──────────────────────────────────────────────
    lines = [
        "=" * 70,
        "  ATMOSCHAIN — RealWaste Annotated Image Dataset  v1.0",
        "=" * 70,
        "",
        "SOURCE  : realwaste-main/RealWaste/",
        "LICENSE : CC BY-NC-SA 4.0",
        "GWP CH4 : 28 (IPCC AR6 GWP100)",
        "",
        f"TOTAL IMAGES  : {total_images}",
        f"CATEGORIES    : {len(category_stats)}",
        f"GRAND CH4     : {round(grand_ch4,4)} kg",
        f"GRAND CO2e    : {round(grand_co2e,4)} kg",
        f"GRAND ENERGY  : {round(grand_energy,4)} kWh",
        "",
        "-" * 70,
        f"{'Category':<22} {'Images':>7} {'Mass(kg)':>9} {'Factor':>8} {'CH4(kg)':>9} {'CO2e(kg)':>10} {'kWh':>9}",
        "-" * 70,
    ]
    for cat, s in category_stats.items():
        lines.append(
            f"{cat:<22} {s['image_count']:>7} {s['estimated_mass_kg']:>9.3f} "
            f"{s['methane_factor']:>8.3f} {s['total_ch4_kg']:>9.4f} "
            f"{s['total_co2e_kg']:>10.4f} {s['total_energy_kwh']:>9.4f}"
        )
    lines += [
        "-" * 70,
        "",
        "FILES",
        "  dataset.csv    — row per image with all computed fields",
        "  metadata.json  — full schema, category summaries, methodology",
        "  dataset_info.txt — this file",
        "",
        "HOW METRICS ARE COMPUTED",
        "  ch4_kg         = estimated_mass_kg × methane_factor",
        "  co2e_kg        = ch4_kg × 28  (IPCC GWP100)",
        "  energy_kwh     = ch4_kg × 13.9  (plasma reactor conversion)",
        "  carbon_credits = co2e_kg / 1000  (1 credit = 1 tonne CO2e)",
        "",
        "NOTE: Methane factors from IPCC First-Order Decay (FOD) model.",
        "Plastic & Glass & Metal produce ZERO methane (non-biodegradable).",
    ]

    with open(INFO_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"  ✔  Info saved → {INFO_PATH}")
    print(f"\n  Dataset generation complete!  Output folder: {OUTPUT_DIR}")
    print("\n" + "\n".join(lines))


if __name__ == "__main__":
    print(f"\nScanning source folder: {SOURCE_DIR}\n")
    build_dataset()
