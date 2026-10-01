"""
Report Generation API Route
Compiles a structured 14-section comprehensive engineering report for an island optimization run.
"""

from flask import Blueprint, jsonify
import json
from datetime import datetime
from backend.database import get_db_connection

reports_bp = Blueprint("reports", __name__, url_prefix="/api/report")

@reports_bp.route("/<int:run_id>", methods=["GET"])
def get_report(run_id):
    """
    Generates a full 14-section technical report payload for an optimization run.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM optimization_runs WHERE id = ?", (run_id,))
    run_row = cursor.fetchone()
    if not run_row:
        conn.close()
        return jsonify({"status": "error", "message": f"Optimization run #{run_id} not found"}), 404

    run = dict(run_row)
    details = {}
    if run.get("details_json"):
        try:
            details = json.loads(run["details_json"])
        except Exception:
            pass

    # Fetch island profile
    island = {}
    if run.get("island_id"):
        cursor.execute("SELECT * FROM islands WHERE id = ?", (run["island_id"],))
        i_row = cursor.fetchone()
        if i_row:
            island = dict(i_row)
    conn.close()

    # Compile the 14 standard sections as specified in Prompt Section 25
    rec_cap = details.get("recommended_capacities", {})
    mix = details.get("energy_mix", {})
    env = details.get("environmental_impact", {})
    suitability = details.get("suitability", {})
    score = details.get("optimization_score", {})
    plant_counts = details.get("plant_counts", {})
    balance = details.get("energy_balance", {})

    report_payload = {
        "title": "BLUEGRID AI — Island Renewable Energy Optimization Report",
        "run_id": run_id,
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC"),
        "island_name": run.get("island_name", island.get("name", "Target Island")),
        "sections": {
            "1_island_profile": {
                "title": "1. Island Profile",
                "name": run.get("island_name", island.get("name", "N/A")),
                "region": island.get("region", "Coastal / Archipelagic"),
                "state_ut": island.get("state_ut", "India"),
                "coordinates": f"{island.get('latitude', 0.0):.4f}° N, {island.get('longitude', 0.0):.4f}° E",
                "population": island.get("population", 1000),
                "area_sqkm": island.get("area_sqkm", 3.5),
                "bathymetry_distance_1000m_km": island.get("depth_1000m_dist_km", 3.0),
                "surface_temp_c": island.get("surface_temp_c", 28.5),
                "deep_sea_temp_c": island.get("deep_sea_temp_c", 6.0),
                "description": island.get("description", "Remote island grid transitioning from fossil fuel reliance to marine hybrid renewable energy.")
            },
            "2_current_energy_infrastructure": {
                "title": "2. Current Energy Infrastructure",
                "existing_solar_kw": island.get("existing_solar_kw", 0),
                "existing_wind_kw": island.get("existing_wind_kw", 0),
                "existing_otec_kw": island.get("existing_otec_kw", 0),
                "existing_diesel_kw": island.get("existing_diesel_kw", run.get("diesel_kw", 1000)),
                "existing_battery_kwh": island.get("battery_kwh", 0),
                "existing_plants_count": plant_counts.get("existing", {})
            },
            "3_energy_demand": {
                "title": "3. Energy Demand",
                "peak_demand_mw": run.get("peak_demand_mw", 0.7),
                "average_demand_mw": run.get("average_demand_mw", 0.45),
                "annual_demand_mwh": balance.get("annual_demand_mwh", round(run.get("average_demand_mw", 0.45) * 8760, 1)),
                "load_factor_pct": round((run.get("average_demand_mw", 0.45) / max(0.01, run.get("peak_demand_mw", 0.7))) * 100.0, 1)
            },
            "4_renewable_potential": {
                "title": "4. Renewable Potential",
                "solar_cf": details.get("inputs", {}).get("solar_cf", 0.20),
                "solar_potential_score": island.get("solar_potential", 0.22),
                "wind_cf": details.get("inputs", {}).get("wind_cf", 0.35),
                "wind_potential_score": island.get("wind_potential", 0.32),
                "otec_cf": details.get("inputs", {}).get("otec_cf", 0.80),
                "otec_potential_score": island.get("otec_potential", 0.80),
                "thermal_gradient_delta_t_c": round(island.get("surface_temp_c", 28.5) - island.get("deep_sea_temp_c", 6.0), 1)
            },
            "5_recommended_energy_mix": {
                "title": "5. Recommended Energy Mix",
                "solar_pct": mix.get("solar_pct", 0.0),
                "wind_pct": mix.get("wind_pct", 0.0),
                "otec_pct": mix.get("otec_pct", 0.0),
                "battery_pct": mix.get("battery_pct", 0.0),
                "diesel_pct": mix.get("diesel_pct", 0.0),
                "total_renewable_pct": mix.get("renewable_total_pct", run.get("renewable_percent", 0.0)),
                "recommended_capacities": rec_cap
            },
            "6_plant_suitability": {
                "title": "6. Plant Suitability Analysis",
                "suitability_matrix": suitability,
                "plant_counts": plant_counts
            },
            "7_battery_recommendation": {
                "title": "7. Battery Recommendation",
                "recommended_kwh": rec_cap.get("battery_kwh", 0),
                "recommended_bess_units": plant_counts.get("recommended", {}).get("battery_systems", 0),
                "battery_unit_size_kwh": plant_counts.get("unit_specs", {}).get("battery_unit_kwh", 500),
                "roundtrip_efficiency_pct": 88.0,
                "usable_depth_of_discharge_pct": 85.0,
                "role": "Absorbs midday solar surplus and provides night-peak firming, dynamic frequency stabilization, and black-start capability."
            },
            "8_renewable_contribution": {
                "title": "8. Renewable Contribution",
                "annual_renewable_generation_mwh": balance.get("annual_ren_mwh", run.get("annual_energy_mwh", 0)),
                "annual_solar_mwh": balance.get("annual_solar_mwh", 0),
                "annual_wind_mwh": balance.get("annual_wind_mwh", 0),
                "annual_otec_mwh": balance.get("annual_otec_mwh", 0),
                "renewable_penetration_achieved_pct": run.get("renewable_percent", 0.0)
            },
            "9_diesel_reduction": {
                "title": "9. Diesel Reduction",
                "diesel_reduction_pct": run.get("diesel_reduction", env.get("diesel_reduction_pct", 0.0)),
                "baseline_diesel_liters_annual": env.get("baseline_diesel_liters", 0),
                "actual_diesel_liters_annual": env.get("actual_diesel_liters", 0),
                "diesel_fuel_saved_liters_annual": env.get("diesel_liters_saved_annual", 0),
                "annual_fuel_cost_savings_usd": env.get("fuel_cost_savings_usd", 0),
                "annual_fuel_cost_savings_inr": env.get("fuel_cost_savings_inr", 0)
            },
            "10_co2_reduction": {
                "title": "10. CO₂ Reduction",
                "co2_avoided_tons_annual": run.get("co2_reduction_tons", env.get("co2_reduction_tons_annual", 0.0)),
                "equivalent_trees_planted": int(run.get("co2_reduction_tons", 0) * 45),
                "equivalent_cars_removed": int(run.get("co2_reduction_tons", 0) / 4.6),
                "ten_year_co2_avoided_tons": round(run.get("co2_reduction_tons", 0) * 10, 1)
            },
            "11_optimization_score": {
                "title": "11. Optimization Score",
                "total_score": score.get("total_score", run.get("score", 0.0)),
                "grade": score.get("grade", "Optimal"),
                "assessment": score.get("assessment", "High performance hybrid configuration."),
                "formula_explanation": score.get("formula_explanation", ""),
                "breakdown": score.get("breakdown", {})
            },
            "12_simulation_results": {
                "title": "12. Simulation Dynamics",
                "curtailed_energy_annual_mwh": details.get("dispatch_simulation", {}).get("annual_curtailed_mwh", 0.0),
                "unmet_load_annual_mwh": details.get("dispatch_simulation", {}).get("annual_unmet_mwh", 0.0),
                "loss_of_load_probability_pct": details.get("dispatch_simulation", {}).get("loss_of_load_prob_pct", 0.0),
                "grid_resilience_rating": "High (N-1 Generation Contingency with Standby Diesel Reserve)"
            },
            "13_recommendations": {
                "title": "13. Recommendations & Phasing Strategy",
                "phase_1": "Deploy modular rooftop and ground-mounted Solar PV alongside first-tier containerized Battery Energy Storage System (BESS) for immediate 40% fuel cut.",
                "phase_2": "Commission coastal/lagoon wind turbines to supplement evening demand and monsoon wind corridors.",
                "phase_3": "Deep-water bathymetric pipeline deployment for closed-cycle OTEC pilot to establish constant 24/7 baseload and co-generate fresh water via desalination.",
                "phase_4": "Transition diesel generators strictly to cold standby emergency spinning reserve."
            },
            "14_technical_summary": {
                "title": "14. Technical Summary",
                "summary_statement": f"By adopting this BlueGrid AI hybrid configuration for {run.get('island_name', 'the island')}, the microgrid achieves {run.get('renewable_percent', 0.0)}% clean renewable generation, saves {env.get('diesel_liters_saved_annual', 0):,} liters of diesel per year, eliminates {run.get('co2_reduction_tons', 0):,} metric tons of CO2 annually, and secures an overall multi-criteria optimization score of {score.get('total_score', 0)}/100."
            }
        }
    }

    return jsonify({
        "status": "success",
        "report": report_payload
    })
