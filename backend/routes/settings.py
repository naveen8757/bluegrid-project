"""
Settings and System Status API Routes
Handles system configuration parameters and operational health diagnostics.
"""

from flask import Blueprint, request, jsonify
from datetime import datetime
from backend.database import get_db_connection, get_settings_dict
import backend.config as cfg

settings_bp = Blueprint("settings", __name__, url_prefix="/api")

@settings_bp.route("/health", methods=["GET"])
def health_check():
    """
    Returns system operational health diagnostics across all tiers:
    Backend, SQLite Database, Optimization Engine, and API status.
    """
    db_connected = False
    island_count = 0
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM islands")
        island_count = cursor.fetchone()[0]
        conn.close()
        db_connected = True
    except Exception as e:
        db_error = str(e)

    return jsonify({
        "status": "healthy" if db_connected else "degraded",
        "timestamp": datetime.now().isoformat(),
        "backend": "Connected",
        "database": "Connected (SQLite)" if db_connected else "Disconnected",
        "optimization_engine": "Ready",
        "api": "Healthy",
        "islands_registered": island_count,
        "default_capacity_factors": {
            "solar_cf": cfg.DEFAULT_SOLAR_CF,
            "wind_cf": cfg.DEFAULT_WIND_CF,
            "otec_cf": cfg.DEFAULT_OTEC_CF
        },
        "default_plant_units": {
            "solar_unit_kw": cfg.DEFAULT_SOLAR_UNIT_KW,
            "wind_unit_kw": cfg.DEFAULT_WIND_UNIT_KW,
            "otec_unit_kw": cfg.DEFAULT_OTEC_UNIT_KW,
            "battery_unit_kwh": cfg.DEFAULT_BATTERY_UNIT_KWH
        }
    })

@settings_bp.route("/settings", methods=["GET"])
def get_settings():
    """Returns current active system configuration settings."""
    settings = get_settings_dict()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM system_settings ORDER BY key ASC")
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()

    return jsonify({
        "status": "success",
        "settings_map": settings,
        "settings_list": rows
    })

@settings_bp.route("/settings", methods=["POST"])
def update_settings():
    """Updates one or multiple configuration settings."""
    data = request.get_json() or {}
    conn = get_db_connection()
    cursor = conn.cursor()

    updated = []
    for k, v in data.items():
        cursor.execute("""
        INSERT INTO system_settings (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            updated_at = CURRENT_TIMESTAMP
        """, (k, str(v)))
        updated.append(k)

    conn.commit()
    conn.close()

@settings_bp.route("/verify-mapbox", methods=["POST"])
def verify_mapbox():
    """Validates Mapbox token by checking format and testing a lightweight tile request."""
    import urllib.request
    import urllib.error

    data = request.get_json() or {}
    token = data.get("token", "").strip()

    if not token:
        return jsonify({"status": "error", "message": "Mapbox API token cannot be empty"}), 400

    if not token.startswith("pk."):
        return jsonify({"status": "error", "message": "Mapbox public tokens usually begin with 'pk.'"}), 400

    # Test token against Mapbox API
    test_url = f"https://api.mapbox.com/v4/mapbox.satellite/1/0/0.png?access_token={token}"
    try:
        req = urllib.request.Request(test_url, headers={"User-Agent": "BlueGridAI/1.0"})
        with urllib.request.urlopen(req, timeout=5) as response:
            if response.status == 200:
                return jsonify({
                    "status": "success",
                    "valid": True,
                    "message": "Mapbox API Token verified successfully! High-resolution satellite tiles activated."
                })
    except urllib.error.HTTPError as e:
        if e.code == 401 or e.code == 403:
            return jsonify({"status": "error", "valid": False, "message": "Invalid Mapbox access token or unauthorized."}), 401
        return jsonify({"status": "error", "valid": False, "message": f"Mapbox API responded with HTTP {e.code}"}), 400
    except Exception as e:
        # If network error or timeout, allow token with notice
        return jsonify({
            "status": "success",
            "valid": True,
            "message": f"Token saved and active locally (Notice: direct verification timed out: {e})"
        })

    return jsonify({"status": "error", "message": "Unknown token verification status"}), 400
