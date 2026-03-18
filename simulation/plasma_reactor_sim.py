"""
ATMOSCHAIN — PlasmaSim Optimizer
plasma_reactor_sim.py

Full plasma gasification reactor simulation. Models the state machine:
INIT → PLASMA_ARC → THERMAL_CRACKING → SYNGAS_OUTPUT

Integrates gas_yield_predictor and energy_prediction to produce 
a complete per-stage simulation result for the frontend pipeline animation.

Author: ATMOSCHAIN Dev Team
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ml_models.plasmasim_models.gas_yield_predictor import GasYieldPredictor
from ml_models.plasmasim_models.energy_prediction   import EnergyPredictor


# ─── Stage definitions ────────────────────────────────────────────────────────

STAGES = [
    "WASTE_INPUT",
    "PLASMA_ARC",
    "THERMAL_CRACKING",
    "CYCLONE_SEPARATION",
    "GAS_SCRUBBING",
    "FRACTIONATION",
    "GAS_UTILIZATION",
]

# Temperature at each stage (°C)
STAGE_TEMPERATURES = {
    "WASTE_INPUT"        : 25,
    "PLASMA_ARC"         : 5500,
    "THERMAL_CRACKING"   : 1200,
    "CYCLONE_SEPARATION" : 800,
    "GAS_SCRUBBING"      : 400,
    "FRACTIONATION"      : 150,
    "GAS_UTILIZATION"    : 80,
}

# Pressure at each stage (bar)
STAGE_PRESSURES = {
    "WASTE_INPUT"        : 1.0,
    "PLASMA_ARC"         : 1.0,
    "THERMAL_CRACKING"   : 1.2,
    "CYCLONE_SEPARATION" : 1.1,
    "GAS_SCRUBBING"      : 1.05,
    "FRACTIONATION"      : 3.0,
    "GAS_UTILIZATION"    : 1.0,
}

# What each stage removes / produces
STAGE_DESCRIPTIONS = {
    "WASTE_INPUT"        : "Waste loaded into sealed feed chamber. Input logged.",
    "PLASMA_ARC"         : "Plasma arc at 4000–7000°C ionizes all organic matter. Complete thermal destruction.",
    "THERMAL_CRACKING"   : "Long-chain molecules crack into syngas. H₂ and CO dominate the gas phase.",
    "CYCLONE_SEPARATION" : "Centrifugal force separates slag (vitrified inert) from gas stream.",
    "GAS_SCRUBBING"      : "Sulfur, HCl, and dioxins removed. Gas stream cleaned to emission standards.",
    "FRACTIONATION"      : "Cryogenic separation fractionates H₂, CO, CO₂, CH₄ into individual streams.",
    "GAS_UTILIZATION"    : "Clean gas streams routed to turbines, fuel cells, and carbon capture systems.",
}


class PlasmaReactorSim:
    """
    Runs a full plasma gasification simulation for given waste input.
    Returns stage-by-stage state for frontend animation.
    
    Usage:
        sim = PlasmaReactorSim()
        result = sim.run("plastic", mass_kg=1.5)
    """

    def __init__(self):
        self.gas_predictor    = GasYieldPredictor()
        self.energy_predictor = EnergyPredictor()

    def run(self, waste_class: str, mass_kg: float) -> dict:
        """
        Run a complete plasma gasification simulation.
        
        Returns:
            dict with:
                - stages: list of per-stage state dicts
                - gas_composition: final gas % fractions
                - gas_utilization: industrial use plan
                - energy: electricity + heat output
                - slag: mass and properties
                - summary: key metrics for dashboard
        """
        wc = waste_class.lower()

        # Get gas and energy predictions
        gas_result    = self.gas_predictor.predict(wc, mass_kg)
        energy_result = self.energy_predictor.predict(wc, mass_kg)
        util_plan     = self.gas_predictor.get_gas_utilization_plan(
                            gas_result["gas_volumes_nm3"])

        # Build stage-by-stage simulation
        stages = []
        for stage in STAGES:
            stage_data = {
                "stage"      : stage,
                "temperature": STAGE_TEMPERATURES[stage],
                "pressure"   : STAGE_PRESSURES[stage],
                "description": STAGE_DESCRIPTIONS[stage],
            }

            # Add stage-specific outputs
            if stage == "WASTE_INPUT":
                stage_data["input"] = {
                    "waste_class": wc,
                    "mass_kg"    : mass_kg,
                    "volume_liters": round(mass_kg / 0.25, 2),  # rough estimate
                }

            elif stage == "PLASMA_ARC":
                stage_data["output"] = {
                    "state"          : "Plasma gas + molten slag",
                    "plasma_power_kw": round(mass_kg * 2.5, 2),  # ~2.5 kW/kg
                    "arc_voltage_kv" : 15,
                    "gas_formed"     : True,
                    "slag_formed"    : True,
                }

            elif stage == "THERMAL_CRACKING":
                stage_data["output"] = {
                    "syngas_raw_nm3" : round(gas_result["syngas_total_nm3"] * 1.15, 6),
                    "h2_pct"         : gas_result["gas_composition_pct"]["H2"],
                    "co_pct"         : gas_result["gas_composition_pct"]["CO"],
                }

            elif stage == "CYCLONE_SEPARATION":
                stage_data["output"] = {
                    "slag_removed_kg": gas_result["slag_mass_kg"],
                    "slag_notes"     : "Vitrified insoluble glass-like material. Usable as road aggregate.",
                    "gas_purity_pct" : 95.0,
                }

            elif stage == "GAS_SCRUBBING":
                stage_data["output"] = {
                    "sulfur_removed_ppm" : 5,
                    "hcl_removed_ppm"    : 2,
                    "dioxin_removed"     : True,
                    "gas_purity_pct"     : 99.2,
                }

            elif stage == "FRACTIONATION":
                stage_data["output"] = {
                    "fractions"   : gas_result["gas_composition_pct"],
                    "volumes_nm3" : gas_result["gas_volumes_nm3"],
                }

            elif stage == "GAS_UTILIZATION":
                stage_data["output"] = {
                    "electricity_kwh"     : energy_result["electricity_kwh"],
                    "heat_kwh"            : energy_result["heat_kwh"],
                    "revenue_inr"         : energy_result["revenue_inr"],
                    "homes_powered_month" : energy_result["homes_powered_month"],
                    "co2_avoided_kg"      : energy_result["co2_avoided_kg"],
                    "utilization_plan"    : util_plan,
                }

            stages.append(stage_data)

        # Summary for dashboard cards
        summary = {
            "waste_class"         : wc,
            "mass_kg"             : mass_kg,
            "electricity_kwh"     : energy_result["electricity_kwh"],
            "heat_kwh"            : energy_result["heat_kwh"],
            "syngas_nm3"          : gas_result["syngas_total_nm3"],
            "slag_kg"             : gas_result["slag_mass_kg"],
            "h2_pct"              : gas_result["gas_composition_pct"]["H2"],
            "co_pct"              : gas_result["gas_composition_pct"]["CO"],
            "co2_pct"             : gas_result["gas_composition_pct"]["CO2"],
            "ch4_pct"             : gas_result["gas_composition_pct"]["CH4"],
            "max_temp_c"          : 5500,
            "homes_powered_month" : energy_result["homes_powered_month"],
            "revenue_inr"         : energy_result["revenue_inr"],
            "co2_avoided_kg"      : energy_result["co2_avoided_kg"],
        }

        return {
            "stages"          : stages,
            "gas_composition" : gas_result["gas_composition_pct"],
            "gas_volumes_nm3" : gas_result["gas_volumes_nm3"],
            "gas_utilization" : util_plan,
            "energy"          : energy_result,
            "slag"            : {
                "mass_kg"     : gas_result["slag_mass_kg"],
                "composition" : "Vitrified inert material (SiO2, Al2O3, CaO)",
                "use"         : "Construction aggregate, road base material"
            },
            "summary"         : summary,
        }


# ─── Standalone test ──────────────────────────────────────────────────────────
if __name__ == "__main__":
    import json
    sim = PlasmaReactorSim()

    print("=== Simulating 1.5 kg plastic waste ===")
    result = sim.run("plastic", 1.5)

    print(f"Stages: {[s['stage'] for s in result['stages']]}")
    print(f"Electricity: {result['summary']['electricity_kwh']} kWh")
    print(f"Gas H2: {result['summary']['h2_pct']}%")
    print(json.dumps(result["summary"], indent=2))
