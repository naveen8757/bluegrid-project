"""
Islands API Routes
Handles island cataloging, search, filtering, detailed metrics, and CRUD operations.
"""

from flask import Blueprint, request, jsonify
from backend.database import get_db_connection

islands_bp = Blueprint("islands", __name__, url_prefix="/api/islands")

@islands_bp.route("", methods=["GET"])
def get_islands():
    """Retrieves list of islands with optional search and region filters."""
    search_query = request.args.get("search", "").strip().lower()
    region_filter = request.args.get("region", "").strip()

    conn = get_db_connection()
    cursor = conn.cursor()

    sql = "SELECT * FROM islands WHERE 1=1"
    params = []

    if region_filter and region_filter.lower() != "all":
        sql += " AND LOWER(region) = LOWER(?)"
        params.append(region_filter)

    if search_query:
        sql += " AND (LOWER(name) LIKE ? OR LOWER(region) LIKE ? OR LOWER(state_ut) LIKE ?)"
        term = f"%{search_query}%"
        params.extend([term, term, term])

    sql += " ORDER BY name ASC"
    cursor.execute(sql, params)
    rows = cursor.fetchall()
    conn.close()

    islands = [dict(row) for row in rows]
    return jsonify({
        "status": "success",
        "count": len(islands),
        "islands": islands
    })

@islands_bp.route("/<int:island_id>", methods=["GET"])
def get_island_detail(island_id):
    """Retrieves single island detail along with linked energy plants."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM islands WHERE id = ?", (island_id,))
    island_row = cursor.fetchone()

    if not island_row:
        conn.close()
        return jsonify({"status": "error", "message": f"Island with ID {island_id} not found"}), 404

    island = dict(island_row)

    # Fetch plants
    cursor.execute("SELECT * FROM energy_plants WHERE island_id = ?", (island_id,))
    plants = [dict(r) for r in cursor.fetchall()]
    conn.close()

    island["plants"] = plants
    return jsonify({
        "status": "success",
        "island": island
    })

@islands_bp.route("", methods=["POST"])
def create_island():
    """Adds a new island to the database."""
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"status": "error", "message": "Island name is required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
        INSERT INTO islands (
            name, region, state_ut, latitude, longitude, population, area_sqkm,
            peak_demand_mw, average_demand_mw, solar_potential, wind_potential,
            otec_potential, existing_solar_kw, existing_wind_kw, existing_otec_kw,
            existing_diesel_kw, battery_kwh, depth_1000m_dist_km, surface_temp_c,
            deep_sea_temp_c, description, is_demo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        """, (
            name,
            data.get("region", "Custom Island"),
            data.get("state_ut", "India"),
            float(data.get("latitude", 10.0)),
            float(data.get("longitude", 73.0)),
            int(data.get("population", 1000)),
            float(data.get("area_sqkm", 5.0)),
            float(data.get("peak_demand_mw", 0.5)),
            float(data.get("average_demand_mw", 0.3)),
            float(data.get("solar_potential", 0.20)),
            float(data.get("wind_potential", 0.30)),
            float(data.get("otec_potential", 0.80)),
            float(data.get("existing_solar_kw", 0)),
            float(data.get("existing_wind_kw", 0)),
            float(data.get("existing_otec_kw", 0)),
            float(data.get("existing_diesel_kw", 500)),
            float(data.get("battery_kwh", 200)),
            float(data.get("depth_1000m_dist_km", 3.0)),
            float(data.get("surface_temp_c", 28.5)),
            float(data.get("deep_sea_temp_c", 6.0)),
            data.get("description", "Custom added island.")
        ))
        new_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return jsonify({"status": "success", "id": new_id, "message": "Island created successfully"}), 201
    except Exception as e:
        conn.close()
        return jsonify({"status": "error", "message": str(e)}), 400
