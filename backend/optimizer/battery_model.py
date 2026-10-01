"""
Battery Storage & Dispatch Simulation Module
Models hourly charging, discharging, state-of-charge (SOC), degradation constraints, and diesel backup dispatch.
"""

from typing import List, Dict, Any
import math
import backend.config as cfg

def simulate_battery_dispatch(
    demand_hourly_kw: List[float],
    ren_gen_hourly_kw: List[float],
    battery_kwh: float,
    existing_diesel_kw: float = 1000.0,
    roundtrip_eff: float = cfg.BATTERY_ROUNDTRIP_EFFICIENCY,
    min_soc_pct: float = cfg.BATTERY_MIN_SOC
) -> Dict[str, Any]:
    """
    Simulates a 24-hour dispatch cycle with cyclic state-of-charge continuity.
    Uses 2-pass convergence to find stable initial SOC for diurnal balance.
    """
    eff_one_way = math.sqrt(roundtrip_eff)  # ~0.938 for 0.88 roundtrip
    min_soc_kwh = battery_kwh * min_soc_pct
    max_soc_kwh = battery_kwh
    usable_kwh = max_soc_kwh - min_soc_kwh

    # Max charge/discharge power limit (0.5C to 1C standard BESS inverter rating)
    max_c_rate_power_kw = battery_kwh * 0.5 if battery_kwh > 0 else 0.0

    # 2-pass loop to settle initial diurnal SOC
    soc = min_soc_kwh + usable_kwh * 0.40  # start at 40% usable
    last_run_results = {}

    for _ in range(2):
        battery_soc_kwh = []
        battery_soc_pct = []
        charge_kw = []
        discharge_kw = []
        diesel_gen_kw = []
        curtailed_kw = []
        unmet_kw = []

        for d, r in zip(demand_hourly_kw, ren_gen_hourly_kw):
            net = r - d  # Positive = surplus, Negative = deficit

            if net > 0:
                # Surplus: Charge battery
                surplus_power = net
                max_charge_energy_acceptable = (max_soc_kwh - soc) / eff_one_way
                charge_power = min(surplus_power, max_c_rate_power_kw, max_charge_energy_acceptable)
                actual_stored_energy = charge_power * eff_one_way
                soc += actual_stored_energy
                soc = min(max_soc_kwh, soc)

                dumped = surplus_power - charge_power

                charge_kw.append(round(charge_power, 1))
                discharge_kw.append(0.0)
                diesel_gen_kw.append(0.0)
                curtailed_kw.append(round(dumped, 1))
                unmet_kw.append(0.0)

            else:
                # Deficit: Discharge battery first, then dispatch diesel generator
                needed_power = abs(net)
                max_discharge_energy_available = (soc - min_soc_kwh) * eff_one_way
                discharge_power = min(needed_power, max_c_rate_power_kw, max_discharge_energy_available)
                actual_depleted_energy = discharge_power / eff_one_way
                soc -= actual_depleted_energy
                soc = max(min_soc_kwh, soc)

                remaining_deficit = needed_power - discharge_power

                # Diesel backup generator kicks in to supply remaining deficit
                diesel_supply = min(remaining_deficit, existing_diesel_kw)
                unmet = remaining_deficit - diesel_supply

                charge_kw.append(0.0)
                discharge_kw.append(round(discharge_power, 1))
                diesel_gen_kw.append(round(diesel_supply, 1))
                curtailed_kw.append(0.0)
                unmet_kw.append(round(max(0.0, unmet), 1))

            battery_soc_kwh.append(round(soc, 1))
            pct = (soc / battery_kwh * 100.0) if battery_kwh > 0 else 0.0
            battery_soc_pct.append(round(pct, 1))

        last_run_results = {
            "battery_soc_kwh": battery_soc_kwh,
            "battery_soc_pct": battery_soc_pct,
            "charge_kw": charge_kw,
            "discharge_kw": discharge_kw,
            "diesel_gen_kw": diesel_gen_kw,
            "curtailed_kw": curtailed_kw,
            "unmet_kw": unmet_kw
        }

    # Summary statistics
    total_demand_kwh = sum(demand_hourly_kw)
    total_diesel_kwh = sum(last_run_results["diesel_gen_kw"])
    total_ren_served_kwh = total_demand_kwh - total_diesel_kwh - sum(last_run_results["unmet_kw"])
    total_curtailed_kwh = sum(last_run_results["curtailed_kw"])
    total_unmet_kwh = sum(last_run_results["unmet_kw"])

    daily_ren_fraction = (total_ren_served_kwh / total_demand_kwh) if total_demand_kwh > 0 else 0.0
    daily_ren_fraction = max(0.0, min(1.0, daily_ren_fraction))

    # Scale to annual totals (365 days)
    annual_diesel_mwh = (total_diesel_kwh * 365.0) / 1000.0
    annual_unmet_mwh = (total_unmet_kwh * 365.0) / 1000.0
    annual_curtailed_mwh = (total_curtailed_kwh * 365.0) / 1000.0

    return {
        **last_run_results,
        "daily_demand_kwh": round(total_demand_kwh, 1),
        "daily_diesel_kwh": round(total_diesel_kwh, 1),
        "daily_renewable_served_kwh": round(total_ren_served_kwh, 1),
        "daily_curtailed_kwh": round(total_curtailed_kwh, 1),
        "daily_unmet_kwh": round(total_unmet_kwh, 1),
        "annual_diesel_mwh": round(annual_diesel_mwh, 2),
        "annual_unmet_mwh": round(annual_unmet_mwh, 2),
        "annual_curtailed_mwh": round(annual_curtailed_mwh, 2),
        "renewable_penetration_pct": round(daily_ren_fraction * 100.0, 1),
        "loss_of_load_prob_pct": round((total_unmet_kwh / total_demand_kwh * 100.0) if total_demand_kwh > 0 else 0.0, 3)
    }

