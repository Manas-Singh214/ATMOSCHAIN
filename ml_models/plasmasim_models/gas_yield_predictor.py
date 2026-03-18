"""
ATMOSCHAIN — PlasmaSim Optimizer
gas_yield_predictor.py

Predicts gas composition fractions and slag yield from plasma gasification
of detected waste types. Based on empirical literature data from waste-to-energy
plasma arc gasification plants.

References:
- Waste-to-Energy Research & Technology Council (WTERT) Technical Reports
- Plasma gasification pilot plant data (Environment Canada, 2013)

Author: ATMOSCHAIN Dev Team
"""

import numpy as np
from typing import Tuple


# ─── Empirical gas composition database ───────────────────────────────────────
# Values represent typical gas fractions (%) from plasma gasification
# at ~5000°C for each waste type. Based on literature averages.
#
# Format: [H2%, CO%, CO2%, CH4%, N2%, other%]
GAS_COMPOSITION_DB = {
    "plastic" : [35.0, 32.0, 14.0, 12.0,  5.0, 2.0],
    "organic" : [28.0, 30.0, 22.0,  5.0, 13.0, 2.0],
    "paper"   : [31.0, 29.0, 18.0,  7.0, 13.0, 2.0],
    "textile" : [30.0, 28.0, 17.0,  8.0, 15.0, 2.0],
    "wood"    : [33.0, 31.0, 16.0,  8.0, 10.0, 2.0],
    "metal"   : [ 5.0,  3.0,  5.0,  1.0, 82.0, 4.0],   # mostly inert + N2
    "glass"   : [ 2.0,  2.0,  8.0,  0.0, 84.0, 4.0],
    "inert"   : [ 1.0,  1.0,  5.0,  0.0, 89.0, 4.0],
    "mixed"   : [29.0, 28.0, 18.0,  7.0, 16.0, 2.0],   # weighted MSW average
    "unknown" : [25.0, 25.0, 18.0,  7.0, 23.0, 2.0],
}

GAS_LABELS = ["H2", "CO", "CO2", "CH4", "N2", "Other"]

# Syngas yield (Nm³ per tonne of waste)
SYNGAS_YIELD_NM3_PER_TONNE = {
    "plastic" : 1100, "organic" : 800, "paper"  : 900,
    "textile" : 850,  "wood"    : 950, "metal"  : 200,
    "glass"   : 150,  "inert"   : 100, "mixed"  : 850,
    "unknown" : 750,
}

# Slag yield (kg per tonne of waste input)
SLAG_YIELD_KG_PER_TONNE = {
    "plastic" : 30,  "organic" : 50,  "paper"  : 80,
    "textile" : 60,  "wood"    : 100, "metal"  : 800,
    "glass"   : 950, "inert"   : 900, "mixed"  : 150,
    "unknown" : 200,
}

# Calorific value of syngas (MJ/Nm³) — primarily from H2+CO content
SYNGAS_LHV_MJ_PER_NM3 = 8.5   # lower heating value average


class GasYieldPredictor:
    """
    Predicts gas composition and mass balance from plasma gasification.

    Usage:
        predictor = GasYieldPredictor()
        result = predictor.predict(waste_class="plastic", mass_kg=1.5)
    """

    def predict(self, waste_class: str, mass_kg: float) -> dict:
        """
        Predict full plasma gasification output for a given waste sample.
        
        Args:
            waste_class : detected waste type
            mass_kg     : waste mass in kilograms
        
        Returns:
            dict with gas composition, syngas volume, slag mass, energy content
        """
        wc = waste_class.lower()
        if wc not in GAS_COMPOSITION_DB:
            wc = "unknown"

        fractions = GAS_COMPOSITION_DB[wc]       # in %
        syngas_per_tonne = SYNGAS_YIELD_NM3_PER_TONNE[wc]
        slag_per_tonne   = SLAG_YIELD_KG_PER_TONNE[wc]

        mass_tonnes = mass_kg / 1000.0

        syngas_volume_nm3 = syngas_per_tonne * mass_tonnes
        slag_mass_kg      = slag_per_tonne * mass_tonnes

        # Compute energy content of syngas
        syngas_energy_mj  = syngas_volume_nm3 * SYNGAS_LHV_MJ_PER_NM3

        # Compute per-gas absolute volumes
        gas_volumes = {
            GAS_LABELS[i]: round(syngas_volume_nm3 * fractions[i] / 100.0, 6)
            for i in range(len(GAS_LABELS))
        }

        return {
            "waste_class"          : wc,
            "mass_kg"              : round(mass_kg, 4),
            "gas_composition_pct"  : {
                GAS_LABELS[i]: round(fractions[i], 1)
                for i in range(len(GAS_LABELS))
            },
            "gas_volumes_nm3"      : gas_volumes,
            "syngas_total_nm3"     : round(syngas_volume_nm3, 6),
            "syngas_energy_mj"     : round(syngas_energy_mj, 4),
            "slag_mass_kg"         : round(slag_mass_kg, 6),
            "plasma_temp_c"        : 5500,   # typical operating temperature
            "notes": {
                "H2" : "Hydrogen — for fuel cells or green hydrogen production",
                "CO" : "Carbon monoxide — for synthetic fuels (Fischer-Tropsch)",
                "CO2": "Carbon dioxide — for carbon capture or greenhouses",
                "CH4": "Methane — for electricity generation or grid injection",
                "N2" : "Nitrogen — inert, typically vented or used in packaging",
                "Slag": f"{round(slag_mass_kg * 1000, 2)}g — vitrified, inert, usable as construction aggregate"
            }
        }

    def get_gas_utilization_plan(self, gas_volumes: dict) -> dict:
        """
        Given gas volumes (Nm³), return industrial utilization recommendations.
        """
        h2  = gas_volumes.get("H2", 0)
        co  = gas_volumes.get("CO", 0)
        co2 = gas_volumes.get("CO2", 0)
        ch4 = gas_volumes.get("CH4", 0)

        # H2 energy: 10.8 MJ/Nm³
        # CO energy: 12.6 MJ/Nm³
        # CH4 energy: 35.8 MJ/Nm³
        h2_energy_kwh  = (h2  * 10.8) / 3.6
        co_energy_kwh  = (co  * 12.6) / 3.6
        ch4_energy_kwh = (ch4 * 35.8) / 3.6

        return {
            "H2": {
                "volume_nm3"   : round(h2, 4),
                "application"  : "Fuel cell electricity generation / Green H2 export",
                "energy_kwh"   : round(h2_energy_kwh, 4)
            },
            "CO": {
                "volume_nm3"   : round(co, 4),
                "application"  : "Synfuel production (Fischer-Tropsch) / Reducing agent",
                "energy_kwh"   : round(co_energy_kwh, 4)
            },
            "CO2": {
                "volume_nm3"   : round(co2, 4),
                "application"  : "Carbon capture & storage / Greenhouse CO2 enrichment",
                "co2_tonnes"   : round(co2 * 1.964 / 1000.0, 6)
            },
            "CH4": {
                "volume_nm3"   : round(ch4, 4),
                "application"  : "Power grid injection / On-site turbine electricity",
                "energy_kwh"   : round(ch4_energy_kwh, 4)
            },
        }


# ─── Standalone test ──────────────────────────────────────────────────────────
if __name__ == "__main__":
    import json
    predictor = GasYieldPredictor()

    result = predictor.predict("plastic", 2.0)
    print(json.dumps(result, indent=2))

    plan = predictor.get_gas_utilization_plan(result["gas_volumes_nm3"])
    print("\n=== Utilization Plan ===")
    print(json.dumps(plan, indent=2))
