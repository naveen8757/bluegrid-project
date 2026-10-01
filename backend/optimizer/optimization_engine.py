"""
Optimization Engine Module
Core hybrid renewable optimization algorithm balancing Solar, Wind, OTEC, and Battery storage.
Performs demand matching, constraint-based sizing, suitability analysis, plant unit counts, and economic/carbon metrics.
"""

from typing import Dict, Any, Optional
import math
import backend.config as cfg
from .energy_model import calculate_energy_balance
from .battery_model import simulate_battery_dispatch, recommend_battery_sizing
from .scoring import calculate_optimization_score

def _determine_status(existing_val: float, rec_val: float) -> Dict[str, str]:
    """Determines suitability status badge and textual recommendation."""
    if rec_val <= 0:
        return {"code": "not_required", "badge": "⚪ Not Required", "color": "gray", "text": "Resource not prioritized for this island load."}

    if existing_val >= rec_val * 0.95:
        return {"code": "suitable", "badge": "🟢 Suitable", "color": "green", "text": "Existing infrastructure is sufficient for current targets."}
    elif existing_val > 0:
        gap = rec_val - existing_val
        return {"code": "expand", "badge": "🟡 Expand", "color": "amber", "text": f"Expansion required: add {gap:,.0f} units to reach optimal capacity."}
    else:
        return {"code": "insufficient", "badge": "🔴 Insufficient / Add New", "color": "red", "text": f"New plant installation required: develop {rec_val:,.0f} units."}

