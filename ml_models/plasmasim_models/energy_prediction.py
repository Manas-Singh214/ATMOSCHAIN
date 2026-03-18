"""
ATMOSCHAIN — PlasmaSim Optimizer
energy_prediction.py

Predicts electricity output from plasma gasification using waste type,
mass, and gas composition data. Accounts for parasitic load of the plasma arc.

Author: ATMOSCHAIN Dev Team
"""


# ─── Energy constants ─────────────────────────────────────────────────────────

# Net electricity output (kWh) per tonne of waste — after parasitic plasma load
# Values from WTERT and commercial plant data (InEnTec, Solena, Alter NRG)
NET_KWH_PER_TONNE = {
    "plastic" : 750,   # high calorific value
    "organic" : 380,   # high moisture → lower yield
    "paper"   : 500,
    "textile" : 580,
    "wood"    : 620,
    "metal"   : 50,    # mostly non-combustible
    "glass"   : 30,
    "inert"   : 20,
    "mixed"   : 600,   # Delhi MSW average
    "unknown" : 500,
}

# Heat output (thermal MWh per tonne) for district heating or industrial steam
THERMAL_MWH_PER_TONNE = {
    "plastic" : 1.8, "organic" : 0.9, "paper"  : 1.2,
    "textile" : 1.4, "wood"    : 1.5, "metal"  : 0.1,
    "glass"   : 0.1, "inert"   : 0.1, "mixed"  : 1.4,
    "unknown" : 1.2,
}

# India grid electricity price (INR/kWh commercial)
INDIA_ELECTRICITY_PRICE_INR = 8.5
USD_TO_INR = 83.5
USD_PER_KWH_EXPORT = 0.06   # wholesale grid rate


class EnergyPredictor:
    """
    Predicts electricity and heat output from plasma gasification.
    
    Usage:
        ep = EnergyPredictor()
        result = ep.predict("mixed", 500)   # 500 kg of mixed waste
    """

    def predict(self, waste_class: str, mass_kg: float) -> dict:
        """
        Predict energy output for waste mass.
        
        Args:
            waste_class : detected waste type
            mass_kg     : waste mass in kilograms
        
        Returns:
            dict with electricity and heat output + revenue
        """
        wc = waste_class.lower()
        if wc not in NET_KWH_PER_TONNE:
            wc = "unknown"

        mass_tonnes = mass_kg / 1000.0

        electricity_kwh  = NET_KWH_PER_TONNE[wc] * mass_tonnes
        heat_mwh         = THERMAL_MWH_PER_TONNE[wc] * mass_tonnes
        heat_kwh         = heat_mwh * 1000.0

        # Revenue from electricity export
        revenue_usd = electricity_kwh * USD_PER_KWH_EXPORT
        revenue_inr = electricity_kwh * INDIA_ELECTRICITY_PRICE_INR

        # Homes powered: average Indian household uses ~100 kWh/month
        homes_powered_month = electricity_kwh / 100.0

        # Fossil fuel displaced: 1 kWh coal-fired gen ≈ 0.82 kg CO2
        co2_avoided_kg = electricity_kwh * 0.82

        return {
            "waste_class"         : wc,
            "mass_kg"             : round(mass_kg, 4),
            "electricity_kwh"     : round(electricity_kwh, 4),
            "heat_kwh"            : round(heat_kwh, 4),
            "total_energy_kwh"    : round(electricity_kwh + heat_kwh, 4),
            "revenue_usd"         : round(revenue_usd, 4),
            "revenue_inr"         : round(revenue_inr, 2),
            "homes_powered_month" : round(homes_powered_month, 2),
            "co2_avoided_kg"      : round(co2_avoided_kg, 4),
            "plasma_efficiency_pct": 28,   # typical plasma WtE efficiency
        }

    def daily_plant_scenario(
        self,
        waste_composition: dict,
        total_tonnes_per_day: float = 100.0
    ) -> dict:
        """
        Predict daily energy output for a full waste-to-energy plant.
        
        Args:
            waste_composition: {waste_class: fraction} dict
            total_tonnes_per_day: plant input capacity
        """
        total_kwh = 0.0
        total_heat_kwh = 0.0

        for wc, fraction in waste_composition.items():
            mass_kg = fraction * total_tonnes_per_day * 1000.0
            r = self.predict(wc, mass_kg)
            total_kwh      += r["electricity_kwh"]
            total_heat_kwh += r["heat_kwh"]

        revenue_inr_day = total_kwh * INDIA_ELECTRICITY_PRICE_INR
        homes_powered = total_kwh / 100.0   # monthly homes per day of operation

        return {
            "total_tonnes_per_day"    : total_tonnes_per_day,
            "electricity_kwh_per_day" : round(total_kwh, 2),
            "heat_kwh_per_day"        : round(total_heat_kwh, 2),
            "revenue_inr_per_day"     : round(revenue_inr_day, 2),
            "revenue_inr_per_year"    : round(revenue_inr_day * 365, 2),
            "homes_powered_monthly"   : round(homes_powered, 0),
            "coal_plants_displaced"   : round(total_kwh / 250000, 3),  # 250MW plant
        }


# ─── Standalone test ──────────────────────────────────────────────────────────
if __name__ == "__main__":
    import json
    ep = EnergyPredictor()

    print("=== 1kg plastic bottle ===")
    print(json.dumps(ep.predict("plastic", 1.0), indent=2))

    print("\n=== 100 tonne/day Delhi MSW plant ===")
    composition = {
        "organic": 0.50, "paper": 0.12, "plastic": 0.10,
        "textile": 0.06, "metal": 0.02, "glass": 0.02,
        "inert": 0.08, "mixed": 0.10
    }
    print(json.dumps(ep.daily_plant_scenario(composition, 100.0), indent=2))
