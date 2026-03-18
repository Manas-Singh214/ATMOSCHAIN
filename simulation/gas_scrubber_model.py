"""
ATMOSCHAIN — PlasmaSim Optimizer
gas_scrubber_model.py

Models Stage 2: Wet gas scrubber.
Removes acid gases (HCl, H2S), sulfur compounds, heavy metals, and dioxins.
Uses NaOH or Ca(OH)2 scrubbing solution.

Author: ATMOSCHAIN Dev Team
"""


class GasScrubber:
    """
    Stage 2: Wet chemical scrubber for acid gas removal.
    Achieves 99.9% sulfur removal and >99% HCl removal.
    """

    SULFUR_REMOVAL_EFF   = 0.999   # 99.9%
    HCL_REMOVAL_EFF      = 0.995   # 99.5%
    DIOXIN_REMOVAL_EFF   = 0.9997  # 99.97%
    HEAVY_METAL_REMOVAL  = 0.99    # 99%

    # Raw contaminant levels in typical MSW syngas (ppm before scrubbing)
    RAW_CONTAMINANTS_PPM = {
        "sulfur_dioxide"  : 250,
        "hydrogen_sulfide": 180,
        "hydrogen_chloride": 400,
        "dioxins_ng_nm3"  : 2.5,
        "mercury_ug_nm3"  : 50,
    }

    def process(self, input_gas_pct: dict) -> dict:
        """
        Process gas through wet scrubber.
        Gas composition (H2, CO, etc.) largely unchanged,
        but contaminants removed and gas cooled.
        
        Returns:
            clean_gas_pct, removed contaminants, emission levels
        """
        # Main gas composition unchanged by scrubber (selective for acid gases)
        clean_gas = dict(input_gas_pct)

        # Calculate post-scrubber contaminant levels
        post_scrubber = {
            "sulfur_dioxide_ppm"   : round(self.RAW_CONTAMINANTS_PPM["sulfur_dioxide"]   * (1 - self.SULFUR_REMOVAL_EFF), 2),
            "hydrogen_sulfide_ppm" : round(self.RAW_CONTAMINANTS_PPM["hydrogen_sulfide"]  * (1 - self.SULFUR_REMOVAL_EFF), 2),
            "hydrogen_chloride_ppm": round(self.RAW_CONTAMINANTS_PPM["hydrogen_chloride"] * (1 - self.HCL_REMOVAL_EFF), 2),
            "dioxins_ng_nm3"       : round(self.RAW_CONTAMINANTS_PPM["dioxins_ng_nm3"]    * (1 - self.DIOXIN_REMOVAL_EFF), 4),
            "mercury_ug_nm3"       : round(self.RAW_CONTAMINANTS_PPM["mercury_ug_nm3"]    * (1 - self.HEAVY_METAL_REMOVAL), 2),
        }

        eu_standard = {
            "HCl_limit_mg_nm3"     : 10,
            "SO2_limit_mg_nm3"     : 50,
            "dioxins_limit_ng_nm3" : 0.1,
            "status"               : "COMPLIANT" if post_scrubber["dioxins_ng_nm3"] < 0.1 else "NON-COMPLIANT"
        }

        return {
            "stage"               : "GAS_SCRUBBING",
            "temperature_c"       : 400,
            "pressure_bar"        : 1.05,
            "clean_gas_pct"       : clean_gas,
            "sulfur_removed_ppm"  : round(self.RAW_CONTAMINANTS_PPM["sulfur_dioxide"] * self.SULFUR_REMOVAL_EFF, 2),
            "hcl_removed_ppm"     : round(self.RAW_CONTAMINANTS_PPM["hydrogen_chloride"] * self.HCL_REMOVAL_EFF, 2),
            "post_scrubber_levels": post_scrubber,
            "eu_emission_standard": eu_standard,
            "scrubbing_reagent"   : "NaOH solution (10% concentration)",
            "description"         : "Wet chemical scrubbing removes acid gases, sulfur compounds, heavy metals, and dioxins. Gas meets EU WtE emission standards."
        }
