/**
 * BlueGrid AI — NIOT CSV Data Ingestion & Validation Controller
 * Section 22 Implementation: CSV upload, parsing, preview, schema validation, and database synchronization.
 */

const BlueGridNiotImport = (() => {
  let stagedCsvText = "";
  let stagedValidationData = null;

  function initDropzone() {
    const dropzone = document.getElementById('niotDropzone');
    const fileInput = document.getElementById('niotFileInput');
    if (!dropzone || !fileInput) return;

    dropzone.onclick = () => fileInput.click();

    dropzone.ondragover = (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-over');
    };

    dropzone.ondragleave = () => {
      dropzone.classList.remove('drag-over');
    };

    dropzone.ondrop = (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
      if (e.dataTransfer.files.length > 0) {
        handleCsvFile(e.dataTransfer.files[0]);
      }
    };

    fileInput.onchange = (e) => {
      if (e.target.files.length > 0) {
        handleCsvFile(e.target.files[0]);
      }
    };
  }

  function handleCsvFile(file) {
    if (!file.name.endsWith('.csv')) {
      BlueGridApp.showToast('Please upload a standard .csv file format.', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      stagedCsvText = e.target.result;
      document.getElementById('stagedFileName').textContent = file.name;
      document.getElementById('stagedFileSize').textContent = `(${(file.size / 1024).toFixed(1)} KB)`;
      await previewCsv();
    };
    reader.readAsText(file);
  }

  async function previewCsv() {
    if (!stagedCsvText) return;

    const previewContainer = document.getElementById('niotPreviewArea');
    previewContainer.style.display = 'block';
    previewContainer.innerHTML = '<div style="text-align: center; padding: 20px;"><i class="fa-solid fa-spinner fa-spin"></i> Validating CSV columns and values...</div>';

    try {
      const res = await fetch('/api/niot/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv_text: stagedCsvText })
      });

      if (!res.ok) {
        const err = await res.json();
        previewContainer.innerHTML = `
          <div style="background: #FEE2E2; border-left: 4px solid #EF4444; padding: 14px 18px; border-radius: 6px; color: #991B1B;">
            <strong>CSV Schema Validation Error:</strong> ${err.message || 'Failed to parse file.'}
          </div>
        `;
        return;
      }

      const payload = await res.json();
      stagedValidationData = payload.data;
      renderPreviewTable(stagedValidationData, payload.disclaimer);

    } catch (e) {
      // Local fallback parser if offline
      localCsvPreview(stagedCsvText);
    }
  }

  function renderPreviewTable(data, disclaimer) {
    const container = document.getElementById('niotPreviewArea');
    const validCount = data.valid_count;
    const invalidCount = data.invalid_count;
    const totalCount = data.total_rows;

    let rowsHtml = '';
    data.preview_rows.forEach(r => {
      const isOk = r.status === 'valid';
      const badge = isOk
        ? '<span style="background: #DCFCE7; color: #166534; padding: 2px 8px; border-radius: 10px; font-size: 0.72rem; font-weight: 700;">✓ Valid</span>'
        : `<span style="background: #FEE2E2; color: #991B1B; padding: 2px 8px; border-radius: 10px; font-size: 0.72rem; font-weight: 700;" title="${r.errors.join('; ')}">⚠ Invalid</span>`;

      rowsHtml += `
        <tr>
          <td>${r.row_index}</td>
          <td><strong>${r.name}</strong></td>
          <td>${r.region || '--'}</td>
          <td>${r.peak_demand_mw ? r.peak_demand_mw + ' MW' : '--'}</td>
          <td>${r.solar_potential ?? '--'}</td>
          <td>${r.wind_potential ?? '--'}</td>
          <td>${r.otec_potential ?? '--'}</td>
          <td>${badge}</td>
        </tr>
      `;
    });

    container.innerHTML = `
      <div style="margin-top: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 10px;">
          <div>
            <h4 style="color: #063B70; font-size: 1.05rem; margin: 0;">CSV Ingestion Preview (${totalCount} Records)</h4>
            <span style="font-size: 0.8rem; color: #537592;">
              <strong style="color: #10B981;">${validCount} Valid</strong>, <strong style="color: #EF4444;">${invalidCount} Invalid/Errors</strong>
            </span>
          </div>
          <button class="btn btn-primary" id="btnCommitImport" ${validCount === 0 ? 'disabled' : ''} onclick="BlueGridNiotImport.commitImport()">
            <i class="fa-solid fa-cloud-arrow-up"></i> Import & Synchronize (${validCount} Islands)
          </button>
        </div>

        <div class="preview-table-container">
          <table class="plant-counts-table" style="margin: 0;">
            <thead>
              <tr>
                <th>#</th>
                <th>Island Name</th>
                <th>Region</th>
                <th>Peak Demand</th>
                <th>Solar CF</th>
                <th>Wind CF</th>
                <th>OTEC CF</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>

        <div style="margin-top: 12px; font-size: 0.74rem; color: #537592; background: #EEF6FB; padding: 8px 12px; border-radius: 6px;">
          <i class="fa-solid fa-info-circle" style="color: #087DB5;"></i> ${disclaimer || 'Unless verified from official research vessel surveys, data represents simulation parameters.'}
        </div>
      </div>
    `;
  }

  async function commitImport() {
    const btn = document.getElementById('btnCommitImport');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Synchronizing to SQLite...';
    }

    try {
      const res = await fetch('/api/niot/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv_text: stagedCsvText })
      });

      const result = await res.json();
      if (res.ok) {
        document.getElementById('niotImportResultsCard').style.display = 'block';
        document.getElementById('resRowsImported').textContent = result.rows_imported;
        document.getElementById('resRowsUpdated').textContent = result.rows_updated;
        document.getElementById('resRowsRejected').textContent = result.rows_rejected;

        BlueGridApp.showToast(result.message, 'success');
        // Refresh islands list & map
        BlueGridApp.loadIslands();
      } else {
        BlueGridApp.showToast(`Import error: ${result.message}`, 'error');
      }
    } catch (e) {
      BlueGridApp.showToast('Failed to connect to backend import service.', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Import & Synchronize';
      }
    }
  }

  function downloadSampleCsv() {
    window.location.href = '/api/niot/sample-template';
  }

  return {
    initDropzone,
    commitImport,
    downloadSampleCsv
  };
})();

window.BlueGridNiotImport = BlueGridNiotImport;
