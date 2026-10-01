"""
Power Plants API Routes
Handles querying and managing island energy plant infrastructure.
"""

from flask import Blueprint, request, jsonify
from backend.database import get_db_connection

plants_bp = Blueprint("plants", __name__, url_prefix="/api/plants")

@plants_bp.route("/<int:island_id>", methods=["GET"])
def get_plants_by_island(island_id):
    """Retrieves all operating and planned power plants for a specific island."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    SELECT p.*, i.name as island_name
    FROM energy_plants p
    JOIN islands i ON p.island_id = i.id
    WHERE p.island_id = ?
    ORDER BY p.plant_type ASC
    """, (island_id,))
    rows = cursor.fetchall()
    conn.close()

    plants = [dict(r) for r in rows]
    return jsonify({
        "status": "success",
        "island_id": island_id,
        "count": len(plants),
        "plants": plants
    })

@plants_bp.route("", methods=["POST"])
def add_plant():
    """Adds a new plant record to an island."""
    data = request.get_json() or {}
    island_id = data.get("island_id")
    plant_type = data.get("plant_type")
    capacity_kw = data.get("capacity_kw")

    if not island_id or not plant_type or capacity_kw is None:
        return jsonify({"status": "error", "message": "island_id, plant_type, and capacity_kw are required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO energy_plants (island_id, plant_type, capacity_kw, unit_count, status, commissioned_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        island_id,
        plant_type,
        float(capacity_kw),
        int(data.get("unit_count", 1)),
        data.get("status", "Operating"),
        data.get("commissioned_date"),
        data.get("notes", "")
    ))
    plant_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({
        "status": "success",
        "id": plant_id,
        "message": "Power plant added successfully"
    }), 201
