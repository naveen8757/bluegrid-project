"""
BlueGrid AI Application Launcher
Run this script to start the local Flask server and database.
"""

import sys
import os
from pathlib import Path

# Add root folder to sys.path
ROOT_DIR = Path(__file__).resolve().parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.app import app

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print("\n" + "="*60)
    print("🌊 BLUEGRID AI — Optimal Hybrid Renewable Energy Planner")
    print(f"Server URL:  http://localhost:{port}")
    print("Health Check: http://localhost:5000/api/health")
    print("Press Ctrl+C to terminate the server")
    print("="*60 + "\n")
    app.run(host="0.0.0.0", port=port, debug=False)
