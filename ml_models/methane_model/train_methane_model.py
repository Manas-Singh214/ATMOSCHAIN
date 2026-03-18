"""
ATMOSCHAIN — Methane Model
train_methane_model.py

Trains a scikit-learn Random Forest Regressor on the methane_historical.csv
dataset to predict CH4 yield from waste properties.

Why Random Forest?
  - Handles mixed categorical + numerical features natively
  - Robust to outliers and does not require feature scaling
  - Fast inference at runtime, no GPU needed
  - Provides feature importances for scientific transparency

Trains TWO models:
  1. ch4_predictor.pkl    — predicts ch4_yield_kg from waste features
  2. co2e_predictor.pkl   — predicts co2e_yield_kg from waste features

Both are saved to ml_models/methane_model/ for use in the FastAPI backend.

Usage:
    python ml_models/methane_model/train_methane_model.py

Author: ATMOSCHAIN Dev Team
"""

import sys
import json
import pickle
from pathlib import Path

import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import (
    mean_absolute_error, mean_squared_error, r2_score
)
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler

# ─── Paths ────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ROOT))

METHANE_CSV = ROOT / "datasets" / "methane_generation_data" / "methane_historical.csv"
MODEL_DIR   = Path(__file__).parent
CH4_MODEL   = MODEL_DIR / "ch4_predictor.pkl"
CO2E_MODEL  = MODEL_DIR / "co2e_predictor.pkl"
META_PATH   = MODEL_DIR / "methane_model_meta.json"


# ─── Feature engineering ──────────────────────────────────────────────────────
def load_and_prepare(csv_path: Path) -> pd.DataFrame:
    """
    Loads the CSV and engineers additional features.
    Drops rows where target is zero (inert/metal/glass/plastic)
    for the regression model — the physics model handles those.
    """
    df = pd.read_csv(csv_path)

    # Only keep rows where methane is actually generated (organic materials)
    df_organic = df[df["ch4_yield_kg"] > 0].copy()
    df_inert   = df[df["ch4_yield_kg"] == 0].copy()  # for info

    print(f"  Total samples:   {len(df):,}")
    print(f"  Organic samples (ch4 > 0): {len(df_organic):,}")
    print(f"  Inert samples   (ch4 = 0): {len(df_inert):,}")

    # Feature: mass × doc (highly predictive per IPCC formula)
    df_organic["mass_x_doc"] = df_organic["mass_kg"] * df_organic["doc_fraction"]

    # Feature: log transform of mass
    df_organic["log_mass"] = np.log1p(df_organic["mass_kg"])

    return df_organic


def build_pipeline(target: str) -> Pipeline:
    """
    Builds a scikit-learn Pipeline with a ColumnTransformer preprocessor
    and a Random Forest regressor.
    """
    cat_features = ["waste_type"]
    num_features = ["mass_kg", "doc_fraction", "temperature_c",
                    "moisture_percent", "mass_x_doc", "log_mass"]

    preprocessor = ColumnTransformer(transformers=[
        ("num", StandardScaler(), num_features),
        ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), cat_features),
    ])

    # Random Forest — robust, high-accuracy model
    regressor = RandomForestRegressor(
        n_estimators=300,
        max_depth=12,
        min_samples_split=4,
        min_samples_leaf=2,
        max_features="sqrt",
        random_state=42,
        n_jobs=-1,
    )

    return Pipeline(steps=[
        ("preprocessor", preprocessor),
        ("regressor",    regressor),
    ])


