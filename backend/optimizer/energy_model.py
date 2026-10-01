"""
Energy Modeling Module
Calculates diurnal power curves, renewable generation profiles, and annual energy balances.
"""

from typing import List, Dict, Any
import backend.config as cfg

def get_hourly_demand(avg_demand_mw: float, peak_demand_mw: float) -> List[float]:
    """
    Computes a realistic 24-hour diurnal demand curve in kW.
    Normalizes the demand profile so the mean equals avg_demand and peak aligns with peak_demand.
    """
    profile = cfg.HOURLY_DEMAND_PROFILE
    profile_mean = sum(profile) / len(profile)
    profile_peak = max(profile)

    target_avg_kw = avg_demand_mw * 1000.0
    target_peak_kw = peak_demand_mw * 1000.0

    # Scale so average matches target_avg_kw, then smoothly cap/blend towards peak
    hourly_kw = []
    for val in profile:
        scaled = target_avg_kw * (val / profile_mean)
        # Apply gentle adjustment so peak matches target_peak_kw
        if scaled > target_peak_kw:
            scaled = target_peak_kw
        hourly_kw.append(round(scaled, 1))

    # Ensure peak hour actually hits the designated peak
    peak_idx = profile.index(profile_peak)
    hourly_kw[peak_idx] = round(target_peak_kw, 1)

    return hourly_kw

def get_hourly_renewable_generation(
    solar_kw: float,
    wind_kw: float,
    otec_kw: float,
    solar_cf: float = cfg.DEFAULT_SOLAR_CF,
    wind_cf: float = cfg.DEFAULT_WIND_CF,
    otec_cf: float = cfg.DEFAULT_OTEC_CF
) -> Dict[str, List[float]]:
    """
    Computes 24-hour generation curves for Solar, Wind, and OTEC in kW.
    """
    solar_profile = cfg.HOURLY_SOLAR_PROFILE
    mean_solar = sum(solar_profile) / len(solar_profile)
    # Scale solar so average over 24h equals solar_kw * solar_cf
    solar_hourly = [
        round(solar_kw * (val / mean_solar) * solar_cf, 1) if mean_solar > 0 else 0.0
        for val in solar_profile
    ]

    wind_profile = cfg.HOURLY_WIND_PROFILE
    mean_wind = sum(wind_profile) / len(wind_profile)
    wind_hourly = [
        round(wind_kw * (val / mean_wind) * wind_cf, 1) if mean_wind > 0 else 0.0
        for val in wind_profile
    ]

    # OTEC is high-availability continuous baseload (24/7)
    otec_hourly = [
        round(otec_kw * otec_cf, 1)
        for _ in range(24)
    ]

    total_ren_hourly = [
        round(s + w + o, 1)
        for s, w, o in zip(solar_hourly, wind_hourly, otec_hourly)
    ]

    return {
        "solar": solar_hourly,
        "wind": wind_hourly,
        "otec": otec_hourly,
        "total_renewable": total_ren_hourly
    }

def calculate_energy_balance(
    avg_demand_mw: float,
    peak_demand_mw: float,
    solar_kw: float,
    wind_kw: float,
    otec_kw: float,
    solar_cf: float = cfg.DEFAULT_SOLAR_CF,
    wind_cf: float = cfg.DEFAULT_WIND_CF,
    otec_cf: float = cfg.DEFAULT_OTEC_CF
) -> Dict[str, Any]:
    """
    Computes diurnal hourly load, hourly generation, net deficit/surplus, and annual statistics.
    """
    demand_hourly = get_hourly_demand(avg_demand_mw, peak_demand_mw)
    gen = get_hourly_renewable_generation(solar_kw, wind_kw, otec_kw, solar_cf, wind_cf, otec_cf)

    surplus_hourly = []
    deficit_hourly = []

    for d, r in zip(demand_hourly, gen["total_renewable"]):
        net = r - d
        if net > 0:
            surplus_hourly.append(round(net, 1))
            deficit_hourly.append(0.0)
        else:
            surplus_hourly.append(0.0)
            deficit_hourly.append(round(abs(net), 1))

    # Annual Energy (MWh/year)
    annual_demand_mwh = avg_demand_mw * 8760.0
    annual_solar_mwh = (solar_kw * solar_cf * 8760.0) / 1000.0
    annual_wind_mwh = (wind_kw * wind_cf * 8760.0) / 1000.0
    annual_otec_mwh = (otec_kw * otec_cf * 8760.0) / 1000.0
    annual_ren_mwh = annual_solar_mwh + annual_wind_mwh + annual_otec_mwh

    return {
        "hours": list(range(24)),
        "demand_hourly_kw": demand_hourly,
        "solar_hourly_kw": gen["solar"],
        "wind_hourly_kw": gen["wind"],
        "otec_hourly_kw": gen["otec"],
        "total_renewable_hourly_kw": gen["total_renewable"],
        "surplus_hourly_kw": surplus_hourly,
        "deficit_hourly_kw": deficit_hourly,
        "annual_demand_mwh": round(annual_demand_mwh, 2),
        "annual_solar_mwh": round(annual_solar_mwh, 2),
        "annual_wind_mwh": round(annual_wind_mwh, 2),
        "annual_otec_mwh": round(annual_otec_mwh, 2),
        "annual_ren_mwh": round(annual_ren_mwh, 2)
    }
