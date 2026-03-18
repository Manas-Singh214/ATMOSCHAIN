"""
ATMOSCHAIN — WasteVision AI
methane_prediction.py

IPCC First-Order Decay (FOD) methane model for landfill gas estimation.
Also provides a scikit-learn regression fallback for non-organic classification.

Reference: IPCC 2006 Guidelines for National GHG Inventories, Vol. 5, Ch. 3
Author: ATMOSCHAIN Dev Team
"""

import numpy as np
from typing import Union


# ─── IPCC FOD Constants ────────────────────────────────────────────────────────

# DOC: Degradable Organic Carbon (fraction by weight) — IPCC Table 3.4
DOC_BY_WASTE_TYPE = {
    "plastic" : 0.00,
    "organic" : 0.15,   # food & garden waste
    "paper"   : 0.40,
    "textile" : 0.24,
    "wood"    : 0.43,
    "metal"   : 0.00,
    "glass"   : 0.00,
    "inert"   : 0.00,
    "mixed"   : 0.12,   # weighted average for Delhi MSW mix
    "unknown" : 0.10,
}

DOCf   = 0.50   # Fraction of DOC that eventually decomposes (IPCC default)
F      = 0.50   # CH4 fraction in landfill gas (IPCC default)
MCF    = 1.00   # Methane correction factor (managed landfill = 1.0)
GWP100 = 28     # Global Warming Potential of CH4 over 100 years (IPCC AR6)
MOLAR_RATIO = 16.0 / 12.0  # CH4 molar mass / C molar mass

# Voluntary carbon market price range (World Bank 2024, USD)
CARBON_PRICE_MIN = 10.0   # USD per tonne CO2e
CARBON_PRICE_MID = 20.0
CARBON_PRICE_MAX = 30.0

# INR conversion (approximate)
USD_TO_INR = 83.5