def run_optimization(
    # Demand
    peak_demand_mw: float,
    average_demand_mw: float,
    # Existing
    existing_solar_kw: float = 0.0,
    existing_wind_kw: float = 0.0,
    existing_otec_kw: float = 0.0,
    existing_battery_kwh: float = 0.0,
    existing_diesel_kw: float = 1000.0,
    # Maximum Potential / Limits
    max_solar_kw: Optional[float] = None,
    max_wind_kw: Optional[float] = None,
    max_otec_kw: Optional[float] = None,
    max_battery_kwh: Optional[float] = None,
    # Potentials (0.0 to 1.0)
    solar_potential: float = 0.22,
    wind_potential: float = 0.32,
    otec_potential: float = 0.80,
    # Targets
    target_renewable_pct: float = 85.0,
    target_reliability_pct: float = 99.5,
    # Configurable Capacity Factors
    solar_cf: float = cfg.DEFAULT_SOLAR_CF,
    wind_cf: float = cfg.DEFAULT_WIND_CF,
    otec_cf: float = cfg.DEFAULT_OTEC_CF,
    # Configurable Plant Unit Sizes
    solar_unit_kw: float = cfg.DEFAULT_SOLAR_UNIT_KW,
    wind_unit_kw: float = cfg.DEFAULT_WIND_UNIT_KW,
    otec_unit_kw: float = cfg.DEFAULT_OTEC_UNIT_KW,
    battery_unit_kwh: float = cfg.DEFAULT_BATTERY_UNIT_KWH
) -> Dict[str, Any]:
    """
    Executes full hybrid optimization for the given island microgrid parameters.
    """
    peak_kw = peak_demand_mw * 1000.0
    avg_kw = average_demand_mw * 1000.0

    # Default limits if not provided
    if max_solar_kw is None or max_solar_kw <= 0:
        max_solar_kw = peak_kw * 3.5
    if max_wind_kw is None or max_wind_kw <= 0:
        max_wind_kw = peak_kw * 2.5
    if max_otec_kw is None or max_otec_kw <= 0:
        max_otec_kw = avg_kw * 1.5 if otec_potential >= 0.50 else 0.0
    if max_battery_kwh is None or max_battery_kwh <= 0:
        max_battery_kwh = peak_kw * 12.0

    target_ratio = min(1.0, max(0.20, target_renewable_pct / 100.0))

    # --- 1. Sizing Heuristics based on Resource Potentials and Island Grid Dynamics ---
    # OTEC is prioritized for tropical islands with viable bathymetry:
    # Continuous 24/7 base load drastically reduces required battery storage and stabilizes grid frequency!
    if otec_potential >= 0.50:
        # Base load fraction targeted: 35% - 65% of average load
        target_otec_base = avg_kw * 0.55 * (otec_potential / 0.80) * target_ratio
        rec_otec_kw = min(max_otec_kw, max(existing_otec_kw, target_otec_base))
    else:
        rec_otec_kw = min(max_otec_kw, existing_otec_kw)

    # Remaining daytime and shoulder demand covered by Solar + Wind
    uncovered_avg_kw = max(0.0, avg_kw - (rec_otec_kw * otec_cf))

    # Solar: Peak daytime generation
    solar_scale = (solar_potential / 0.20) * 1.15 * target_ratio
    target_solar = (uncovered_avg_kw * 1.8 + peak_kw * 0.4) * solar_scale
    rec_solar_kw = min(max_solar_kw, max(existing_solar_kw, target_solar))

    # Wind: Complementary daytime and night generation
    if wind_potential >= 0.25:
        wind_scale = (wind_potential / 0.35) * target_ratio
        target_wind = uncovered_avg_kw * 0.85 * wind_scale
        rec_wind_kw = min(max_wind_kw, max(existing_wind_kw, target_wind))
    else:
        rec_wind_kw = min(max_wind_kw, existing_wind_kw)

    # Battery Storage:
    target_battery = recommend_battery_sizing(
        peak_demand_mw, average_demand_mw, rec_solar_kw, rec_wind_kw, rec_otec_kw, target_renewable_pct
    )
    rec_battery_kwh = min(max_battery_kwh, max(existing_battery_kwh, target_battery))

    # --- 2. Iterative Convergence to Meet Renewable & Reliability Targets ---
    best_dispatch = None
    best_balance = None

    for iteration in range(5):
        balance = calculate_energy_balance(
            average_demand_mw, peak_demand_mw,
            rec_solar_kw, rec_wind_kw, rec_otec_kw,
            solar_cf, wind_cf, otec_cf
        )
        dispatch = simulate_battery_dispatch(
            balance["demand_hourly_kw"],
            balance["total_renewable_hourly_kw"],
            rec_battery_kwh,
            existing_diesel_kw
        )

        achieved_ren_pct = dispatch["renewable_penetration_pct"]
        loss_of_load_pct = dispatch["loss_of_load_prob_pct"]

        # Check if targets satisfied
        if achieved_ren_pct >= target_renewable_pct and loss_of_load_pct <= (100.0 - target_reliability_pct):
            best_balance = balance
            best_dispatch = dispatch
            break

        # If shortfall, increment solar, wind, or battery moderately
        deficit_pct = target_renewable_pct - achieved_ren_pct
        if deficit_pct > 1.0:
            scale_step = 1.0 + min(0.20, deficit_pct / 100.0)
            if rec_solar_kw < max_solar_kw:
                rec_solar_kw = min(max_solar_kw, rec_solar_kw * scale_step)
            if rec_wind_kw < max_wind_kw and wind_potential >= 0.25:
                rec_wind_kw = min(max_wind_kw, rec_wind_kw * scale_step)
            if rec_battery_kwh < max_battery_kwh:
                rec_battery_kwh = min(max_battery_kwh, rec_battery_kwh * (scale_step ** 1.2))

        best_balance = balance
        best_dispatch = dispatch

    # Round capacities to clean numbers
    rec_solar_kw = round(rec_solar_kw, 0)
    rec_wind_kw = round(rec_wind_kw, 0)
    rec_otec_kw = round(rec_otec_kw, 0)
    rec_battery_kwh = round(rec_battery_kwh, 0)

    # Re-run final dispatch with clean numbers
    final_balance = calculate_energy_balance(
        average_demand_mw, peak_demand_mw,
        rec_solar_kw, rec_wind_kw, rec_otec_kw,
        solar_cf, wind_cf, otec_cf
    )
    final_dispatch = simulate_battery_dispatch(
        final_balance["demand_hourly_kw"],
        final_balance["total_renewable_hourly_kw"],
        rec_battery_kwh,
        existing_diesel_kw
    )

    # --- 3. Power Plant Suitability Analysis (Section 13) ---
    suitability = {
        "solar": {
            "name": "Solar Photovoltaic",
            "existing_kw": existing_solar_kw,
            "recommended_kw": rec_solar_kw,
            "expansion_kw": max(0.0, rec_solar_kw - existing_solar_kw),
            "potential_score": solar_potential,
            "status": _determine_status(existing_solar_kw, rec_solar_kw)
        },
        "wind": {
            "name": "Wind Energy",
            "existing_kw": existing_wind_kw,
            "recommended_kw": rec_wind_kw,
            "expansion_kw": max(0.0, rec_wind_kw - existing_wind_kw),
            "potential_score": wind_potential,
            "status": _determine_status(existing_wind_kw, rec_wind_kw)
        },
        "otec": {
            "name": "Ocean Thermal Energy (OTEC)",
            "existing_kw": existing_otec_kw,
            "recommended_kw": rec_otec_kw,
            "expansion_kw": max(0.0, rec_otec_kw - existing_otec_kw),
            "potential_score": otec_potential,
            "status": _determine_status(existing_otec_kw, rec_otec_kw)
        },
        "battery": {
            "name": "Battery Storage (BESS)",
            "existing_kwh": existing_battery_kwh,
            "recommended_kwh": rec_battery_kwh,
            "expansion_kwh": max(0.0, rec_battery_kwh - existing_battery_kwh),
            "potential_score": 0.95,
            "status": _determine_status(existing_battery_kwh, rec_battery_kwh)
        },
        "diesel": {
            "name": "Diesel Backup Generator",
            "existing_kw": existing_diesel_kw,
            "recommended_kw": round(peak_kw * 0.9, 0),  # retained as emergency standby
            "status": {
                "badge": "Standby Reserve",
                "color": "blue",
                "text": "Retained strictly as cold standby emergency backup."
            }
        }
    }

    # --- 4. Plant Unit Sizing & Counts (Section 14) ---
    existing_plants = {
        "solar_plants": math.ceil(existing_solar_kw / solar_unit_kw) if existing_solar_kw > 0 else 0,
        "wind_plants": math.ceil(existing_wind_kw / wind_unit_kw) if existing_wind_kw > 0 else 0,
        "otec_plants": math.ceil(existing_otec_kw / otec_unit_kw) if existing_otec_kw > 0 else 0,
        "battery_systems": math.ceil(existing_battery_kwh / battery_unit_kwh) if existing_battery_kwh > 0 else 0,
        "diesel_gensets": math.ceil(existing_diesel_kw / cfg.DEFAULT_DIESEL_UNIT_KW) if existing_diesel_kw > 0 else 0
    }

    recommended_plants = {
        "solar_plants": math.ceil(rec_solar_kw / solar_unit_kw) if rec_solar_kw > 0 else 0,
        "wind_plants": math.ceil(rec_wind_kw / wind_unit_kw) if rec_wind_kw > 0 else 0,
        "otec_plants": math.ceil(rec_otec_kw / otec_unit_kw) if rec_otec_kw > 0 else 0,
        "battery_systems": math.ceil(rec_battery_kwh / battery_unit_kwh) if rec_battery_kwh > 0 else 0,
        "diesel_gensets": existing_plants["diesel_gensets"]
    }

    additional_plants = {
        "solar_plants": max(0, recommended_plants["solar_plants"] - existing_plants["solar_plants"]),
        "wind_plants": max(0, recommended_plants["wind_plants"] - existing_plants["wind_plants"]),
        "otec_plants": max(0, recommended_plants["otec_plants"] - existing_plants["otec_plants"]),
        "battery_systems": max(0, recommended_plants["battery_systems"] - existing_plants["battery_systems"])
    }

    # --- 5. Energy Mix Percentages & Breakdown ---
    annual_solar_mwh = final_balance["annual_solar_mwh"]
    annual_wind_mwh = final_balance["annual_wind_mwh"]
    annual_otec_mwh = final_balance["annual_otec_mwh"]
    annual_diesel_mwh = final_dispatch["annual_diesel_mwh"]
    annual_demand_mwh = final_balance["annual_demand_mwh"]

    # Effective generation mix delivered to load
    total_effective_mwh = annual_solar_mwh + annual_wind_mwh + annual_otec_mwh + annual_diesel_mwh
    if total_effective_mwh > 0:
        solar_pct = round((annual_solar_mwh / total_effective_mwh) * 100.0, 1)
        wind_pct = round((annual_wind_mwh / total_effective_mwh) * 100.0, 1)
        otec_pct = round((annual_otec_mwh / total_effective_mwh) * 100.0, 1)
        diesel_pct = round((annual_diesel_mwh / total_effective_mwh) * 100.0, 1)
    else:
        solar_pct = wind_pct = otec_pct = 0.0
        diesel_pct = 100.0

    battery_throughput_mwh = round((sum(final_dispatch["discharge_kw"]) * 365.0) / 1000.0, 2)
    battery_fraction_demand_pct = round((battery_throughput_mwh / annual_demand_mwh * 100.0) if annual_demand_mwh > 0 else 0.0, 1)

    energy_mix = {
        "solar_pct": solar_pct,
        "wind_pct": wind_pct,
        "otec_pct": otec_pct,
        "battery_pct": battery_fraction_demand_pct,
        "diesel_pct": diesel_pct,
        "renewable_total_pct": round(solar_pct + wind_pct + otec_pct, 1)
    }

    # --- 6. Environmental and Diesel Reduction Metrics ---
    # Baseline: 100% Diesel Generation
    baseline_diesel_liters = annual_demand_mwh * 1000.0 * cfg.DIESEL_LITERS_PER_KWH
    actual_diesel_liters = annual_diesel_mwh * 1000.0 * cfg.DIESEL_LITERS_PER_KWH
    diesel_liters_saved = max(0.0, baseline_diesel_liters - actual_diesel_liters)
    diesel_reduction_pct = round(((baseline_diesel_liters - actual_diesel_liters) / baseline_diesel_liters * 100.0) if baseline_diesel_liters > 0 else 0.0, 1)

    co2_reduction_tons = round(((annual_demand_mwh - annual_diesel_mwh) * 1000.0 * cfg.DIESEL_EMISSIONS_KG_PER_KWH) / 1000.0, 1)
    annual_fuel_cost_saved_usd = round(diesel_liters_saved * cfg.DIESEL_COST_USD_PER_LITER, 0)
    annual_fuel_cost_saved_inr = round(annual_fuel_cost_saved_usd * 86.5, 0)

    # --- 7. Optimization Scoring (Section 12) ---
    total_capacity_kw = rec_solar_kw + rec_wind_kw + rec_otec_kw
    score_result = calculate_optimization_score(
        renewable_fraction=final_dispatch["renewable_penetration_pct"] / 100.0,
        unmet_fraction=final_dispatch["loss_of_load_prob_pct"] / 100.0,
        diesel_reduction_ratio=diesel_reduction_pct / 100.0,
        curtailment_fraction=min(1.0, final_dispatch["annual_curtailed_mwh"] / (final_balance["annual_ren_mwh"] + 0.1)),
        total_installed_capacity_kw=total_capacity_kw,
        peak_demand_kw=peak_kw
    )

    return {
        "status": "success",
        "inputs": {
            "peak_demand_mw": peak_demand_mw,
            "average_demand_mw": average_demand_mw,
            "target_renewable_pct": target_renewable_pct,
            "target_reliability_pct": target_reliability_pct,
            "solar_cf": solar_cf,
            "wind_cf": wind_cf,
            "otec_cf": otec_cf,
            "plant_unit_capacities": {
                "solar_kw": solar_unit_kw,
                "wind_kw": wind_unit_kw,
                "otec_kw": otec_unit_kw,
                "battery_kwh": battery_unit_kwh
            }
        },
        "recommended_capacities": {
            "solar_kw": rec_solar_kw,
            "wind_kw": rec_wind_kw,
            "otec_kw": rec_otec_kw,
            "battery_kwh": rec_battery_kwh,
            "diesel_standby_kw": round(peak_kw * 0.9, 0),
            "total_renewable_capacity_kw": total_capacity_kw
        },
        "suitability": suitability,
        "plant_counts": {
            "existing": existing_plants,
            "recommended": recommended_plants,
            "additions_required": additional_plants,
            "unit_specs": {
                "solar_unit_kw": solar_unit_kw,
                "wind_unit_kw": wind_unit_kw,
                "otec_unit_kw": otec_unit_kw,
                "battery_unit_kwh": battery_unit_kwh
            }
        },
        "energy_mix": energy_mix,
        "energy_balance": final_balance,
        "dispatch_simulation": final_dispatch,
        "environmental_impact": {
            "diesel_reduction_pct": diesel_reduction_pct,
            "diesel_liters_saved_annual": round(diesel_liters_saved, 0),
            "baseline_diesel_liters": round(baseline_diesel_liters, 0),
            "actual_diesel_liters": round(actual_diesel_liters, 0),
            "co2_reduction_tons_annual": co2_reduction_tons,
            "fuel_cost_savings_usd": annual_fuel_cost_saved_usd,
            "fuel_cost_savings_inr": annual_fuel_cost_saved_inr
        },
        "optimization_score": score_result
    }

