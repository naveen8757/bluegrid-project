"""
Optimization and Simulation API Routes
Handles execution of AI optimization, simulation recalculations, and run history retrieval.
"""

from flask import Blueprint, request, jsonify
import json
from backend.database import get_db_connection, get_settings_dict
from backend.optimizer import run_optimization, run_simulation
import backend.config as cfg

optimize_bp = Blueprint("optimize", __name__, url_prefix="/api")

@optimize_bp.route("/optimize", methods=["POST"])
def optimize():
    """
    Runs full hybrid optimization.
    Optionally accepts island_id to pull island baseline attributes.
    Saves the run into SQLite database and returns detailed result payload.
    """
    data = request.get_json() or {}
    island_id = data.get("island_id")
    settings = get_settings_dict()

    # Load island baseline if provided
    island_name = "Custom Island"
    peak_demand_mw = float(data.get("peak_demand_mw", 0.70))
    avg_demand_mw = float(data.get("average_demand_mw", 0.45))
    existing_solar_kw = float(data.get("existing_solar_kw", 0))
    existing_wind_kw = float(data.get("existing_wind_kw", 0))
    existing_otec_kw = float(data.get("existing_otec_kw", 0))
    existing_battery_kwh = float(data.get("battery_kwh", 0))
    existing_diesel_kw = float(data.get("existing_diesel_kw", 1000))
    solar_potential = float(data.get("solar_potential", 0.22))
    wind_potential = float(data.get("wind_potential", 0.32))
    otec_potential = float(data.get("otec_potential", 0.80))

    if island_id:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM islands WHERE id = ?", (island_id,))
        island = cursor.fetchone()
        conn.close()
        if island:
            island_name = island["name"]
            # If user didn't override demand/existing fields, use island values
            if "peak_demand_mw" not in data:
                peak_demand_mw = float(island["peak_demand_mw"])
            if "average_demand_mw" not in data:
                avg_demand_mw = float(island["average_demand_mw"])
            if "existing_solar_kw" not in data:
                existing_solar_kw = float(island["existing_solar_kw"])
            if "existing_wind_kw" not in data:
                existing_wind_kw = float(island["existing_wind_kw"])
            if "existing_otec_kw" not in data:
                existing_otec_kw = float(island["existing_otec_kw"])
            if "battery_kwh" not in data:
                existing_battery_kwh = float(island["battery_kwh"])
            if "existing_diesel_kw" not in data:
                existing_diesel_kw = float(island["existing_diesel_kw"])
            if "solar_potential" not in data:
                solar_potential = float(island["solar_potential"])
            if "wind_potential" not in data:
                wind_potential = float(island["wind_potential"])
            if "otec_potential" not in data:
                otec_potential = float(island["otec_potential"])

    # Capacity factor overrides or DB settings
    solar_cf = float(data.get("solar_cf", settings.get("SOLAR_CF", cfg.DEFAULT_SOLAR_CF)))
    wind_cf = float(data.get("wind_cf", settings.get("WIND_CF", cfg.DEFAULT_WIND_CF)))
    otec_cf = float(data.get("otec_cf", settings.get("OTEC_CF", cfg.DEFAULT_OTEC_CF)))

    # Plant unit sizes
    solar_unit_kw = float(data.get("solar_unit_kw", settings.get("SOLAR_PLANT_UNIT_KW", cfg.DEFAULT_SOLAR_UNIT_KW)))
    wind_unit_kw = float(data.get("wind_unit_kw", settings.get("WIND_PLANT_UNIT_KW", cfg.DEFAULT_WIND_UNIT_KW)))
    otec_unit_kw = float(data.get("otec_unit_kw", settings.get("OTEC_PLANT_UNIT_KW", cfg.DEFAULT_OTEC_UNIT_KW)))
    battery_unit_kwh = float(data.get("battery_unit_kwh", settings.get("BATTERY_SYSTEM_UNIT_KWH", cfg.DEFAULT_BATTERY_UNIT_KWH)))

    # Targets & Constraints
    target_renewable_pct = float(data.get("target_renewable_pct", 85.0))
    target_reliability_pct = float(data.get("target_reliability_pct", 99.5))
    max_solar_kw = float(data.get("max_solar_kw", 0)) or None
    max_wind_kw = float(data.get("max_wind_kw", 0)) or None
    max_otec_kw = float(data.get("max_otec_kw", 0)) or None
    max_battery_kwh = float(data.get("max_battery_kwh", 0)) or None

    # Run the core optimization engine
    result = run_optimization(
        peak_demand_mw=peak_demand_mw,
        average_demand_mw=avg_demand_mw,
        existing_solar_kw=existing_solar_kw,
        existing_wind_kw=existing_wind_kw,
        existing_otec_kw=existing_otec_kw,
        existing_battery_kwh=existing_battery_kwh,
        existing_diesel_kw=existing_diesel_kw,
        max_solar_kw=max_solar_kw,
        max_wind_kw=max_wind_kw,
        max_otec_kw=max_otec_kw,
        max_battery_kwh=max_battery_kwh,
        solar_potential=solar_potential,
        wind_potential=wind_potential,
        otec_potential=otec_potential,
        target_renewable_pct=target_renewable_pct,
        target_reliability_pct=target_reliability_pct,
        solar_cf=solar_cf,
        wind_cf=wind_cf,
        otec_cf=otec_cf,
        solar_unit_kw=solar_unit_kw,
        wind_unit_kw=wind_unit_kw,
        otec_unit_kw=otec_unit_kw,
        battery_unit_kwh=battery_unit_kwh
    )

    result["island_name"] = island_name
    result["island_id"] = island_id

    # Persist into SQLite optimization_runs table (Section 20 requirement: Do not pretend data is stored)
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO optimization_runs (
            island_id, island_name, peak_demand_mw, average_demand_mw,
            solar_kw, wind_kw, otec_kw, battery_kwh, diesel_kw,
            renewable_percent, diesel_reduction, co2_reduction_tons,
            annual_energy_mwh, unmet_load_kwh, score, plant_counts_json, details_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            island_id,
            island_name,
            peak_demand_mw,
            avg_demand_mw,
            result["recommended_capacities"]["solar_kw"],
            result["recommended_capacities"]["wind_kw"],
            result["recommended_capacities"]["otec_kw"],
            result["recommended_capacities"]["battery_kwh"],
            result["recommended_capacities"]["diesel_standby_kw"],
            result["energy_mix"]["renewable_total_pct"],
            result["environmental_impact"]["diesel_reduction_pct"],
            result["environmental_impact"]["co2_reduction_tons_annual"],
            result["energy_balance"]["annual_ren_mwh"],
            result["dispatch_simulation"]["annual_unmet_mwh"] * 1000.0,
            result["optimization_score"]["total_score"],
            json.dumps(result["plant_counts"]),
            json.dumps(result)
        ))
        run_id = cursor.lastrowid
        conn.commit()
        conn.close()
        result["run_id"] = run_id
    except Exception as e:
        print(f"Warning: Failed to persist optimization run to DB: {e}")
        result["run_id"] = None

    return jsonify(result)

