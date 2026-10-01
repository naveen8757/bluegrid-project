"""
BlueGrid AI Flask Application Entry Point
Initializes SQLite database, registers REST blueprints, enables CORS, and serves frontend static assets.
"""

import os
import sys
from pathlib import Path
from flask import Flask, send_from_directory, jsonify
from flask_cors import CORS

# Add root folder to sys.path so 'backend' package imports work cleanly
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.database import init_db
from backend.routes import (
    islands_bp,
    optimize_bp,
    plants_bp,
    projects_bp,
    reports_bp,
    niot_bp,
    settings_bp
)

STATIC_DIR = ROOT_DIR / "frontend"

def create_app():
    """Application factory for BlueGrid AI backend."""
    app = Flask(__name__, static_folder=str(STATIC_DIR), static_url_path="")
    CORS(app)

    # Initialize SQLite schema and seed dataset if empty
    with app.app_context():
        init_db()

    # Register API Blueprints
    app.register_blueprint(islands_bp)
    app.register_blueprint(optimize_bp)
    app.register_blueprint(plants_bp)
    app.register_blueprint(projects_bp)
    app.register_blueprint(reports_bp)
    app.register_blueprint(niot_bp)
    app.register_blueprint(settings_bp)

    # Serve Frontend Single-Page Application (SPA)
    @app.route("/")
    def index():
        return send_from_directory(str(STATIC_DIR), "index.html")

    @app.route("/<path:path>")
    def static_proxy(path):
        target_file = STATIC_DIR / path
        if target_file.exists():
            return send_from_directory(str(STATIC_DIR), path)
        return send_from_directory(str(STATIC_DIR), "index.html")

    @app.errorhandler(404)
    def handle_404(e):
        if hasattr(e, "description") and "/api/" in getattr(e, "description", ""):
            return jsonify({"status": "error", "message": "API endpoint not found"}), 404
        return send_from_directory(str(STATIC_DIR), "index.html")

    @app.errorhandler(500)
    def handle_500(e):
        return jsonify({"status": "error", "message": "Internal server error", "detail": str(e)}), 500

    return app

app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"🌊 BlueGrid AI Server starting on http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=True)
