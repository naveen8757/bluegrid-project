/**
 * BlueGrid AI — Saved Projects Controller
 * Section 26 Implementation: Save, Open, Duplicate, Delete, Export, Import
 */

const BlueGridProjects = (() => {
  async function loadProjectsList() {
    const container = document.getElementById('savedProjectsGrid');
    if (!container) return;

    container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #537592;"><i class="fa-solid fa-spinner fa-spin"></i> Loading saved projects...</div>';

    const projects = await BlueGridAPI.getProjects();

    if (!projects || projects.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; background: #FFFFFF; border-radius: 14px; border: 1px dashed #087DB5;">
          <i class="fa-solid fa-folder-open" style="font-size: 3rem; color: #087DB5; opacity: 0.5; margin-bottom: 14px;"></i>
          <h3 style="color: #063B70; font-size: 1.2rem; margin-bottom: 8px;">No Saved Projects Yet</h3>
          <p style="color: #537592; font-size: 0.9rem; max-width: 480px; margin: 0 auto 20px;">
            Run an optimization from the <strong>Energy Optimizer</strong> and click <strong>"Save Project"</strong> to archive scenarios for comparison.
          </p>
          <button class="btn btn-primary" onclick="BlueGridApp.navigateTo('optimizer')">
            <i class="fa-solid fa-bolt"></i> Start First Optimization
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    projects.forEach(p => {
      let results = {};
      try {
        results = typeof p.results_json === 'string' ? JSON.parse(p.results_json) : (p.results || {});
      } catch (e) {}

      const renPct = results.energy_mix?.renewable_total_pct || results.renewable_percent || '--';
      const score = results.optimization_score?.total_score || results.score || '--';
      const dateStr = p.created_at ? new Date(p.created_at).toLocaleDateString() : 'Recent';

      const card = document.createElement('div');
      card.className = 'card';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.innerHTML = `
        <div class="card-header" style="margin-bottom: 12px;">
          <div>
            <h4 style="color: #063B70; font-size: 1.05rem; font-weight: 700; margin: 0;">${p.name}</h4>
            <span style="font-size: 0.76rem; color: #537592;">${p.island_name || 'Island'} • Saved on ${dateStr}</span>
          </div>
          <span style="background: rgba(8, 125, 181, 0.1); color: #087DB5; font-size: 0.72rem; font-weight: 700; padding: 3px 8px; border-radius: 12px;">
            ${p.tags || 'Microgrid'}
          </span>
        </div>

        <p style="font-size: 0.82rem; color: #537592; flex: 1; margin-bottom: 14px;">
          ${p.description || 'Custom hybrid renewable microgrid plan.'}
        </p>

        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; background: #EEF6FB; padding: 10px 14px; border-radius: 8px; margin-bottom: 16px;">
          <div>
            <div style="font-size: 0.7rem; color: #537592; text-transform: uppercase;">Renewable Mix</div>
            <div style="font-size: 1.15rem; font-weight: 800; color: #087DB5;">${renPct}%</div>
          </div>
          <div>
            <div style="font-size: 0.7rem; color: #537592; text-transform: uppercase;">Opt. Score</div>
            <div style="font-size: 1.15rem; font-weight: 800; color: #10B981;">${score}</div>
          </div>
        </div>

        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="btn btn-primary btn-sm" style="flex: 1;" onclick="BlueGridProjects.openProject(${p.id})">
            <i class="fa-solid fa-folder-open"></i> Open
          </button>
          <button class="btn btn-outline btn-sm" title="Duplicate Project" onclick="BlueGridProjects.duplicateProject(${p.id})">
            <i class="fa-solid fa-copy"></i>
          </button>
          <button class="btn btn-outline btn-sm" title="Export JSON" onclick="BlueGridProjects.exportProject(${p.id})">
            <i class="fa-solid fa-download"></i>
          </button>
          <button class="btn btn-outline btn-sm" style="color: #EF4444; border-color: #EF4444;" title="Delete" onclick="BlueGridProjects.deleteProject(${p.id})">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      `;
      container.appendChild(card);
    });
  }

  function promptSaveCurrentPlan() {
    const lastOpt = localStorage.getItem('bluegrid_last_optimization');
    if (!lastOpt) {
      BlueGridApp.showToast('Please run an optimization first before saving.', 'warning');
      return;
    }

    const optData = JSON.parse(lastOpt);
    const islandName = optData.island_name || 'Island';

    const defaultName = `${islandName} Renewable Transition 2030`;
    const inputName = prompt("Enter a Project Name to save this optimization:", defaultName);
    if (!inputName || !inputName.trim()) return;

    const notes = prompt("Enter optional project notes/description:", "Hybrid Solar + Wind + OTEC microgrid configuration.");

    const projectPayload = {
      name: inputName.trim(),
      description: notes || '',
      island_id: optData.island_id,
      island_name: islandName,
      inputs: optData.inputs || {},
      results: optData,
      simulation: {},
      tags: `${islandName}, Hybrid RE`
    };

    BlueGridAPI.saveProject(projectPayload).then(res => {
      BlueGridApp.showToast(`Project '${inputName}' saved successfully!`, 'success');
      loadProjectsList();
    });
  }

  async function openProject(projectId) {
    const projects = await BlueGridAPI.getProjects();
    const target = projects.find(p => p.id == projectId);
    if (!target) {
      BlueGridApp.showToast('Project could not be found.', 'error');
      return;
    }

    let results = target.results || {};
    if (target.results_json && typeof target.results_json === 'string') {
      try { results = JSON.parse(target.results_json); } catch (e) {}
    }

    if (!results || Object.keys(results).length === 0) {
      BlueGridApp.showToast('Project has no recorded optimization results.', 'warning');
      return;
    }

    // Save to active optimization cache
    localStorage.setItem('bluegrid_last_optimization', JSON.stringify(results));

    // Render results view and navigate
    BlueGridApp.renderOptimizationResults(results);
    BlueGridApp.navigateTo('results');
    BlueGridApp.showToast(`Opened project: ${target.name}`, 'success');
  }

  async function duplicateProject(projectId) {
    const res = await fetch(`/api/projects/${projectId}/duplicate`, { method: 'POST' }).catch(() => null);
    if (res && res.ok) {
      BlueGridApp.showToast('Project duplicated successfully.', 'success');
      loadProjectsList();
      return;
    }

    // Local duplicate fallback
    const projects = await BlueGridAPI.getProjects();
    const orig = projects.find(p => p.id == projectId);
    if (orig) {
      const cloned = JSON.parse(JSON.stringify(orig));
      cloned.name = `${orig.name} (Copy)`;
      cloned.id = Date.now();
      await BlueGridAPI.saveProject(cloned);
      BlueGridApp.showToast(`Duplicated as '${cloned.name}'`, 'success');
      loadProjectsList();
    }
  }

  async function deleteProject(projectId) {
    if (!confirm('Are you sure you want to delete this saved project?')) return;
    await BlueGridAPI.deleteProject(projectId);
    BlueGridApp.showToast('Project removed.', 'success');
    loadProjectsList();
  }

  async function exportProject(projectId) {
    const projects = await BlueGridAPI.getProjects();
    const target = projects.find(p => p.id == projectId);
    if (!target) return;

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(target, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${target.name.replace(/\s+/g, '_')}_BlueGrid_Plan.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    BlueGridApp.showToast(`Exported '${target.name}' to JSON`, 'success');
  }

  function handleImportJson(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        if (!imported.name) imported.name = file.name.replace('.json', '');
        await BlueGridAPI.saveProject(imported);
        BlueGridApp.showToast(`Imported project '${imported.name}'`, 'success');
        loadProjectsList();
      } catch (err) {
        BlueGridApp.showToast('Invalid JSON project file.', 'error');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  return {
    loadProjectsList,
    promptSaveCurrentPlan,
    openProject,
    duplicateProject,
    deleteProject,
    exportProject,
    handleImportJson
  };
})();

window.BlueGridProjects = BlueGridProjects;
