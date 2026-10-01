"""
Configuration module for BlueGrid AI
Defines default capacity factors, plant unit capacities, cost/carbon constants, and runtime modes.
"""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATABASE_PATH = BASE_DIR / "bluegrid.db"
STATIC_FOLDER = BASE_DIR.parent / "frontend"

# Default Capacity Factors (Section 11)
DEFAULT_SOLAR_CF = 0.20
DEFAULT_WIND_CF = 0.35
DEFAULT_OTEC_CF = 0.80

# Plant Unit Sizing Configurations (Section 14)
DEFAULT_SOLAR_UNIT_KW = 250.0      # 1 Modular Solar PV Array = 250 kW
DEFAULT_WIND_UNIT_KW = 500.0       # 1 Medium Island Wind Turbine = 500 kW
DEFAULT_OTEC_UNIT_KW = 500.0       # 1 Closed-Cycle OTEC Module = 500 kW
DEFAULT_BATTERY_UNIT_KWH = 500.0   # 1 Containerized BESS Module = 500 kWh
DEFAULT_DIESEL_UNIT_KW = 400.0     # 1 Standard Island Genset = 400 kW

# Environmental and Fuel Constants
DIESEL_EMISSIONS_KG_PER_KWH = 0.78  # kg CO2 / kWh from diesel gen
DIESEL_LITERS_PER_KWH = 0.28        # Liters / kWh from diesel gen
DIESEL_COST_USD_PER_LITER = 1.15    # Remote island landed cost per liter ($)
CO2_PRICE_USD_PER_TON = 45.0        # Carbon credit benchmark value

# Battery Storage Specs
BATTERY_ROUNDTRIP_EFFICIENCY = 0.88 # 88% roundtrip efficiency (LiFePO4)
BATTERY_MIN_SOC = 0.15              # Minimum 15% reserve state of charge
BATTERY_MAX_DOD = 0.85              # Maximum depth of discharge
BATTERY_HOURS_TARGET = 6.0          # Target autonomy hours for night peak buffer

# 24-Hour Diurnal Demand Normalized Curve
# Peaks in evening around 19:00 - 22:00, secondary peak 11:00 - 13:00
HOURLY_DEMAND_PROFILE = [
    0.68, 0.62, 0.58, 0.55, 0.58, 0.65,  # 00:00 - 05:00 (Night base)
    0.74, 0.86, 0.94, 0.98, 1.00, 0.98,  # 06:00 - 11:00 (Morning ramp)
    0.95, 0.92, 0.90, 0.88, 0.92, 1.05,  # 12:00 - 17:00 (Afternoon)
    1.18, 1.25, 1.20, 1.10, 0.92, 0.78   # 18:00 - 23:00 (Evening peak)
]

# 24-Hour Diurnal Solar Generation Profile (Normalized GHI curve)
HOURLY_SOLAR_PROFILE = [
    0.0, 0.0, 0.0, 0.0, 0.0, 0.02,
    0.15, 0.40, 0.68, 0.88, 0.98, 1.00,
    0.96, 0.85, 0.65, 0.38, 0.12, 0.01,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0
]

# 24-Hour Coastal Wind Generation Profile (Normalized coastal sea breeze + night gradient)
HOURLY_WIND_PROFILE = [
    0.42, 0.40, 0.38, 0.35, 0.36, 0.38,
    0.45, 0.52, 0.60, 0.68, 0.72, 0.75,
    0.78, 0.80, 0.82, 0.80, 0.75, 0.70,
    0.65, 0.60, 0.55, 0.50, 0.46, 0.44
]

# OTEC Profile: Constant baseline thermal gradient (24/7 availability)
HOURLY_OTEC_PROFILE = [1.0] * 24
