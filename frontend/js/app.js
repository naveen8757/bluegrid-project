/**
 * BlueGrid AI — Master Application Controller
 * Handles SPA navigation, particle canvas, island catalog, optimizer form submission,
 * UI reactivity, toast notifications, and PWA registration.
 */

const BlueGridApp = (() => {
  let allIslands = [];
  let selectedIsland = null;
  let activeOptimizationResult = null;

  // SPA Sections List (12 Sections from prompt)
  const SECTIONS = [
    'home', 'dashboard', 'islands', 'island-details',
    'optimizer', 'simulation', 'results', 'plants',
    'analytics', 'reports', 'projects', 'settings'
  ];

  function init() {
    registerServiceWorker();
    setupNavigation();
    initHeroParticles();
    initHealthMonitoring();
    loadIslands();

    // Support URL hash deep linking (e.g. http://localhost:5000/#islands)
    const hashTarget = window.location.hash.replace('#', '').trim();
    if (hashTarget && SECTIONS.includes(hashTarget)) {
      navigateTo(hashTarget);
    } else {
      navigateTo('home');
    }

    window.addEventListener('hashchange', () => {
      const newHash = window.location.hash.replace('#', '').trim();
      if (newHash && SECTIONS.includes(newHash)) {
        navigateTo(newHash);
      }
    });

    // Check for cached optimization
    const cachedOpt = localStorage.getItem('bluegrid_last_optimization');
    if (cachedOpt) {
      try {
        activeOptimizationResult = JSON.parse(cachedOpt);
        renderOptimizationResults(activeOptimizationResult);
      } catch (e) {}
    }

    // Set initial mode indicator
    BlueGridAPI.onModeChange(updateModeBadge);
    updateModeBadge(BlueGridAPI.getMode());
  }

  // --- Service Worker Registration ---
  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
          .then(reg => {
            console.log('[PWA] Service Worker registered:', reg.scope);
            showToast('BlueGrid is available offline.', 'success');
          })
          .catch(err => {
            console.warn('[PWA] Service Worker registration failed:', err);
          });
      });
    }
  }

  // --- Navigation & Routing ---
  function setupNavigation() {
    // Nav links click handler
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetSection = link.getAttribute('data-section');
        if (targetSection) navigateTo(targetSection);

        // Close mobile sidebar if open
        document.querySelector('.sidebar')?.classList.remove('open');
      });
    });

    // Mobile Hamburger
    const toggleBtn = document.getElementById('mobileToggleBtn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        document.querySelector('.sidebar')?.classList.toggle('open');
      });
    }

    // Mode Badge Click (allows manual mode toggling for demo)
    const modeBadge = document.getElementById('headerModeBadge');
    if (modeBadge) {
      modeBadge.addEventListener('click', () => {
        const cur = BlueGridAPI.getMode();
        if (cur === 'ONLINE') {
          BlueGridAPI.setMode('OFFLINE');
          showToast('Switched to Offline Mode (Local browser engine active)', 'warning');
        } else if (cur === 'OFFLINE') {
          BlueGridAPI.setMode('ONLINE');
          showToast('Switched to Online Mode (Flask backend sync active)', 'success');
        } else {
          BlueGridAPI.setMode('ONLINE');
        }
      });
    }
  }

  function navigateTo(sectionId) {
    if (!SECTIONS.includes(sectionId)) sectionId = 'home';

    // Hide all sections, show target
    document.querySelectorAll('.page-section').forEach(sec => {
      sec.classList.remove('active');
    });

    const targetSec = document.getElementById(`section-${sectionId}`);
    if (targetSec) {
      targetSec.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (window.location.hash.replace('#', '') !== sectionId) {
      history.replaceState(null, '', `#${sectionId}`);
    }

    // Update active nav-link
    document.querySelectorAll('.nav-link').forEach(link => {
      if (link.getAttribute('data-section') === sectionId) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Update Breadcrumb
    const bc = document.getElementById('pageBreadcrumbTitle');
    if (bc) {
      const titles = {
        'home': 'Home / Welcome',
        'dashboard': 'Executive Dashboard',
        'islands': 'Island Database & Interactive Map',
        'island-details': 'Island Renewable Resource Profile',
        'optimizer': 'Hybrid Energy Optimizer',
        'simulation': 'Real-Time Simulation Sandbox',
        'results': 'Optimal Configuration Results',
        'plants': 'Power Plant Suitability & Unit Sizing',
        'analytics': 'Energy Dispatch & Carbon Analytics',
        'reports': '14-Section Engineering Report',
        'projects': 'Saved Energy Planning Projects',
        'settings': 'System Diagnostics & NIOT Data Ingestion'
      };
      bc.textContent = titles[sectionId] || 'BlueGrid AI';
    }

    // Trigger Section-specific initializations
    if (sectionId === 'islands') {
      BlueGridMap.initMap('islandMap');
      [50, 150, 350, 700].forEach(delay => {
        setTimeout(() => {
          BlueGridMap.initMap('islandMap');
          if (allIslands && allIslands.length > 0) {
            BlueGridMap.renderMarkers(allIslands);
          }
        }, delay);
      });
    } else if (sectionId === 'simulation') {
      BlueGridSimulation.initSimulation(selectedIsland || allIslands[0]);
    } else if (sectionId === 'projects') {
      BlueGridProjects.loadProjectsList();
    } else if (sectionId === 'reports') {
      BlueGridReports.generateAndDisplayReport(activeOptimizationResult?.run_id || 1);
    } else if (sectionId === 'settings') {
      BlueGridNiotImport.initDropzone();
      checkSystemHealth();
    }
  }

  // --- Mode Indicator Badge ---
  function updateModeBadge(mode) {
    const badge = document.getElementById('headerModeBadge');
    if (!badge) return;

    badge.className = 'mode-badge';
    if (mode === 'OFFLINE') {
      badge.classList.add('mode-offline');
      badge.innerHTML = '<span class="status-dot green"></span> OFFLINE MODE';
      badge.title = 'Operating locally without internet using browser storage & client optimization engine.';
    } else if (mode === 'SIMULATION') {
      badge.classList.add('mode-simulation');
      badge.innerHTML = '<span class="status-dot purple"></span> SIMULATION MODE';
      badge.title = 'Interactive sandbox with live parameter recalculations.';
    } else {
      badge.classList.add('mode-online');
      badge.innerHTML = '<span class="status-dot blue"></span> ONLINE MODE';
      badge.title = 'Connected to Flask REST Backend and SQLite database.';
    }
  }

  // --- Island Database & Selection ---
  async function loadIslands() {
    allIslands = await BlueGridAPI.getIslands();
    populateIslandDropdowns(allIslands);
    renderIslandCards(allIslands);

    // Also populate map markers immediately
    if (typeof BlueGridMap !== 'undefined' && allIslands.length > 0) {
      BlueGridMap.initMap('islandMap');
      BlueGridMap.renderMarkers(allIslands);
    }

    // Default select first island (Agatti)
    if (allIslands.length > 0 && !selectedIsland) {
      selectIsland(allIslands[0].id, false);
    }
  }

  function populateIslandDropdowns(islands) {
    const selects = ['optIslandSelect', 'simIslandSelect'];
    selects.forEach(selId => {
      const sel = document.getElementById(selId);
      if (!sel) return;
      sel.innerHTML = islands.map(i => `<option value="${i.id}">${i.name} (${i.region})</option>`).join('');
    });
  }

  function renderIslandCards(islands) {
    const container = document.getElementById('islandsGridContainer');
    if (!container) return;

    container.innerHTML = islands.map(i => `
      <div class="card" style="display: flex; flex-direction: column;">
        <div class="card-header" style="margin-bottom: 10px;">
          <div>
            <h4 style="color: #063B70; font-size: 1.1rem; margin: 0; font-weight: 800;">${i.name}</h4>
            <span style="font-size: 0.76rem; color: #087DB5; font-weight: 600;">${i.region} • ${i.state_ut || 'India'}</span>
          </div>
          <span style="font-size: 0.72rem; background: #EEF6FB; color: #537592; padding: 2px 8px; border-radius: 12px; font-weight: 600;">
            ${(i.population || 0).toLocaleString()} hab.
          </span>
        </div>

        <p style="font-size: 0.8rem; color: #537592; flex: 1; margin-bottom: 12px; line-height: 1.4;">
          ${i.description || 'Island microgrid evaluating hybrid clean transition.'}
        </p>

        <div style="background: #F8FAFC; border-radius: 8px; padding: 10px 12px; margin-bottom: 14px; font-size: 0.78rem;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="color: #537592;">Peak / Avg Load:</span>
            <strong style="color: #082B45;">${i.peak_demand_mw} MW / ${i.average_demand_mw} MW</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="color: #537592;">☀️ Solar CF:</span>
            <strong>${i.solar_potential}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="color: #537592;">💨 Wind CF:</span>
            <strong>${i.wind_potential}</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #537592;">🌊 OTEC Viability:</span>
            <strong style="color: #087DB5;">${i.otec_potential} (ΔT ~22°C)</strong>
          </div>
        </div>

        <div style="display: flex; gap: 8px;">
          <button class="btn btn-primary btn-sm" style="flex: 1;" onclick="BlueGridApp.selectIslandAndOptimize(${i.id})">
            <i class="fa-solid fa-bolt"></i> Optimize
          </button>
          <button class="btn btn-outline btn-sm" onclick="BlueGridApp.viewIslandDetails(${i.id})">
            Details
          </button>
        </div>
      </div>
    `).join('');
  }

  function filterIslands() {
    const search = document.getElementById('islandSearchInput')?.value.trim().toLowerCase() || '';
    const region = document.getElementById('regionFilterSelect')?.value || 'All';

    const filtered = allIslands.filter(i => {
      const matchRegion = (region === 'All') || (i.region && i.region.toLowerCase() === region.toLowerCase());
      const matchSearch = !search ||
        (i.name && i.name.toLowerCase().includes(search)) ||
        (i.region && i.region.toLowerCase().includes(search)) ||
        (i.state_ut && i.state_ut.toLowerCase().includes(search));
      return matchRegion && matchSearch;
    });

    renderIslandCards(filtered);
    if (BlueGridMap) BlueGridMap.renderMarkers(filtered);
  }

  function selectIsland(islandId, navigate = false) {
    selectedIsland = allIslands.find(i => i.id == islandId) || allIslands[0];
    if (!selectedIsland) return;

    // Pre-populate Optimizer Inputs
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    };

    setVal('optPeakDemand', selectedIsland.peak_demand_mw);
    setVal('optAvgDemand', selectedIsland.average_demand_mw);
    setVal('optSolarExisting', selectedIsland.existing_solar_kw || 0);
    setVal('optWindExisting', selectedIsland.existing_wind_kw || 0);
    setVal('optOtecExisting', selectedIsland.existing_otec_kw || 0);
    setVal('optBatteryExisting', selectedIsland.battery_kwh || 0);
    setVal('optDieselExisting', selectedIsland.existing_diesel_kw || 1000);

    setVal('optSolarPot', selectedIsland.solar_potential || 0.22);
    setVal('optWindPot', selectedIsland.wind_potential || 0.32);
    setVal('optOtecPot', selectedIsland.otec_potential || 0.80);

    // Sync select dropdown
    const optSel = document.getElementById('optIslandSelect');
    if (optSel) optSel.value = selectedIsland.id;

    if (navigate) {
      navigateTo('optimizer');
    }
  }

  function selectIslandAndOptimize(islandId) {
    selectIsland(islandId, true);
    triggerOptimization();
  }

  function viewIslandDetails(islandId) {
    selectIsland(islandId, false);
    renderIslandDetailsView(selectedIsland);
    navigateTo('island-details');
    if (BlueGridMap) BlueGridMap.focusIsland(islandId);
  }

  function renderIslandDetailsView(island) {
    if (!island) return;

    const setText = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    setText('detailIslandName', island.name);
    setText('detailIslandRegion', `${island.region}, ${island.state_ut || 'India'}`);
    setText('detailIslandDesc', island.description || 'Island microgrid transition study.');
    setText('detailPop', (island.population || 0).toLocaleString());
    setText('detailArea', `${island.area_sqkm || '--'} km²`);
    setText('detailCoords', `${island.latitude.toFixed(4)}°N, ${island.longitude.toFixed(4)}°E`);
    setText('detailDemand', `${island.peak_demand_mw} MW Peak (${island.average_demand_mw} MW Avg)`);
    setText('detailDiesel', `${island.existing_diesel_kw || 0} kW (Primary Baseload)`);
    setText('detailDepth', `${island.depth_1000m_dist_km || 3.0} km to 1000m Depth`);
    setText('detailTemps', `${island.surface_temp_c}°C Surface / ${island.deep_sea_temp_c}°C Deep`);

    // Potentials Cards
    setText('detailSolarCap', `${island.existing_solar_kw || 0} kW`);
    setText('detailSolarCF', `CF: ${(island.solar_potential * 100).toFixed(0)}%`);

    setText('detailWindCap', `${island.existing_wind_kw || 0} kW`);
    setText('detailWindCF', `CF: ${(island.wind_potential * 100).toFixed(0)}%`);

    setText('detailOtecCap', `${island.existing_otec_kw || 0} kW`);
    setText('detailOtecCF', `CF: ${(island.otec_potential * 100).toFixed(0)}% (24/7 Baseload)`);

    setText('detailBatteryCap', `${island.battery_kwh || 0} kWh`);
  }

  // --- Optimization Execution ---
  async function triggerOptimization() {
    const btn = document.getElementById('btnRunOptimization');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Solving Optimization Model...';
    }

    const payload = {
      island_id: selectedIsland ? selectedIsland.id : null,
      peak_demand_mw: parseFloat(document.getElementById('optPeakDemand')?.value || 0.70),
      average_demand_mw: parseFloat(document.getElementById('optAvgDemand')?.value || 0.45),
      existing_solar_kw: parseFloat(document.getElementById('optSolarExisting')?.value || 0),
      existing_wind_kw: parseFloat(document.getElementById('optWindExisting')?.value || 0),
      existing_otec_kw: parseFloat(document.getElementById('optOtecExisting')?.value || 0),
      battery_kwh: parseFloat(document.getElementById('optBatteryExisting')?.value || 0),
      existing_diesel_kw: parseFloat(document.getElementById('optDieselExisting')?.value || 1000),
      solar_potential: parseFloat(document.getElementById('optSolarPot')?.value || 0.22),
      wind_potential: parseFloat(document.getElementById('optWindPot')?.value || 0.32),
      otec_potential: parseFloat(document.getElementById('optOtecPot')?.value || 0.80),
      target_renewable_pct: parseFloat(document.getElementById('optTargetRen')?.value || 85),
      target_reliability_pct: parseFloat(document.getElementById('optTargetRel')?.value || 99.5)
    };

    try {
      const result = await BlueGridAPI.runOptimization(payload);
      activeOptimizationResult = result;
      renderOptimizationResults(result);
      navigateTo('results');
      showToast(`Optimization complete for ${result.island_name || 'Island'}!`, 'success');
    } catch (err) {
      showToast(`Optimization failed: ${err.message}`, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-bolt"></i> Run AI Optimization';
      }
    }
  }

  // --- Render Results across Results, Power Plants, & Analytics Sections ---
  function renderOptimizationResults(res) {
    if (!res) return;

    const setHtml = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = text;
    };

    const rec = res.recommended_capacities || {};
    const mix = res.energy_mix || {};
    const env = res.environmental_impact || {};
    const score = res.optimization_score || {};
    const suitability = res.suitability || {};
    const plantCounts = res.plant_counts || {};

    // 1. KPI Cards in Results Page
    setHtml('resTargetIslandName', res.island_name || 'Island Microgrid');
    setHtml('resRenewablePct', `${mix.renewable_total_pct || 0}%`);
    setHtml('resDieselRedPct', `-${env.diesel_reduction_pct || 0}%`);
    setHtml('resCo2Avoided', `${(env.co2_reduction_tons_annual || 0).toLocaleString()} <span class="unit">Tons/yr</span>`);
    setHtml('resFuelSaved', `${(env.diesel_liters_saved_annual || 0).toLocaleString()} <span class="unit">L/yr</span>`);
    setHtml('resScoreVal', `${score.total_score || 0} <span class="unit">/100</span>`);

    // Score Assessment Callout
    setHtml('resScoreExplanation', `
      <div style="background: #FAF5FF; border: 1px solid #E9D5FF; padding: 14px 18px; border-radius: 8px; margin-bottom: 20px;">
        <div style="font-weight: 700; color: #6D28D9; font-size: 0.95rem;">${score.grade || 'Optimal'}</div>
        <div style="font-size: 0.82rem; color: #5B21B6; margin-top: 2px;">${score.assessment || ''}</div>
        <div style="font-size: 0.74rem; color: #7C3AED; font-family: monospace; margin-top: 6px;">${score.formula_explanation || ''}</div>
      </div>
    `);

    // 2. Animated Energy Flow Visualization (Section 16)
    BlueGridEnergyFlow.updateFlow(res);

    // 3. Render Chart.js Visualizations
    BlueGridCharts.renderEnergyMixDoughnut('resultsDoughnutChart', mix);
    if (res.energy_balance && res.dispatch_simulation) {
      BlueGridCharts.renderDiurnalDispatchChart('analyticsDiurnalChart', res.energy_balance, res.dispatch_simulation);
    }
    BlueGridCharts.renderCapacityBarChart('plantsBarChart', suitability);
    BlueGridCharts.renderMonthlyComparison('analyticsMonthlyChart', res.energy_balance?.annual_ren_mwh || 0, res.dispatch_simulation?.annual_diesel_mwh || 0);
    BlueGridCharts.renderEmissionsSavingsChart('analyticsSavingsChart', env.co2_reduction_tons_annual || 0, env.fuel_cost_savings_usd || 0);

    // 4. Render Power Plants Suitability (Section 13)
    renderSuitabilitySection(suitability);

    // 5. Render Plant Unit Counts (Section 14)
    renderPlantCountsSection(plantCounts);
  }

  function renderSuitabilitySection(suitability) {
    const container = document.getElementById('suitabilityCardsContainer');
    if (!container) return;

    const sources = [
      { key: 'solar', icon: '☀️', unit: 'kW' },
      { key: 'wind', icon: '💨', unit: 'kW' },
      { key: 'otec', icon: '🌊', unit: 'kW' },
      { key: 'battery', icon: '🔋', unit: 'kWh' }
    ];

    container.innerHTML = sources.map(({ key, icon, unit }) => {
      const item = suitability[key] || {};
      const status = item.status || { badge: '🟢 Suitable', color: 'green', text: 'Suitable' };
      const cur = key === 'battery' ? item.existing_kwh : item.existing_kw;
      const rec = key === 'battery' ? item.recommended_kwh : item.recommended_kw;
      const exp = key === 'battery' ? item.expansion_kwh : item.expansion_kw;

      return `
        <div class="suitability-card">
          <div class="suit-header">
            <div class="suit-title">${icon} ${item.name || key}</div>
            <span class="suit-badge ${status.color}">${status.badge}</span>
          </div>
          <p style="font-size: 0.8rem; color: #537592; margin-bottom: 12px; flex: 1;">
            ${status.text}
          </p>
          <div class="suit-metric-row">
            <span class="suit-metric-label">Current Capacity:</span>
            <span class="suit-metric-val">${(cur || 0).toLocaleString()} ${unit}</span>
          </div>
          <div class="suit-metric-row">
            <span class="suit-metric-label">Recommended Optimal:</span>
            <span class="suit-metric-val" style="color: #087DB5;">${(rec || 0).toLocaleString()} ${unit}</span>
          </div>
          <div class="suit-metric-row">
            <span class="suit-metric-label">Expansion Required:</span>
            <span class="suit-metric-val" style="color: ${exp > 0 ? '#F59E0B' : '#10B981'};">
              ${exp > 0 ? `+${exp.toLocaleString()} ${unit}` : 'None'}
            </span>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderPlantCountsSection(plantCounts) {
    const tableBody = document.getElementById('plantCountsTableBody');
    if (!tableBody) return;

    const exist = plantCounts.existing || {};
    const rec = plantCounts.recommended || {};
    const add = plantCounts.additions_required || {};
    const specs = plantCounts.unit_specs || {};

    const rows = [
      { name: 'Solar PV Plants', unitSpec: `${specs.solar_unit_kw || 250} kW Array`, exist: exist.solar_plants || 0, rec: rec.solar_plants || 0, add: add.solar_plants || 0 },
      { name: 'Wind Turbine Units', unitSpec: `${specs.wind_unit_kw || 500} kW Turbine`, exist: exist.wind_plants || 0, rec: rec.wind_plants || 0, add: add.wind_plants || 0 },
      { name: 'OTEC Closed-Cycle Plants', unitSpec: `${specs.otec_unit_kw || 500} kW Module`, exist: exist.otec_plants || 0, rec: rec.otec_plants || 0, add: add.otec_plants || 0 },
      { name: 'Battery BESS Containers', unitSpec: `${specs.battery_unit_kwh || 500} kWh System`, exist: exist.battery_systems || 0, rec: rec.battery_systems || 0, add: add.battery_systems || 0 },
      { name: 'Diesel Generator Backup', unitSpec: '400 kW Standby Genset', exist: exist.diesel_gensets || 2, rec: exist.diesel_gensets || 2, add: 0 }
    ];

    tableBody.innerHTML = rows.map(r => `
      <tr>
        <td><strong>${r.name}</strong></td>
        <td style="color: #537592; font-size: 0.82rem;">${r.unitSpec}</td>
        <td><strong>${r.exist}</strong></td>
        <td style="color: #087DB5; font-weight: 700;">${r.rec}</td>
        <td>
          <span style="font-weight: 800; color: ${r.add > 0 ? '#087DB5' : '#10B981'};">
            ${r.add > 0 ? `+${r.add} to build` : '✓ Sufficient'}
          </span>
        </td>
      </tr>
    `).join('');
  }

  // --- Hero Floating Particles Animation ---
  function initHeroParticles() {
    const canvas = document.getElementById('heroParticlesCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let particles = [];
    const count = 35;

    function resize() {
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 2.5 + 1,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -Math.random() * 0.6 - 0.2,
        alpha: Math.random() * 0.6 + 0.2
      });
    }

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#16C7D9';

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < 0) p.y = canvas.height;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;

        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });

      requestAnimationFrame(animate);
    }
    animate();
  }

  // --- System Diagnostics & Status Monitoring (Section 27) ---
  async function checkSystemHealth() {
    const health = await BlueGridAPI.checkHealth();
    const isOnline = health.online;
    const netStatus = navigator.onLine;

    const setPill = (id, label, ok) => {
      const el = document.getElementById(id);
      if (el) {
        el.innerHTML = ok ? `🟢 ${label}` : `🔴 ${label}`;
        el.style.color = ok ? '#10B981' : '#EF4444';
      }
    };

    setPill('sysDiagBackend', isOnline ? 'Connected' : 'Offline / Standalone', isOnline);
    setPill('sysDiagDb', isOnline ? 'Connected (SQLite)' : 'Local Storage Active', true);
    setPill('sysDiagOpt', 'Ready (Python & Local JS)', true);
    setPill('sysDiagCache', 'Available (Service Worker)', true);
    setPill('sysDiagInternet', netStatus ? 'Online' : 'Offline', netStatus);
    setPill('sysDiagApi', isOnline ? 'Healthy' : 'Fallback Engine Active', true);
  }

  function initHealthMonitoring() {
    window.addEventListener('online', () => {
      BlueGridAPI.checkHealth();
      showToast('Internet connection restored. Online mode enabled.', 'success');
    });
    window.addEventListener('offline', () => {
      BlueGridAPI.setMode('OFFLINE');
      showToast('Network disconnected. BlueGrid is running in Offline Mode.', 'warning');
    });
  }

  // --- Toast Notification Helper ---
  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '✓' : type === 'warning' ? '⚠' : 'ℹ';
    toast.innerHTML = `<strong>${icon}</strong> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 4500);
  }

  return {
    init,
    navigateTo,
    loadIslands,
    filterIslands,
    selectIsland,
    selectIslandAndOptimize,
    viewIslandDetails,
    triggerOptimization,
    renderOptimizationResults,
    checkSystemHealth,
    showToast
  };
})();

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  BlueGridApp.init();
});

window.BlueGridApp = BlueGridApp;