def recommend_battery_sizing(
    peak_demand_mw: float,
    avg_demand_mw: float,
    solar_kw: float,
    wind_kw: float,
    otec_kw: float,
    target_ren_pct: float = 90.0,
    autonomy_hours: float = cfg.BATTERY_HOURS_TARGET
) -> float:
    """
    Determines recommended battery capacity (kWh) based on night peak buffer,
    diurnal solar overproduction absorption, and target autonomy.
    """
    avg_load_kw = avg_demand_mw * 1000.0

    # If OTEC capacity is substantial, OTEC provides continuous 24/7 power,
    # drastically reducing the required battery size!
    uncovered_night_load_kw = max(0.0, avg_load_kw - (otec_kw * cfg.DEFAULT_OTEC_CF))

    # Base storage needed to cover night hours (e.g. 5-7 hours without solar)
    storage_for_autonomy = uncovered_night_load_kw * autonomy_hours

    # Solar excess buffer: Solar midday peak generation can be stored
    solar_peak_surplus_kw = max(0.0, solar_kw - avg_load_kw)
    storage_for_solar = solar_peak_surplus_kw * 3.5

    # Target capacity accounting for DoD (85%)
    raw_capacity_kwh = max(storage_for_autonomy, storage_for_solar * 0.75) / cfg.BATTERY_MAX_DOD

    # Scale with renewable target
    ren_target_factor = (target_ren_pct / 100.0) ** 1.3
    recommended_kwh = raw_capacity_kwh * ren_target_factor

    # Round to nearest 50 kWh module
    module_size = 50.0
    recommended_kwh = math.ceil(recommended_kwh / module_size) * module_size

    # Sensible bounds
    min_bound = round(avg_load_kw * 1.5, 0)
    max_bound = round(peak_demand_mw * 1000.0 * 12.0, 0)
    return float(max(min_bound, min(max_bound, recommended_kwh)))