def evaluate_model(model, X_test, y_test, target_name: str) -> dict:
    """Evaluates a trained model and prints metrics."""
    y_pred = model.predict(X_test)
    mae  = mean_absolute_error(y_test, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    r2   = r2_score(y_test, y_pred)

    print(f"\n  [{target_name}] Test Metrics:")
    print(f"    MAE  = {mae:.4f} kg")
    print(f"    RMSE = {rmse:.4f} kg")
    print(f"    R²   = {r2:.4f}")

    return {"mae": round(mae, 4), "rmse": round(rmse, 4), "r2": round(r2, 4)}


def train():
    print("=" * 60)
    print("  ATMOSCHAIN — Methane Model Training")
    print("=" * 60)

    # 1. Load data
    print("\n[1] Loading methane_historical.csv...")
    if not METHANE_CSV.exists():
        print(f"  ERROR: CSV not found at {METHANE_CSV}")
        print("  Run: python datasets/generate_datasets.py")
        return

    df = load_and_prepare(METHANE_CSV)

    FEATURES = ["waste_type", "mass_kg", "doc_fraction", "temperature_c",
                "moisture_percent", "mass_x_doc", "log_mass"]

    X = df[FEATURES]
    y_ch4  = df["ch4_yield_kg"]
    y_co2e = df["co2e_yield_kg"]

    # Train/test split (stratify by waste type)
    X_train, X_test, y_ch4_train, y_ch4_test = train_test_split(
        X, y_ch4, test_size=0.2, random_state=42, stratify=df["waste_type"]
    )
    _, _, y_co2e_train, y_co2e_test = train_test_split(
        X, y_co2e, test_size=0.2, random_state=42, stratify=df["waste_type"]
    )

    print(f"\n  Train: {len(X_train)} | Test: {len(X_test)}")

    # 2. Train CH4 predictor
    print("\n[2] Training CH4 predictor (Random Forest)...")
    ch4_pipe = build_pipeline("ch4")
    ch4_pipe.fit(X_train, y_ch4_train)
    ch4_metrics = evaluate_model(ch4_pipe, X_test, y_ch4_test, "CH4")

    # 3. Train CO2e predictor
    print("\n[3] Training CO2e predictor (Random Forest)...")
    co2e_pipe = build_pipeline("co2e")
    co2e_pipe.fit(X_train, y_co2e_train)
    co2e_metrics = evaluate_model(co2e_pipe, X_test, y_co2e_test, "CO2e")

    # 4. Print feature importances
    print("\n[4] Feature Importances (CH4 model):")
    try:
        rf        = ch4_pipe.named_steps["regressor"]
        ohe_cats  = ch4_pipe.named_steps["preprocessor"] \
                             .named_transformers_["cat"] \
                             .get_feature_names_out(["waste_type"])
        num_names = ["mass_kg", "doc_fraction", "temperature_c",
                     "moisture_percent", "mass_x_doc", "log_mass"]
        feat_names = list(num_names) + list(ohe_cats)
        importances = rf.feature_importances_

        feat_imp = sorted(zip(feat_names, importances), key=lambda x: -x[1])
        for fname, fimp in feat_imp[:10]:
            print(f"    {fname:<25}: {fimp:.4f}")
    except Exception as e:
        print(f"  (Feature importances unavailable: {e})")

    # 5. Save models
    print("\n[5] Saving models...")
    CH4_MODEL.parent.mkdir(parents=True, exist_ok=True)

    with open(CH4_MODEL, "wb") as f:
        pickle.dump(ch4_pipe, f)
    print(f"  ✓ CH4 model saved to {CH4_MODEL}")

    with open(CO2E_MODEL, "wb") as f:
        pickle.dump(co2e_pipe, f)
    print(f"  ✓ CO2e model saved to {CO2E_MODEL}")

    # 6. Save metadata
    meta = {
        "model_type": "RandomForestRegressor (Pipeline with StandardScaler + OneHotEncoder)",
        "features":   FEATURES,
        "targets":    ["ch4_yield_kg", "co2e_yield_kg"],
        "train_samples": len(X_train),
        "test_samples":  len(X_test),
        "ch4_metrics":   ch4_metrics,
        "co2e_metrics":  co2e_metrics,
        "description": (
            "Predicts methane and CO2e yield from waste material properties. "
            "Uses IPCC FOD-derived synthetic data with 5% noise. "
            "Zero-yield materials (plastic, metal, glass, inert) are handled by "
            "the physics model in methane_prediction.py."
        ),
    }
    META_PATH.write_text(json.dumps(meta, indent=2))
    print(f"  ✓ Metadata saved to {META_PATH}")

    print("\n" + "=" * 60)
    print(f"  ✅ Methane Model Training Complete!")
    print(f"     CH4  R² = {ch4_metrics['r2']:.4f}")
    print(f"     CO2e R² = {co2e_metrics['r2']:.4f}")
    print("=" * 60)


if __name__ == "__main__":
    train()
