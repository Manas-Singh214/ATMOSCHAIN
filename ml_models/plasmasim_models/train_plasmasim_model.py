"""
ATMOSCHAIN — PlasmaSim Models
train_plasmasim_model.py

Trains scikit-learn models for plasma gasification outputs:
  1. energy_model.pkl  — predicts electricity_kwh and heat_kwh from waste input
  2. gas_model.pkl     — predicts syngas composition fractions

Dataset: Generated from physics-based empirical data + noise.
Model:   Gradient Boosting Regressor (MultiOutput support via wrapper)

Usage:
    python ml_models/plasmasim_models/train_plasmasim_model.py

Author: ATMOSCHAIN Dev Team
"""

import sys
import json
import pickle
import random
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.multioutput import MultiOutputRegressor
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score

# ─── Paths ────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ROOT))

MODEL_DIR      = Path(__file__).parent
ENERGY_MODEL   = MODEL_DIR / "energy_model.pkl"
GAS_MODEL      = MODEL_DIR / "gas_model.pkl"
META_PATH      = MODEL_DIR / "plasmasim_model_meta.json"

# ─── Physics-based empirical tables ───────────────────────────────────────────
# From gas_yield_predictor.py and energy_prediction.py (ground truth)
NET_KWH_PER_TONNE = {
    "plastic":  750, "organic":  380, "paper":   500,
    "textile":  580, "wood":     620, "metal":    50,
    "glass":     30, "inert":     20, "mixed":   600, "unknown": 500,
}
THERMAL_MWH_PER_TONNE = {
    "plastic": 1.8, "organic": 0.9, "paper":  1.2,
    "textile": 1.4, "wood":    1.5, "metal":  0.1,
    "glass":   0.1, "inert":   0.1, "mixed":  1.4, "unknown": 1.2,
}
GAS_COMPOSITION_DB = {
    "plastic" : [35.0, 32.0, 14.0, 12.0,  5.0, 2.0],
    "organic" : [28.0, 30.0, 22.0,  5.0, 13.0, 2.0],
    "paper"   : [31.0, 29.0, 18.0,  7.0, 13.0, 2.0],
    "textile" : [30.0, 28.0, 17.0,  8.0, 15.0, 2.0],
    "wood"    : [33.0, 31.0, 16.0,  8.0, 10.0, 2.0],
    "metal"   : [ 5.0,  3.0,  5.0,  1.0, 82.0, 4.0],
    "glass"   : [ 2.0,  2.0,  8.0,  0.0, 84.0, 4.0],
    "inert"   : [ 1.0,  1.0,  5.0,  0.0, 89.0, 4.0],
    "mixed"   : [29.0, 28.0, 18.0,  7.0, 16.0, 2.0],
    "unknown" : [25.0, 25.0, 18.0,  7.0, 23.0, 2.0],
}
SYNGAS_YIELD_NM3_PER_TONNE = {
    "plastic":1100, "organic":800, "paper":900, "textile":850, "wood":950,
    "metal":200, "glass":150, "inert":100, "mixed":850, "unknown":750,
}

WASTE_TYPES = list(NET_KWH_PER_TONNE.keys())
GAS_LABELS  = ["H2_pct", "CO_pct", "CO2_pct", "CH4_pct", "N2_pct", "Other_pct"]


def generate_plasmasim_dataset(n_samples: int = 4000) -> pd.DataFrame:
    """
    Generates synthetic plasma gasification dataset with ±8% noise on outputs.
    """
    random.seed(42)
    np.random.seed(42)

    rows = []
    for _ in range(n_samples):
        wtype     = random.choice(WASTE_TYPES)
        mass_kg   = round(random.uniform(0.5, 1000.0), 2)
        plasma_t  = round(random.uniform(4800, 6000), 0)  # °C
        moisture  = round(random.uniform(5, 80), 1)

        mass_t      = mass_kg / 1000.0
        kwh_base    = NET_KWH_PER_TONNE[wtype]
        therm_base  = THERMAL_MWH_PER_TONNE[wtype]
        gas_base    = GAS_COMPOSITION_DB[wtype]
        syngas_base = SYNGAS_YIELD_NM3_PER_TONNE[wtype]

        # Moisture penalty: high moisture reduces energy yield
        moisture_factor = max(0.5, 1.0 - (moisture - 10) * 0.005)

        # Add ±8% noise
        noise = lambda: random.uniform(0.92, 1.08)

        electricity_kwh  = round(kwh_base    * mass_t * moisture_factor * noise(), 4)
        heat_kwh         = round(therm_base  * 1000 * mass_t * moisture_factor * noise(), 4)
        syngas_nm3       = round(syngas_base * mass_t * moisture_factor * noise(), 4)

        gas_fracs = [round(g * noise(), 2) for g in gas_base]
        # Renormalize to sum to 100
        total_f   = sum(gas_fracs)
        gas_fracs = [round(f / total_f * 100, 2) for f in gas_fracs]

        row = {
            "waste_type":       wtype,
            "mass_kg":          mass_kg,
            "plasma_temp_c":    plasma_t,
            "moisture_percent": moisture,
            "electricity_kwh":  electricity_kwh,
            "heat_kwh":         heat_kwh,
            "syngas_nm3":       syngas_nm3,
        }
        for j, label in enumerate(GAS_LABELS):
            row[label] = gas_fracs[j]

        rows.append(row)

    return pd.DataFrame(rows)