def run_simulation(
    demand_multiplier: float = 1.0,
    solar_kw: float = 500.0,
    wind_kw: float = 200.0,
    otec_kw: float = 250.0,
    battery_kwh: float = 1000.0,
    base_avg_demand_mw: float = 0.50,
    base_peak_demand_mw: float = 0.80,
    solar_cf: float = cfg.DEFAULT_SOLAR_CF,
    wind_cf: float = cfg.DEFAULT_WIND_CF,
    otec_cf: float = cfg.DEFAULT_OTEC_CF
) -> Dict[str, Any]:
    """
    High-speed simulation runner for interactive sliders.
    """
    sim_avg_mw = base_avg_demand_mw * demand_multiplier
    sim_peak_mw = base_peak_demand_mw * demand_multiplier

    balance = calculate_energy_balance(
        sim_avg_mw, sim_peak_mw,
        solar_kw, wind_kw, otec_kw,
        solar_cf, wind_cf, otec_cf
    )
    dispatch = simulate_battery_dispatch(
        balance["demand_hourly_kw"],
        balance["total_renewable_hourly_kw"],
        battery_kwh,
        existing_diesel_kw=sim_peak_mw * 1000.0
    )

    annual_demand = balance["annual_demand_mwh"]
    annual_diesel = dispatch["annual_diesel_mwh"]
    baseline_diesel_liters = annual_demand * 1000.0 * cfg.DIESEL_LITERS_PER_KWH
    actual_diesel_liters = annual_diesel * 1000.0 * cfg.DIESEL_LITERS_PER_KWH
    diesel_reduction_pct = round(((baseline_diesel_liters - actual_diesel_liters) / baseline_diesel_liters * 100.0) if baseline_diesel_liters > 0 else 0.0, 1)
    co2_reduction_tons = round(((annual_demand - annual_diesel) * 1000.0 * cfg.DIESEL_EMISSIONS_KG_PER_KWH) / 1000.0, 1)

    score_result = calculate_optimization_score(
        renewable_fraction=dispatch["renewable_penetration_pct"] / 100.0,
        unmet_fraction=dispatch["loss_of_load_prob_pct"] / 100.0,
        diesel_reduction_ratio=diesel_reduction_pct / 100.0,
        curtailment_fraction=min(1.0, dispatch["annual_curtailed_mwh"] / (balance["annual_ren_mwh"] + 0.1)),
        total_installed_capacity_kw=solar_kw + wind_kw + otec_kw,
        peak_demand_kw=sim_peak_mw * 1000.0
    )

    return {
        "status": "success",
        "demand_multiplier": demand_multiplier,
        "effective_avg_demand_mw": round(sim_avg_mw, 3),
        "effective_peak_demand_mw": round(sim_peak_mw, 3),
        "solar_kw": solar_kw,
        "wind_kw": wind_kw,
        "otec_kw": otec_kw,
        "battery_kwh": battery_kwh,
        "renewable_penetration_pct": dispatch["renewable_penetration_pct"],
        "loss_of_load_prob_pct": dispatch["loss_of_load_prob_pct"],
        "diesel_reduction_pct": diesel_reduction_pct,
        "co2_reduction_tons": co2_reduction_tons,
        "annual_energy_mwh": balance["annual_ren_mwh"],
        "score": score_result["total_score"],
        "score_details": score_result,
        "balance": balance,
        "dispatch": dispatch
    }