class MethanePredictor:
    """
    Calculates methane generation potential, CO₂-equivalent, and carbon credit
    value from waste type and mass using the IPCC First-Order Decay model.
    
    Usage:
        mp = MethanePredictor()
        result = mp.predict(waste_class="organic", mass_kg=0.5)
    """

    def predict(
        self,
        waste_class: str,
        mass_kg: float,
        doc_override: Union[float, None] = None
    ) -> dict:
        """
        Full methane + carbon credit calculation.
        
        Args:
            waste_class : ATMOSCHAIN waste class string
            mass_kg     : Estimated waste mass in kilograms
            doc_override: Optional manual DOC override (0.0–1.0)
        
        Returns dict with:
            ch4_kg, ch4_cubic_meters, co2e_kg, co2e_tonnes,
            carbon_credits, revenue_usd_min/mid/max, revenue_inr_mid,
            waste_class, mass_kg, doc_used, gwp_factor
        """
        wc = waste_class.lower()
        doc = doc_override if doc_override is not None else DOC_BY_WASTE_TYPE.get(wc, 0.10)

        # Convert kg → tonnes for IPCC formula
        mass_tonnes = mass_kg / 1000.0

        # IPCC FOD formula:
        # CH4 (tonnes) = mass_tonnes × DOC × DOCf × F × MCF × (16/12)
        ch4_tonnes = mass_tonnes * doc * DOCf * F * MCF * MOLAR_RATIO
        ch4_kg     = ch4_tonnes * 1000.0

        # Standard density of CH4 at STP: ~0.717 kg/m³
        ch4_m3 = ch4_kg / 0.717

        # CO2 equivalent (GWP100 = 28)
        co2e_tonnes = ch4_tonnes * GWP100
        co2e_kg     = co2e_tonnes * 1000.0

        # Carbon credits (1 credit = 1 tonne CO2e)
        carbon_credits = co2e_tonnes

        # Revenue calculations
        revenue_min = carbon_credits * CARBON_PRICE_MIN
        revenue_mid = carbon_credits * CARBON_PRICE_MID
        revenue_max = carbon_credits * CARBON_PRICE_MAX
        revenue_inr = revenue_mid * USD_TO_INR

        return {
            "waste_class"       : wc,
            "mass_kg"           : round(mass_kg, 4),
            "doc_used"          : doc,
            "ch4_kg"            : round(ch4_kg, 6),
            "ch4_cubic_meters"  : round(ch4_m3, 6),
            "co2e_kg"           : round(co2e_kg, 6),
            "co2e_tonnes"       : round(co2e_tonnes, 8),
            "carbon_credits"    : round(carbon_credits, 8),
            "revenue_usd_min"   : round(revenue_min, 4),
            "revenue_usd_mid"   : round(revenue_mid, 4),
            "revenue_usd_max"   : round(revenue_max, 4),
            "revenue_inr_mid"   : round(revenue_inr, 2),
            "gwp_factor"        : GWP100,
            "formula"           : "IPCC FOD: CH4 = mass × DOC × DOCf × F × MCF × 16/12",
        }

    def predict_landfill_daily(
        self,
        waste_composition: dict,
        total_tonnes_per_day: float = 100.0
    ) -> dict:
        """
        Predict daily methane from a full landfill with mixed waste composition.
        
        Args:
            waste_composition: dict of {waste_class: fraction} (fractions sum to 1.0)
            total_tonnes_per_day: daily waste intake in tonnes
        
        Returns:
            Aggregated CH4, CO2e, credits per day
        """
        total_ch4_kg = 0.0
        total_co2e_tonnes = 0.0

        for wc, fraction in waste_composition.items():
            mass_kg = fraction * total_tonnes_per_day * 1000.0
            r = self.predict(wc, mass_kg)
            total_ch4_kg    += r["ch4_kg"]
            total_co2e_tonnes += r["co2e_tonnes"]

        carbon_credits = total_co2e_tonnes
        revenue_mid = carbon_credits * CARBON_PRICE_MID

        return {
            "total_tonnes_per_day" : total_tonnes_per_day,
            "total_ch4_kg_per_day" : round(total_ch4_kg, 2),
            "total_co2e_tonnes_per_day": round(total_co2e_tonnes, 4),
            "carbon_credits_per_day": round(carbon_credits, 4),
            "revenue_usd_per_day"  : round(revenue_mid, 2),
            "revenue_inr_per_day"  : round(revenue_mid * USD_TO_INR, 2),
            "revenue_usd_per_year" : round(revenue_mid * 365, 2),
            "revenue_inr_per_year" : round(revenue_mid * 365 * USD_TO_INR, 2),
        }

    def ghazipur_scenario(self) -> dict:
        """
        Real-world scenario for Ghazipur landfill, Delhi.
        Ghazipur receives ~2,800 tonnes/day of MSW.
        Composition based on CPCB India Solid Waste data.
        """
        ghazipur_composition = {
            "organic"  : 0.50,   # 50% — food & garden waste
            "paper"    : 0.12,
            "plastic"  : 0.10,
            "textile"  : 0.06,
            "metal"    : 0.02,
            "glass"    : 0.02,
            "inert"    : 0.08,   # ash, dust, construction debris
            "mixed"    : 0.10,
        }
        return self.predict_landfill_daily(
            ghazipur_composition,
            total_tonnes_per_day=2800.0
        )


# ─── Standalone test ──────────────────────────────────────────────────────────
if __name__ == "__main__":
    import json
    mp = MethanePredictor()

    print("=== Single Item Test (500g plastic bottle) ===")
    print(json.dumps(mp.predict("plastic", 0.5), indent=2))

    print("\n=== Single Item Test (200g organic food waste) ===")
    print(json.dumps(mp.predict("organic", 0.2), indent=2))

    print("\n=== Ghazipur Landfill Daily Scenario ===")
    print(json.dumps(mp.ghazipur_scenario(), indent=2))
