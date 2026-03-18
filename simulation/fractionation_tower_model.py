"""
ATMOSCHAIN — PlasmaSim Optimizer
fractionation_tower_model.py

Models Stage 3: Cryogenic fractionation / pressure swing adsorption.
Separates syngas into individual product streams:
H2, CO, CO2, CH4 — each with high purity for industrial use.

Author: ATMOSCHAIN Dev Team
"""


class FractionationTower:
    """
    Stage 3: Cryogenic distillation / PSA fractionation tower.
    Achieves >95% purity for H2 and CO product streams.
    """

    # Separation efficiency per component (fraction recovered per stream)
    RECOVERY_EFFICIENCY = {
        "H2" : 0.92,    # PSA achieves 92% H2 recovery
        "CO" : 0.88,
        "CO2": 0.95,
        "CH4": 0.90,
        "N2" : 0.85,
        "Other": 0.70,
    }

    # Product purity achiveable
    PRODUCT_PURITY = {
        "H2" : 99.9,
        "CO" : 98.5,
        "CO2": 99.0,
        "CH4": 97.0,
        "N2" : 98.0,
    }

    def process(self, input_gas_pct: dict) -> dict:
        """
        Separate input gas mixture into individual product streams.
        
        Args:
            input_gas_pct: Gas composition percentages after scrubbing
        
        Returns:
            Individual product streams with purity, volume fractions, and applications
        """
        # Apply recovery efficiencies
        fractionated = {}
        for gas, pct in input_gas_pct.items():
            eff = self.RECOVERY_EFFICIENCY.get(gas, 0.80)
            fractionated[gas] = round(pct * eff, 2)

        # Renormalize
        total = sum(fractionated.values())
        if total > 0:
            fractionated_norm = {k: round(v / total * 100, 2) for k, v in fractionated.items()}
        else:
            fractionated_norm = fractionated

        # Product stream specs
        product_streams = {}
        for gas in ["H2", "CO", "CO2", "CH4"]:
            if gas in input_gas_pct:
                product_streams[gas] = {
                    "inlet_fraction_pct" : input_gas_pct.get(gas, 0),
                    "outlet_fraction_pct": fractionated_norm.get(gas, 0),
                    "purity_pct"         : self.PRODUCT_PURITY.get(gas, 95.0),
                    "recovery_pct"       : round(self.RECOVERY_EFFICIENCY.get(gas, 0.8) * 100, 1),
                }

        return {
            "stage"                 : "FRACTIONATION",
            "temperature_c"         : -180,   # cryogenic stage
            "pressure_bar"          : 3.0,
            "fractionated_gas_pct"  : fractionated_norm,
            "product_streams"       : product_streams,
            "separation_method"     : "Pressure Swing Adsorption (PSA) + cryogenic distillation",
            "description"           : "Pressure swing adsorption + cryogenic distillation separates syngas into high-purity H₂, CO, CO₂, and CH₄ product streams for industrial use."
        }
