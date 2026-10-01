"""
BlueGrid API Route Blueprints
"""

from .islands import islands_bp
from .optimize import optimize_bp
from .plants import plants_bp
from .projects import projects_bp
from .reports import reports_bp
from .niot import niot_bp
from .settings import settings_bp

__all__ = [
    "islands_bp",
    "optimize_bp",
    "plants_bp",
    "projects_bp",
    "reports_bp",
    "niot_bp",
    "settings_bp"
]
