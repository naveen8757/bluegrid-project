# 🌊 BLUEGRID AI
## Optimal Hybrid Renewable Energy Planner for Sustainable Islands

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Backend-Flask%203.1-087DB5.svg)](https://flask.palletsprojects.com/)
[![SQLite](https://img.shields.io/badge/Database-SQLite-063B70.svg)](https://www.sqlite.org/)
[![Frontend](https://img.shields.io/badge/Frontend-HTML5%20%2F%20CSS3%20%2F%20JS%20%2F%20Chart.js-16C7D9.svg)](https://chartjs.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> Built for the **Ocean & Renewable Energy Hackathon**: Planning resilient, 100% clean hybrid microgrids for remote islands utilizing **Solar PV**, **Offshore Wind**, **Ocean Thermal Energy Conversion (OTEC)**, and **Battery Storage (BESS)** to permanently displace diesel generators.

---

## 📌 Executive Summary

Remote oceanic islands (such as the **Lakshadweep Archipelago** and **Andaman & Nicobar Islands**) depend almost exclusively on expensive, polluting diesel fuel barged over rough seas. 

**BlueGrid AI** solves this critical planning challenge by providing an autonomous, multi-criteria optimization engine that:
1. Calculates diurnal microgrid demand profiles and peak requirements.
2. Identifies viable marine renewable potentials (Solar irradiance, coastal wind regimes, and **OTEC** deep-sea cold thermal gradients $\Delta T \approx 20\text{--}24^\circ\text{C}$).
3. Optimally sizes generation capacities and battery storage to eliminate blackouts ($99.8\%$ reliability standard).
4. Evaluates power plant suitability (🟢 Suitable, 🟡 Expand, 🔴 Insufficient) and calculates precise modular plant unit counts.
5. Projects diesel fuel savings (liters & \$), carbon abatement (tons $\text{CO}_2$), and provides an audit-ready 14-section engineering report.

---

## 🚀 Key Highlights & Architectural Features

### 1. Three Distinct Operation Modes
* 🟢 **OFFLINE MODE**: Operates 100% locally in the browser with no internet required. Utilizes cached island datasets, browser LocalStorage, and a dedicated client-side JavaScript optimization engine mirroring the Python algorithms.
* 🔵 **ONLINE MODE**: Connects to the local Python Flask backend and SQLite database for real-time model resolution, persistence, and REST API access.
* 🟣 **SIMULATION MODE**: An interactive sandbox with responsive sliders (Demand multiplier, Solar, Wind, OTEC, Battery, Renewable Target %). Recalculates diurnal dispatch, energy mix, and carbon savings in real time without page reload.

### 2. The 12 Application Sections
1. **Home**: Ocean landing page with animated wave canvas, floating particles, value propositions, and live status badges.
2. **Dashboard**: High-level island grid overview, key performance indicators, and quick-action triggers.
3. **Island Catalog & Map**: Interactive Leaflet map with custom island markers, popups, region filtering, and 1-click optimization.
4. **Island Resource Profile**: Deep dive into island demographics, bathymetry, and 4 renewable potential cards (Solar, Wind, OTEC, Battery).
5. **Energy Optimizer**: Form inputs with auto-population from selected islands, physical constraints, and renewable/reliability targets.
6. **Simulation Sandbox**: Interactive sliders with instant recalculations and dynamic grid suitability assessments.
7. **Optimization Results**: Top KPI cards, energy mix breakdown, doughnut chart, and **Animated Energy Flow Visualization** (Generation ➔ BlueGrid Hub ➔ Battery Storage ➔ Island Load).
8. **Power Plants & Sizing**: Suitability analysis matrix and modular plant unit counts (Existing vs Recommended vs Additions required).
9. **Energy Analytics**: 24-hour diurnal dispatch curve, monthly seasonal projections, and 10-year cumulative fuel/cost/carbon savings.
10. **Technical Reports**: Full 14-section formal engineering report with print and PDF export capabilities.
11. **Saved Projects**: Archive and manage scenarios (Open, Duplicate, Delete, Export JSON, Import JSON).
12. **System Status & NIOT Import**: Operational health diagnostics and standard CSV ingestion tool with validation, preview, and database commit.

---

## ⚙️ Mathematical & Optimization Model

### Capacity Factors
```python
SOLAR_CF = 0.20   # Diurnal solar photovoltaic capacity factor
WIND_CF  = 0.35   # Coastal & marine wind regime capacity factor
OTEC_CF  = 0.80   # Closed-cycle continuous 24/7 oceanic thermal baseload
```

### Transparent Multi-Criteria Scoring Formula
$$\text{Score} = \text{Reliability} + \text{RenewableShare} + \text{DieselReduction} + \text{ResourceEfficiency} - \text{OvercapacityPenalty}$$

Where:
* **Reliability Score** (Max 30 pts): $30 \times (1 - 10 \times \text{LossOfLoadFraction})$
* **Renewable Contribution Score** (Max 30 pts): $30 \times \text{RenewableFraction}$
* **Diesel Reduction Score** (Max 25 pts): $25 \times \text{DieselReductionRatio}$
* **Resource Utilization Score** (Max 15 pts): $15 \times (1 - 1.5 \times \text{CurtailmentRatio})$
* **Overcapacity Penalty** (Max 15 pts deduction): Penalizes excessive capital expenditure when total capacity exceeds $2.8\times$ peak load.

---

## 🗄 Database Schema (SQLite)

The local SQLite database (`backend/bluegrid.db`) manages:
* `islands`: Geographic coordinates, population, peak/average demand, bathymetry distance to 1000m, and surface/deep ocean temperatures.
* `energy_plants`: Existing and recommended plant infrastructure by island.
* `optimization_runs`: Complete audit log of input constraints, recommended capacities, dispatch metrics, and scores.
* `simulation_runs`: High-speed slider scenario tracking.
* `saved_projects`: User-created planning projects with full configuration JSON.
* `system_settings`: Configurable capacity factors, plant unit sizes, and fuel constants.

---

## 📥 NIOT Ocean Survey CSV Ingestion

The platform includes an automated ingestion interface for CSV datasets (e.g. `niot.csv`):
* **Mandatory columns**: `name`, `latitude`, `longitude`, `peak_demand_mw`, `average_demand_mw`
* **Optional oceanographic columns**: `population`, `solar_potential`, `wind_potential`, `otec_potential`, `depth_1000m_dist_km`, `surface_temp_c`, `deep_sea_temp_c`
* Features real-time schema validation, interactive preview table, valid/invalid row detection, and database synchronization.
* *Note: A downloadable template (`sample_niot.csv`) is provided directly in the interface.*

---

## 🛠 Quickstart & Installation

### Prerequisites
* Python 3.10+
* Modern web browser (Chrome, Edge, Firefox, Safari)

### 1. Clone & Enter Directory
```bash
cd "c:\Users\Naveen Yuvaraj\OneDrive\Desktop\New folder"
```

### 2. Install Python Dependencies
```bash
pip install -r requirements.txt
```

### 3. Launch Application
Run the root launcher:
```bash
python run.py
```
Or start the backend directly:
```bash
python backend/app.py
```

### 4. Open in Browser
Visit **`http://localhost:5000`** in your browser. The application will immediately load with all 11 pre-seeded islands, interactive map, optimization engine, and visual analytics ready to go!

---

## 🔌 REST API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Diagnostic check across backend, SQLite, and optimization engine |
| `GET` | `/api/islands` | Query island catalog with search and region filtering |
| `GET` | `/api/islands/<id>` | Retrieve single island details and existing power plants |
| `POST` | `/api/optimize` | Run hybrid optimization and persist run to database |
| `POST` | `/api/simulate` | Execute real-time parameter simulation |
| `GET` | `/api/results` | Retrieve history of recent optimization runs |
| `GET` | `/api/plants/<island_id>` | List power plant infrastructure for an island |
| `GET` | `/api/projects` | List all saved planning projects |
| `POST` | `/api/projects` | Save new project scenario |
| `DELETE` | `/api/projects/<id>` | Delete saved project |
| `GET` | `/api/report/<run_id>` | Generate structured 14-section engineering report |
| `POST` | `/api/niot/preview` | Validate and preview CSV upload |
| `POST` | `/api/niot/import` | Commit valid CSV records into SQLite database |

---

## 🌊 Designed for Marine Sustainability

Developed with dedication to clean maritime ecosystems, zero-diesel island autonomy, and the blue economy.