def build_pipeline_single(num_features: list, cat_features: list) -> Pipeline:
    """Builds a GradientBoosting pipeline for single-output regression."""
    preprocessor = ColumnTransformer([
        ("num", StandardScaler(), num_features),
        ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), cat_features),
    ])
    regressor = GradientBoostingRegressor(
        n_estimators=200,
        learning_rate=0.08,
        max_depth=6,
        subsample=0.8,
        random_state=42,
    )
    return Pipeline([("prep", preprocessor), ("reg", regressor)])


def build_pipeline_multi(num_features: list, cat_features: list) -> Pipeline:
    """Builds a MultiOutput GradientBoosting pipeline for gas composition."""
    preprocessor = ColumnTransformer([
        ("num", StandardScaler(), num_features),
        ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), cat_features),
    ])
    regressor = MultiOutputRegressor(
        GradientBoostingRegressor(
            n_estimators=150, learning_rate=0.1,
            max_depth=5, subsample=0.8, random_state=42,
        ),
        n_jobs=-1
    )
    return Pipeline([("prep", preprocessor), ("reg", regressor)])


def train():
    print("=" * 60)
    print("  ATMOSCHAIN — PlasmaSim Model Training")
    print("=" * 60)

    # 1. Generate dataset
    print("\n[1] Generating plasma gasification dataset (4,000 samples)...")
    df = generate_plasmasim_dataset(n_samples=4000)
    print(f"  Shape: {df.shape}")
    print(f"  Waste types: {df['waste_type'].unique().tolist()}")

    # Feature columns
    CAT_FEATURES = ["waste_type"]
    NUM_FEATURES = ["mass_kg", "plasma_temp_c", "moisture_percent"]
    ENERGY_TARGETS = ["electricity_kwh", "heat_kwh", "syngas_nm3"]
    GAS_TARGETS    = GAS_LABELS

    X = df[CAT_FEATURES + NUM_FEATURES]
    y_energy = df[ENERGY_TARGETS]
    y_gas    = df[GAS_TARGETS]

    X_train, X_test, ye_train, ye_test, yg_train, yg_test = train_test_split(
        X, y_energy, y_gas, test_size=0.2, random_state=42, stratify=df["waste_type"]
    )
    print(f"  Train: {len(X_train)} | Test: {len(X_test)}")

    # 2. Train energy model (multi-output)
    print("\n[2] Training Energy Model (electricity + heat + syngas)...")
    energy_pipe = build_pipeline_multi(NUM_FEATURES, CAT_FEATURES)
    energy_pipe.fit(X_train, ye_train)

    ye_pred = energy_pipe.predict(X_test)
    energy_metrics = {}
    for i, tgt in enumerate(ENERGY_TARGETS):
        r2  = r2_score(ye_test.iloc[:, i], ye_pred[:, i])
        mae = mean_absolute_error(ye_test.iloc[:, i], ye_pred[:, i])
        energy_metrics[tgt] = {"r2": round(r2, 4), "mae": round(mae, 4)}
        print(f"  {tgt:<20}: R²={r2:.4f}  MAE={mae:.4f}")

    # 3. Train gas composition model (multi-output)
    print("\n[3] Training Gas Composition Model (H2, CO, CO2, CH4, N2, Other)...")
    gas_pipe = build_pipeline_multi(NUM_FEATURES, CAT_FEATURES)
    gas_pipe.fit(X_train, yg_train)

    yg_pred = gas_pipe.predict(X_test)
    gas_metrics = {}
    for i, tgt in enumerate(GAS_TARGETS):
        r2  = r2_score(yg_test.iloc[:, i], yg_pred[:, i])
        mae = mean_absolute_error(yg_test.iloc[:, i], yg_pred[:, i])
        gas_metrics[tgt] = {"r2": round(r2, 4), "mae": round(mae, 4)}
        print(f"  {tgt:<15}: R²={r2:.4f}  MAE={mae:.4f} %")

    # 4. Save models
    print("\n[4] Saving models...")
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    with open(ENERGY_MODEL, "wb") as f:
        pickle.dump({
            "pipeline":      energy_pipe,
            "targets":       ENERGY_TARGETS,
            "cat_features":  CAT_FEATURES,
            "num_features":  NUM_FEATURES,
        }, f)
    print(f"  ✓ Energy model saved to {ENERGY_MODEL}")

    with open(GAS_MODEL, "wb") as f:
        pickle.dump({
            "pipeline":      gas_pipe,
            "targets":       GAS_TARGETS,
            "cat_features":  CAT_FEATURES,
            "num_features":  NUM_FEATURES,
        }, f)
    print(f"  ✓ Gas model saved to {GAS_MODEL}")

    # 5. Meta
    meta = {
        "energy_model": {
            "type":    "MultiOutputRegressor(GradientBoostingRegressor)",
            "targets": ENERGY_TARGETS,
            "metrics": energy_metrics,
        },
        "gas_model": {
            "type":    "MultiOutputRegressor(GradientBoostingRegressor)",
            "targets": GAS_TARGETS,
            "metrics": gas_metrics,
        },
        "features": {
            "categorical": CAT_FEATURES,
            "numerical":   NUM_FEATURES,
        },
        "train_samples": len(X_train),
        "test_samples":  len(X_test),
        "description": (
            "PlasmaSim ML models for electricity/heat output and syngas composition "
            "prediction. Trained on physics-derived synthetic data from empirical "
            "plasma gasification literature."
        ),
    }
    META_PATH.write_text(json.dumps(meta, indent=2))
    print(f"  ✓ Metadata saved to {META_PATH}")

    print("\n" + "=" * 60)
    print("  ✅ PlasmaSim Model Training Complete!")
    for tgt, m in energy_metrics.items():
        print(f"     {tgt:<20}: R² = {m['r2']:.4f}")
    print("=" * 60)


if __name__ == "__main__":
    train()
