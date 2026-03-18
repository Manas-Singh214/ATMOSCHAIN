"""
ATMOSCHAIN — PlasmaSim Optimizer
cyclone_separator_model.py

Models Stage 1 of gas cleanup: cyclone separator.
Removes particulates, slag droplets, and heavy aerosols from hot syngas.

Author: ATMOSCHAIN Dev Team
"""


class CycloneSeparator:
    """
    Stage 1: Cyclone centrifugal separator.
    Removes >99% of particles >10 microns from syngas stream.
    """

    # Removal efficiency by particle type
    PARTICULATE_REMOVAL_EFF = 0.992    # 99.2% removal >10μm
    SLAG_CARRY_FRACTION     = 0.003    # 0.3% of slag enters gas stream

    def process(self, raw_gas_pct: dict, input_mass_kg: float) -> dict:
        """
        Process raw syngas through cyclone separator.
        
        Args:
            raw_gas_pct   : Raw gas composition percentages
            input_mass_kg : Original waste mass
        
        Returns:
            clean_gas_pct, slag removed, particulate loading
        """
        # Normalize gas composition (Other ~ particulate-bearing fraction)
        other_pct = raw_gas_pct.get("Other", 2.0)
        particulate_raw_ppm = other_pct * 10000  # rough ppm estimate from %

        # After cyclone: Other fraction reduced dramatically
        clean_gas = dict(raw_gas_pct)
        cleaned_other = other_pct * (1 - self.PARTICULATE_REMOVAL_EFF)
        clean_gas["Other"] = round(cleaned_other, 4)

        # Renormalize to 100%
        total = sum(clean_gas.values())
        if total > 0:
            clean_gas = {k: round(v / total * 100, 2) for k, v in clean_gas.items()}

        # Slag carried into gas stream then removed
        slag_kg = round(input_mass_kg * self.SLAG_CARRY_FRACTION, 6)

        return {
            "stage"                : "CYCLONE_SEPARATION",
            "temperature_c"        : 800,
            "pressure_bar"         : 1.1,
            "clean_gas_pct"        : clean_gas,
            "slag_kg"              : slag_kg,
            "particulate_ppm"      : round(particulate_raw_ppm * (1 - self.PARTICULATE_REMOVAL_EFF), 1),
            "removal_efficiency_pct": round(self.PARTICULATE_REMOVAL_EFF * 100, 1),
            "description"          : "Centrifugal force separates solid slag droplets from gas stream. >99.2% particle removal."
        }
