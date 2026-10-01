"""
NIOT Data Import API Routes
Provides CSV ingestion, parsing, schema validation, data preview, and database synchronization.
Includes clear source disclaimer for academic/hackathon transparency.
"""

from flask import Blueprint, request, jsonify, send_file
import csv
import io
from pathlib import Path
from backend.database import get_db_connection

niot_bp = Blueprint("niot", __name__, url_prefix="/api/niot")

REQUIRED_COLUMNS = ["name", "latitude", "longitude", "peak_demand_mw", "average_demand_mw"]
OPTIONAL_NUMERIC = [
    "population", "area_sqkm", "solar_potential", "wind_potential", "otec_potential",
    "existing_solar_kw", "existing_wind_kw", "existing_otec_kw", "existing_diesel_kw",
    "battery_kwh", "depth_1000m_dist_km", "surface_temp_c", "deep_sea_temp_c"
]

def _parse_and_validate_csv(csv_text: str):
    """Parses and validates CSV rows, returning preview items, valid rows, and errors."""
    f = io.StringIO(csv_text.strip())
    reader = csv.DictReader(f)

    if not reader.fieldnames:
        return {"error": "CSV file appears empty or unparseable."}

    # Normalize fieldnames (lowercase and stripped)
    clean_fieldnames = [c.strip().lower() for c in reader.fieldnames]

    missing_cols = [c for c in REQUIRED_COLUMNS if c not in clean_fieldnames]
    if missing_cols:
        return {
            "error": f"Missing mandatory columns: {', '.join(missing_cols)}. Required columns are: {', '.join(REQUIRED_COLUMNS)}"
        }

    preview_rows = []
    valid_rows = []
    error_list = []

    for idx, row in enumerate(reader, start=1):
        # Normalize keys in row
        row_norm = {k.strip().lower(): v.strip() for k, v in row.items() if k}
        name = row_norm.get("name", "").strip()

        row_errors = []
        if not name:
            row_errors.append("Island 'name' cannot be blank.")

        parsed_data = {"name": name}

        # Check numeric required fields
        for req in ["latitude", "longitude", "peak_demand_mw", "average_demand_mw"]:
            val_str = row_norm.get(req, "")
            try:
                val_flt = float(val_str)
                parsed_data[req] = val_flt
            except ValueError:
                row_errors.append(f"Field '{req}' must be numeric (found '{val_str}').")

        # Check optional numerics
        for opt in OPTIONAL_NUMERIC:
            val_str = row_norm.get(opt, "")
            if val_str:
                try:
                    parsed_data[opt] = float(val_str)
                except ValueError:
                    row_errors.append(f"Optional field '{opt}' must be numeric (found '{val_str}').")
            else:
                parsed_data[opt] = 0.0

        # String fields
        parsed_data["region"] = row_norm.get("region", "Coastal / Island")
        parsed_data["state_ut"] = row_norm.get("state_ut", "India")
        parsed_data["description"] = row_norm.get("notes", row_norm.get("description", "Imported via NIOT CSV portal"))
        parsed_data["row_index"] = idx

        status = "valid" if not row_errors else "invalid"
        if row_errors:
            error_list.append({"row": idx, "name": name, "issues": row_errors})
        else:
            valid_rows.append(parsed_data)

        preview_rows.append({
            "row_index": idx,
            "name": name,
            "region": parsed_data.get("region"),
            "peak_demand_mw": parsed_data.get("peak_demand_mw"),
            "solar_potential": parsed_data.get("solar_potential"),
            "wind_potential": parsed_data.get("wind_potential"),
            "otec_potential": parsed_data.get("otec_potential"),
            "status": status,
            "errors": row_errors
        })

    return {
        "total_rows": len(preview_rows),
        "valid_count": len(valid_rows),
        "invalid_count": len(error_list),
        "preview_rows": preview_rows,
        "valid_rows": valid_rows,
        "errors": error_list
    }

@niot_bp.route("/preview", methods=["POST"])
def preview_csv():
    """
    Parses and validates CSV without committing to database.
    Allows user to review data table, identify invalid rows, and preview imports.
    """
    csv_text = ""
    if "file" in request.files:
        uploaded_file = request.files["file"]
        if uploaded_file.filename == "":
            return jsonify({"status": "error", "message": "No file selected."}), 400
        csv_text = uploaded_file.read().decode("utf-8", errors="replace")
    elif request.is_json:
        csv_text = request.get_json().get("csv_text", "")
    else:
        csv_text = request.get_data(as_text=True)

    if not csv_text.strip():
        return jsonify({"status": "error", "message": "CSV data is empty."}), 400

    parsed = _parse_and_validate_csv(csv_text)
    if "error" in parsed:
        return jsonify({"status": "error", "message": parsed["error"]}), 400

    return jsonify({
        "status": "success",
        "data": parsed,
        "disclaimer": "Notice: Unless specifically sourced from official NIOT oceanographic cruises, imported data represents simulation/demonstration inputs."
    })

