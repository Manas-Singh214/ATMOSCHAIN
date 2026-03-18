"""
ATMOSCHAIN — PlasmaSim Optimizer
gas_separation_pipeline.py

Orchestrates all gas separation stages:
  Cyclone → Scrubber → Fractionation Tower

Provides per-stage removal efficiency and output purity data.

Author: ATMOSCHAIN Dev Team
"""

from simulation.cyclone_separator_model    import CycloneSeparator
from simulation.gas_scrubber_model         import GasScrubber
from simulation.fractionation_tower_model  import FractionationTower


class GasSeparationPipeline:
    """
    Runs the complete gas separation pipeline for clean syngas production.
    
    Usage:
        pipeline = GasSeparationPipeline()
        result = pipeline.run(raw_gas_composition, slag_fraction=0.05)
    """

    def __init__(self):
        self.cyclone       = CycloneSeparator()
        self.scrubber      = GasScrubber()
        self.fractionation = FractionationTower()

    def run(self, raw_gas_pct: dict, input_mass_kg: float) -> dict:
        """
        Run raw syngas through all 3 separation stages.
        
        Args:
            raw_gas_pct   : Gas composition % dict {H2, CO, CO2, CH4, N2, Other}
            input_mass_kg : Original waste mass (for slag calculation)
        
        Returns:
            dict with per-stage results and final clean gas composition
        """
        # Stage 1: Cyclone Separator
        cyclone_out = self.cyclone.process(raw_gas_pct, input_mass_kg)

        # Stage 2: Gas Scrubber
        scrubber_out = self.scrubber.process(cyclone_out["clean_gas_pct"])

        # Stage 3: Fractionation
        fractionation_out = self.fractionation.process(scrubber_out["clean_gas_pct"])

        return {
            "stage_1_cyclone"      : cyclone_out,
            "stage_2_scrubber"     : scrubber_out,
            "stage_3_fractionation": fractionation_out,
            "final_gas_pct"        : fractionation_out["fractionated_gas_pct"],
            "pipeline_summary": {
                "slag_removed_kg"      : cyclone_out["slag_kg"],
                "particulate_removed_ppm": cyclone_out["particulate_ppm"],
                "sulfur_removed_ppm"   : scrubber_out["sulfur_removed_ppm"],
                "hcl_removed_ppm"      : scrubber_out["hcl_removed_ppm"],
                "final_h2_pct"         : fractionation_out["fractionated_gas_pct"].get("H2", 0),
                "final_co_pct"         : fractionation_out["fractionated_gas_pct"].get("CO", 0),
            }
        }


# ─── Standalone test ──────────────────────────────────────────────────────────
if __name__ == "__main__":
    import json

    raw = {"H2": 35, "CO": 30, "CO2": 15, "CH4": 12, "N2": 5, "Other": 3}
    pipeline = GasSeparationPipeline()
    result = pipeline.run(raw, input_mass_kg=1.5)
    print(json.dumps(result["pipeline_summary"], indent=2))