@optimize_bp.route("/simulate", methods=["POST"])
def simulate():
    """
    Executes live slider simulation without page reload.
    """
    data = request.get_json() or {}
    demand_multiplier = float(data.get("demand_multiplier", 1.0))
    solar_kw = float(data.get("solar_kw", 500.0))
    wind_kw = float(data.get("wind_kw", 200.0))
    otec_kw = float(data.get("otec_kw", 250.0))
    battery_kwh = float(data.get("battery_kwh", 1000.0))
    base_avg_demand_mw = float(data.get("base_avg_demand_mw", 0.50))
    base_peak_demand_mw = float(data.get("base_peak_demand_mw", 0.80))

    settings = get_settings_dict()
    solar_cf = float(data.get("solar_cf", settings.get("SOLAR_CF", cfg.DEFAULT_SOLAR_CF)))
    wind_cf = float(data.get("wind_cf", settings.get("WIND_CF", cfg.DEFAULT_WIND_CF)))
    otec_cf = float(data.get("otec_cf", settings.get("OTEC_CF", cfg.DEFAULT_OTEC_CF)))

    sim_res = run_simulation(
        demand_multiplier=demand_multiplier,
        solar_kw=solar_kw,
        wind_kw=wind_kw,
        otec_kw=otec_kw,
        battery_kwh=battery_kwh,
        base_avg_demand_mw=base_avg_demand_mw,
        base_peak_demand_mw=base_peak_demand_mw,
        solar_cf=solar_cf,
        wind_cf=wind_cf,
        otec_cf=otec_cf
    )

    # Save to simulation_runs
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO simulation_runs (
            island_id, island_name, demand_multiplier, solar_cf, wind_cf, otec_cf,
            solar_kw, wind_kw, otec_kw, battery_kwh, renewable_percent,
            diesel_reduction, co2_reduction_tons, score
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data.get("island_id"),
            data.get("island_name", "Simulation"),
            demand_multiplier,
            solar_cf, wind_cf, otec_cf,
            solar_kw, wind_kw, otec_kw, battery_kwh,
            sim_res["renewable_penetration_pct"],
            sim_res["diesel_reduction_pct"],
            sim_res["co2_reduction_tons"],
            sim_res["score"]
        ))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Warning: Failed to log simulation run: {e}")

    return jsonify(sim_res)

@optimize_bp.route("/results", methods=["GET"])
def get_results():
    """Returns recent optimization history."""
    limit = int(request.args.get("limit", 20))
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT id, island_id, island_name, created_at, peak_demand_mw, average_demand_mw,
           solar_kw, wind_kw, otec_kw, battery_kwh, renewable_percent, diesel_reduction,
           co2_reduction_tons, score
    FROM optimization_runs
    ORDER BY created_at DESC
    LIMIT ?
    """, (limit,))
    rows = cursor.fetchall()
    conn.close()
    return jsonify({
        "status": "success",
        "results": [dict(r) for r in rows]
    })

@optimize_bp.route("/results/<int:run_id>", methods=["GET"])
def get_result_detail(run_id):
    """Retrieves full details of a specific saved optimization run."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM optimization_runs WHERE id = ?", (run_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return jsonify({"status": "error", "message": "Result not found"}), 404

    data = dict(row)
    if data.get("details_json"):
        try:
            data["details"] = json.loads(data["details_json"])
        except Exception:
            pass

    return jsonify({
        "status": "success",
        "result": data
    })