@niot_bp.route("/import", methods=["POST"])
def import_csv():
    """
    Commits valid CSV records into SQLite islands database.
    Updates existing islands if name matches; otherwise creates new island records.
    """
    csv_text = ""
    if "file" in request.files:
        uploaded_file = request.files["file"]
        csv_text = uploaded_file.read().decode("utf-8", errors="replace")
    elif request.is_json:
        csv_text = request.get_json().get("csv_text", "")
    else:
        csv_text = request.get_data(as_text=True)

    if not csv_text.strip():
        return jsonify({"status": "error", "message": "CSV data is empty."}), 400

    parsed = _parse_and_validate_csv(csv_text)
    if "error" in parsed:
        return jsonify({"status": "error", "message": parsed["error"]}), 400

    valid_rows = parsed.get("valid_rows", [])
    if not valid_rows:
        return jsonify({
            "status": "error",
            "message": "No valid rows found to import.",
            "errors": parsed.get("errors", [])
        }), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    rows_imported = 0
    rows_updated = 0
    errors_during_commit = []

    for row in valid_rows:
        try:
            cursor.execute("SELECT id FROM islands WHERE LOWER(name) = LOWER(?)", (row["name"],))
            existing = cursor.fetchone()

            if existing:
                # Update existing
                cursor.execute("""
                UPDATE islands SET
                    region = ?, state_ut = ?, latitude = ?, longitude = ?,
                    population = ?, area_sqkm = ?, peak_demand_mw = ?,
                    average_demand_mw = ?, solar_potential = ?, wind_potential = ?,
                    otec_potential = ?, existing_solar_kw = ?, existing_wind_kw = ?,
                    existing_otec_kw = ?, existing_diesel_kw = ?, battery_kwh = ?,
                    depth_1000m_dist_km = ?, surface_temp_c = ?, deep_sea_temp_c = ?,
                    description = ?
                WHERE id = ?
                """, (
                    row["region"], row["state_ut"], row["latitude"], row["longitude"],
                    int(row.get("population", 1000)), float(row.get("area_sqkm", 3.0)),
                    row["peak_demand_mw"], row["average_demand_mw"],
                    row.get("solar_potential", 0.20), row.get("wind_potential", 0.30),
                    row.get("otec_potential", 0.80), row.get("existing_solar_kw", 0),
                    row.get("existing_wind_kw", 0), row.get("existing_otec_kw", 0),
                    row.get("existing_diesel_kw", 600), row.get("battery_kwh", 200),
                    row.get("depth_1000m_dist_km", 3.0), row.get("surface_temp_c", 28.5),
                    row.get("deep_sea_temp_c", 6.0), row["description"],
                    existing["id"]
                ))
                rows_updated += 1
            else:
                # Insert new
                cursor.execute("""
                INSERT INTO islands (
                    name, region, state_ut, latitude, longitude,
                    population, area_sqkm, peak_demand_mw, average_demand_mw,
                    solar_potential, wind_potential, otec_potential,
                    existing_solar_kw, existing_wind_kw, existing_otec_kw,
                    existing_diesel_kw, battery_kwh, depth_1000m_dist_km,
                    surface_temp_c, deep_sea_temp_c, description, is_demo
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
                """, (
                    row["name"], row["region"], row["state_ut"], row["latitude"], row["longitude"],
                    int(row.get("population", 1000)), float(row.get("area_sqkm", 3.0)),
                    row["peak_demand_mw"], row["average_demand_mw"],
                    row.get("solar_potential", 0.20), row.get("wind_potential", 0.30),
                    row.get("otec_potential", 0.80), row.get("existing_solar_kw", 0),
                    row.get("existing_wind_kw", 0), row.get("existing_otec_kw", 0),
                    row.get("existing_diesel_kw", 600), row.get("battery_kwh", 200),
                    row.get("depth_1000m_dist_km", 3.0), row.get("surface_temp_c", 28.5),
                    row.get("deep_sea_temp_c", 6.0), row["description"]
                ))
                rows_imported += 1

        except Exception as e:
            errors_during_commit.append({"name": row["name"], "error": str(e)})

    conn.commit()
    conn.close()

    total_rejected = len(parsed.get("errors", [])) + len(errors_during_commit)

    return jsonify({
        "status": "success",
        "rows_imported": rows_imported,
        "rows_updated": rows_updated,
        "rows_rejected": total_rejected,
        "validation_errors": parsed.get("errors", []),
        "database_errors": errors_during_commit,
        "message": f"NIOT Import Complete: {rows_imported} inserted, {rows_updated} updated, {total_rejected} rejected."
    })

@niot_bp.route("/sample-template", methods=["GET"])
def get_sample_template():
    """Returns the sample NIOT CSV template file."""
    sample_path = Path(__file__).resolve().parent.parent / "data" / "sample_niot.csv"
    if sample_path.exists():
        return send_file(str(sample_path), mimetype="text/csv", as_attachment=True, download_name="sample_niot.csv")
    return jsonify({"status": "error", "message": "Sample template file missing."}), 404
