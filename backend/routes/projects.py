"""
Saved Projects API Routes
Handles saving, opening, updating, duplicating, and deleting energy planning projects.
"""

from flask import Blueprint, request, jsonify
import json
from datetime import datetime
from backend.database import get_db_connection

projects_bp = Blueprint("projects", __name__, url_prefix="/api/projects")

@projects_bp.route("", methods=["GET"])
def get_projects():
    """Lists all saved projects."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT id, name, description, island_id, island_name, created_at, updated_at, tags,
           length(inputs_json) as has_inputs, length(results_json) as has_results
    FROM saved_projects
    ORDER BY updated_at DESC
    """)
    rows = cursor.fetchall()
    conn.close()

    projects = [dict(r) for r in rows]
    return jsonify({
        "status": "success",
        "count": len(projects),
        "projects": projects
    })

@projects_bp.route("/<int:project_id>", methods=["GET"])
def get_project(project_id):
    """Retrieves full project state including inputs, results, and simulation params."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM saved_projects WHERE id = ?", (project_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return jsonify({"status": "error", "message": "Project not found"}), 404

    data = dict(row)
    for field in ["inputs_json", "results_json", "simulation_json"]:
        if data.get(field):
            try:
                data[field.replace("_json", "")] = json.loads(data[field])
            except Exception:
                data[field.replace("_json", "")] = None

    return jsonify({
        "status": "success",
        "project": data
    })

@projects_bp.route("", methods=["POST"])
def save_project():
    """Saves a new planning project."""
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    if not name:
        name = f"Plan {datetime.now().strftime('%Y-%m-%d %H:%M')}"

    island_id = data.get("island_id")
    island_name = data.get("island_name", "Unknown Island")
    description = data.get("description", "")
    tags = data.get("tags", "Island Microgrid, Hybrid RE")

    inputs_json = json.dumps(data.get("inputs", {}))
    results_json = json.dumps(data.get("results", {}))
    simulation_json = json.dumps(data.get("simulation", {}))

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO saved_projects (
        name, description, island_id, island_name, inputs_json, results_json, simulation_json, tags
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (name, description, island_id, island_name, inputs_json, results_json, simulation_json, tags))

    new_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({
        "status": "success",
        "id": new_id,
        "message": f"Project '{name}' saved successfully."
    }), 201

@projects_bp.route("/<int:project_id>", methods=["DELETE"])
def delete_project(project_id):
    """Deletes a saved project."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM saved_projects WHERE id = ?", (project_id,))
    affected = cursor.rowcount
    conn.commit()
    conn.close()

    if affected == 0:
        return jsonify({"status": "error", "message": "Project not found"}), 404

    return jsonify({
        "status": "success",
        "message": "Project deleted successfully"
    })

@projects_bp.route("/<int:project_id>/duplicate", methods=["POST"])
def duplicate_project(project_id):
    """Duplicates an existing project."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM saved_projects WHERE id = ?", (project_id,))
    orig = cursor.fetchone()
    if not orig:
        conn.close()
        return jsonify({"status": "error", "message": "Original project not found"}), 404

    new_name = f"{orig['name']} (Copy)"
    cursor.execute("""
    INSERT INTO saved_projects (
        name, description, island_id, island_name, inputs_json, results_json, simulation_json, tags
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (new_name, orig["description"], orig["island_id"], orig["island_name"],
          orig["inputs_json"], orig["results_json"], orig["simulation_json"], orig["tags"]))

    new_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({
        "status": "success",
        "id": new_id,
        "name": new_name,
        "message": f"Duplicated project as '{new_name}'"
    }), 201
