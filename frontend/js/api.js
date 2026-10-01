/**
 * BlueGrid AI — API Client & Offline Fallback Bridge
 * Transparently orchestrates requests between Flask REST backend and local browser engine/storage.
 */

const BlueGridAPI = (() => {
  const API_BASE = window.location.origin.includes('5000') || window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
    ? ''
    : 'http://localhost:5000';

  let isBackendOnline = false;
  let currentMode = 'ONLINE'; // 'ONLINE' | 'OFFLINE' | 'SIMULATION'
  const modeListeners = [];

  function onModeChange(callback) {
    modeListeners.push(callback);
  }

  function setMode(newMode) {
    if (currentMode !== newMode) {
      currentMode = newMode;
      modeListeners.forEach(fn => fn(currentMode));
    }
  }

  function getMode() {
    return currentMode;
  }

  async function checkHealth() {
    try {
      const res = await fetch(`${API_BASE}/api/health`, { method: 'GET', cache: 'no-cache', headers: { 'Accept': 'application/json' } });
      if (res.ok) {
        const data = await res.json();
        isBackendOnline = true;
        if (currentMode !== 'SIMULATION') setMode('ONLINE');
        return { online: true, data };
      }
    } catch (e) {
      // Backend is offline or unreachable
    }
    isBackendOnline = false;
    if (currentMode !== 'SIMULATION') setMode('OFFLINE');
    return { online: false, data: null };
  }

  // --- Island Catalog ---
  const DEFAULT_LOCAL_ISLANDS = [
    {
      id: 1, name: "Agatti", region: "Lakshadweep", state_ut: "Lakshadweep UT",
      latitude: 10.8533, longitude: 72.1944, population: 8000, area_sqkm: 3.84,
      peak_demand_mw: 0.70, average_demand_mw: 0.45,
      solar_potential: 0.22, wind_potential: 0.32, otec_potential: 0.82,
      existing_solar_kw: 100, existing_wind_kw: 0, existing_otec_kw: 0,
      existing_diesel_kw: 950, battery_kwh: 500, depth_1000m_dist_km: 3.2,
      surface_temp_c: 28.6, deep_sea_temp_c: 6.2,
      description: "Coral atoll island with domestic airport. Heavily dependent on barged diesel. High solar irradiance and ideal bathymetry for deep-sea cold water intake within 3.5 km offshore."
    },
    {
      id: 2, name: "Kavaratti", region: "Lakshadweep", state_ut: "Lakshadweep UT",
      latitude: 10.5669, longitude: 72.6420, population: 12000, area_sqkm: 4.22,
      peak_demand_mw: 1.40, average_demand_mw: 0.85,
      solar_potential: 0.21, wind_potential: 0.34, otec_potential: 0.85,
      existing_solar_kw: 250, existing_wind_kw: 50, existing_otec_kw: 65,
      existing_diesel_kw: 1800, battery_kwh: 1000, depth_1000m_dist_km: 2.1,
      surface_temp_c: 29.1, deep_sea_temp_c: 5.8,
      description: "Administrative capital of Lakshadweep. Site of NIOT's pioneering Low Temperature Thermal Desalination (LTTD) plant. Prime site for integrated OTEC + Desalination hybrid microgrid."
    },
    {
      id: 3, name: "Minicoy", region: "Lakshadweep", state_ut: "Lakshadweep UT",
      latitude: 8.2828, longitude: 73.0489, population: 11000, area_sqkm: 4.80,
      peak_demand_mw: 0.95, average_demand_mw: 0.60,
      solar_potential: 0.20, wind_potential: 0.38, otec_potential: 0.84,
      existing_solar_kw: 150, existing_wind_kw: 0, existing_otec_kw: 0,
      existing_diesel_kw: 1200, battery_kwh: 600, depth_1000m_dist_km: 1.8,
      surface_temp_c: 29.4, deep_sea_temp_c: 5.5,
      description: "Southernmost island along 9-Degree shipping channel. Superior monsoon and offshore wind potential combined with steep bathymetric ocean slope."
    },
    {
      id: 4, name: "Andrott", region: "Lakshadweep", state_ut: "Lakshadweep UT",
      latitude: 10.8167, longitude: 73.6667, population: 11500, area_sqkm: 4.90,
      peak_demand_mw: 1.10, average_demand_mw: 0.70,
      solar_potential: 0.22, wind_potential: 0.30, otec_potential: 0.80,
      existing_solar_kw: 120, existing_wind_kw: 0, existing_otec_kw: 0,
      existing_diesel_kw: 1400, battery_kwh: 400, depth_1000m_dist_km: 4.0,
      surface_temp_c: 28.8, deep_sea_temp_c: 6.4,
      description: "Largest island in Lakshadweep by land area. East-west orientation offers extensive rooftop and ground-mounted solar corridors alongside lagoon-facing wind turbines."
    },
    {
      id: 5, name: "Kalpeni", region: "Lakshadweep", state_ut: "Lakshadweep UT",
      latitude: 10.0833, longitude: 73.6333, population: 4500, area_sqkm: 2.79,
      peak_demand_mw: 0.50, average_demand_mw: 0.30,
      solar_potential: 0.21, wind_potential: 0.33, otec_potential: 0.81,
      existing_solar_kw: 80, existing_wind_kw: 0, existing_otec_kw: 0,
      existing_diesel_kw: 600, battery_kwh: 300, depth_1000m_dist_km: 2.8,
      surface_temp_c: 28.7, deep_sea_temp_c: 6.1,
      description: "Picturesque atoll with a massive shallow lagoon. Excellent floating solar potential in sheltered lagoon areas and coastal breeze utilization."
    },
    {
      id: 6, name: "Kadmat", region: "Lakshadweep", state_ut: "Lakshadweep UT",
      latitude: 11.2333, longitude: 72.7833, population: 5500, area_sqkm: 3.20,
      peak_demand_mw: 0.60, average_demand_mw: 0.38,
      solar_potential: 0.22, wind_potential: 0.31, otec_potential: 0.82,
      existing_solar_kw: 100, existing_wind_kw: 0, existing_otec_kw: 0,
      existing_diesel_kw: 800, battery_kwh: 400, depth_1000m_dist_km: 2.5,
      surface_temp_c: 28.9, deep_sea_temp_c: 6.0,
      description: "Narrow elongated island with vibrant coral reefs and marine tourism. High environmental sensitivity calls for zero-diesel transition."
    },
    {
      id: 7, name: "Havelock (Swaraj Dweep)", region: "Andaman & Nicobar", state_ut: "Andaman & Nicobar Islands UT",
      latitude: 11.9800, longitude: 92.9800, population: 6500, area_sqkm: 92.2,
      peak_demand_mw: 2.20, average_demand_mw: 1.40,
      solar_potential: 0.19, wind_potential: 0.28, otec_potential: 0.78,
      existing_solar_kw: 300, existing_wind_kw: 0, existing_otec_kw: 0,
      existing_diesel_kw: 2800, battery_kwh: 1200, depth_1000m_dist_km: 6.5,
      surface_temp_c: 28.2, deep_sea_temp_c: 6.8,
      description: "Major ecotourism hub in the Andaman Sea. Heavy daytime and evening tourist demand fluctuations. Clean microgrid essential to preserve marine sanctuaries."
    },
    {
      id: 8, name: "Neil Island (Shaheed Dweep)", region: "Andaman & Nicobar", state_ut: "Andaman & Nicobar Islands UT",
      latitude: 11.8333, longitude: 93.0500, population: 3200, area_sqkm: 18.9,
      peak_demand_mw: 0.80, average_demand_mw: 0.50,
      solar_potential: 0.19, wind_potential: 0.29, otec_potential: 0.78,
      existing_solar_kw: 150, existing_wind_kw: 0, existing_otec_kw: 0,
      existing_diesel_kw: 1000, battery_kwh: 500, depth_1000m_dist_km: 5.2,
      surface_temp_c: 28.3, deep_sea_temp_c: 6.7,
      description: "Vegetable bowl of the Andamans. Flatter topography enables ground solar arrays, micro-wind clusters, and community agrivoltaics."
    },
    {
      id: 9, name: "Car Nicobar", region: "Andaman & Nicobar", state_ut: "Andaman & Nicobar Islands UT",
      latitude: 9.1667, longitude: 92.7667, population: 18000, area_sqkm: 126.9,
      peak_demand_mw: 2.50, average_demand_mw: 1.60,
      solar_potential: 0.20, wind_potential: 0.34, otec_potential: 0.82,
      existing_solar_kw: 400, existing_wind_kw: 100, existing_otec_kw: 0,
      existing_diesel_kw: 3200, battery_kwh: 1500, depth_1000m_dist_km: 3.8,
      surface_temp_c: 28.9, deep_sea_temp_c: 6.0,
      description: "Northernmost Nicobar island with significant tribal communities and defense base. High maritime wind shear and strong equatorial thermocline."
    },
    {
      id: 10, name: "Diu Island", region: "Western Coast", state_ut: "Dadra & Nagar Haveli and Daman & Diu",
      latitude: 20.7144, longitude: 70.9874, population: 24000, area_sqkm: 40.0,
      peak_demand_mw: 4.80, average_demand_mw: 3.10,
      solar_potential: 0.24, wind_potential: 0.36, otec_potential: 0.45,
      existing_solar_kw: 2000, existing_wind_kw: 600, existing_otec_kw: 0,
      existing_diesel_kw: 3000, battery_kwh: 3000, depth_1000m_dist_km: 35.0,
      surface_temp_c: 27.5, deep_sea_temp_c: 12.0,
      description: "First Indian island territory to run 100% on daytime solar energy during sunny months. Coastal wind and large battery storage expansion model."
    },
    {
      id: 11, name: "St. Mary's Island", region: "Karnataka Coast", state_ut: "Karnataka",
      latitude: 13.3789, longitude: 74.6736, population: 1200, area_sqkm: 1.5,
      peak_demand_mw: 0.30, average_demand_mw: 0.18,
      solar_potential: 0.22, wind_potential: 0.38, otec_potential: 0.70,
      existing_solar_kw: 50, existing_wind_kw: 20, existing_otec_kw: 0,
      existing_diesel_kw: 350, battery_kwh: 200, depth_1000m_dist_km: 12.0,
      surface_temp_c: 28.4, deep_sea_temp_c: 8.0,
      description: "Geological monument of columnar basaltic lava. Micro-community and tourism research eco-sanctuary."
    }
  ];

  async function getIslands(search = '', region = 'All') {
    // Try backend if online
    if (isBackendOnline) {
      try {
        const url = new URL(`${API_BASE}/api/islands`, window.location.origin);
        if (search) url.searchParams.set('search', search);
        if (region && region !== 'All') url.searchParams.set('region', region);
        const res = await fetch(url.toString());
        if (res.ok) {
          const data = await res.json();
          // Cache to localStorage
          localStorage.setItem('bluegrid_cached_islands', JSON.stringify(data.islands));
          return data.islands;
        }
      } catch (err) {
        console.warn('Backend islands fetch failed, switching to local cache:', err);
        setMode('OFFLINE');
      }
    }

    // Offline fallback from localStorage or defaults
    let islands = DEFAULT_LOCAL_ISLANDS;
    const cached = localStorage.getItem('bluegrid_cached_islands');
    if (cached) {
      try { islands = JSON.parse(cached); } catch (e) {}
    }

    // Filter locally
    return islands.filter(i => {
      const matchRegion = (!region || region === 'All') || (i.region && i.region.toLowerCase() === region.toLowerCase());
      const matchSearch = !search ||
        (i.name && i.name.toLowerCase().includes(search.toLowerCase())) ||
        (i.region && i.region.toLowerCase().includes(search.toLowerCase())) ||
        (i.state_ut && i.state_ut.toLowerCase().includes(search.toLowerCase()));
      return matchRegion && matchSearch;
    });
  }

  async function getIslandById(id) {
    if (isBackendOnline) {
      try {
        const res = await fetch(`${API_BASE}/api/islands/${id}`);
        if (res.ok) {
          const data = await res.json();
          return data.island;
        }
      } catch (e) {
        setMode('OFFLINE');
      }
    }
    const islands = await getIslands();
    return islands.find(i => i.id == id) || islands[0];
  }

  // --- Optimization ---
  async function runOptimization(params) {
    if (isBackendOnline) {
      try {
        const res = await fetch(`${API_BASE}/api/optimize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params)
        });
        if (res.ok) {
          const data = await res.json();
          localStorage.setItem('bluegrid_last_optimization', JSON.stringify(data));
          return data;
        }
      } catch (e) {
        console.warn('Backend optimize call failed, running local browser optimization:', e);
        setMode('OFFLINE');
      }
    }

    // Local client-side optimization execution
    const localResult = BlueGridLocalOptimizer.optimize(params);
    localResult.run_id = 'local_' + Date.now();
    localStorage.setItem('bluegrid_last_optimization', JSON.stringify(localResult));
    return localResult;
  }

  // --- Simulation ---
  async function runSimulation(params) {
    if (isBackendOnline) {
      try {
        const res = await fetch(`${API_BASE}/api/simulate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params)
        });
        if (res.ok) {
          return await res.json();
        }
      } catch (e) {
        setMode('OFFLINE');
      }
    }

    return BlueGridLocalOptimizer.simulate(params);
  }

  // --- Saved Projects ---
  async function getProjects() {
    if (isBackendOnline) {
      try {
        const res = await fetch(`${API_BASE}/api/projects`);
        if (res.ok) {
          const data = await res.json();
          localStorage.setItem('bluegrid_saved_projects', JSON.stringify(data.projects));
          return data.projects;
        }
      } catch (e) {
        setMode('OFFLINE');
      }
    }

    const localProjects = localStorage.getItem('bluegrid_saved_projects');
    return localProjects ? JSON.parse(localProjects) : [];
  }

  async function saveProject(projectData) {
    if (isBackendOnline) {
      try {
        const res = await fetch(`${API_BASE}/api/projects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(projectData)
        });
        if (res.ok) {
          return await res.json();
        }
      } catch (e) {
        setMode('OFFLINE');
      }
    }

    // Save to local storage
    const projects = await getProjects();
    const newProj = {
      id: Date.now(),
      name: projectData.name || 'Untitled Plan',
      description: projectData.description || '',
      island_id: projectData.island_id,
      island_name: projectData.island_name || 'Island',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      inputs_json: JSON.stringify(projectData.inputs || {}),
      results_json: JSON.stringify(projectData.results || {}),
      simulation_json: JSON.stringify(projectData.simulation || {}),
      tags: projectData.tags || 'Hybrid RE, Microgrid'
    };
    projects.unshift(newProj);
    localStorage.setItem('bluegrid_saved_projects', JSON.stringify(projects));
    return { status: 'success', id: newProj.id, message: 'Saved to local browser storage.' };
  }

  async function deleteProject(id) {
    if (isBackendOnline) {
      try {
        const res = await fetch(`${API_BASE}/api/projects/${id}`, { method: 'DELETE' });
        if (res.ok) return await res.json();
      } catch (e) {
        setMode('OFFLINE');
      }
    }

    let projects = await getProjects();
    projects = projects.filter(p => p.id != id);
    localStorage.setItem('bluegrid_saved_projects', JSON.stringify(projects));
    return { status: 'success', message: 'Project removed from local storage' };
  }

  // --- Reports ---
  async function getReport(runId) {
    if (isBackendOnline && typeof runId === 'number') {
      try {
        const res = await fetch(`${API_BASE}/api/report/${runId}`);
        if (res.ok) {
          const data = await res.json();
          return data.report;
        }
      } catch (e) {
        setMode('OFFLINE');
      }
    }

    // Generate report object from last cached optimization
    const lastOpt = JSON.parse(localStorage.getItem('bluegrid_last_optimization') || '{}');
    return generateClientReport(lastOpt);
  }

  function generateClientReport(opt) {
    const islandName = opt.island_name || 'Target Island';
    const rec = opt.recommended_capacities || {};
    const mix = opt.energy_mix || {};
    const env = opt.environmental_impact || {};
    const score = opt.optimization_score || {};
    const plantCounts = opt.plant_counts || {};

    return {
      title: "BLUEGRID AI — Island Renewable Energy Optimization Report",
      run_id: opt.run_id || 'OFFLINE-RUN',
      generated_at: new Date().toLocaleString(),
      island_name: islandName,
      sections: {
        "1_island_profile": {
          title: "1. Island Profile",
          name: islandName,
          region: opt.inputs?.region || "Coastal Island",
          population: opt.inputs?.population || 8000,
          description: "Isolated island microgrid evaluated for hybrid solar, wind, OTEC, and battery storage integration."
        },
        "2_current_energy_infrastructure": {
          title: "2. Current Energy Infrastructure",
          existing_solar_kw: opt.inputs?.existing_solar_kw || 0,
          existing_wind_kw: opt.inputs?.existing_wind_kw || 0,
          existing_otec_kw: opt.inputs?.existing_otec_kw || 0,
          existing_diesel_kw: opt.inputs?.existing_diesel_kw || 1000,
          existing_battery_kwh: opt.inputs?.battery_kwh || 0
        },
        "3_energy_demand": {
          title: "3. Energy Demand",
          peak_demand_mw: opt.inputs?.peak_demand_mw || 0.70,
          average_demand_mw: opt.inputs?.average_demand_mw || 0.45,
          annual_demand_mwh: opt.energy_balance?.annual_demand_mwh || 3942.0
        },
        "4_renewable_potential": {
          title: "4. Renewable Potential",
          solar_cf: opt.inputs?.solar_cf || 0.20,
          wind_cf: opt.inputs?.wind_cf || 0.35,
          otec_cf: opt.inputs?.otec_cf || 0.80
        },
        "5_recommended_energy_mix": {
          title: "5. Recommended Energy Mix",
          solar_pct: mix.solar_pct || 0,
          wind_pct: mix.wind_pct || 0,
          otec_pct: mix.otec_pct || 0,
          battery_pct: mix.battery_pct || 0,
          diesel_pct: mix.diesel_pct || 0,
          total_renewable_pct: mix.renewable_total_pct || 85,
          recommended_capacities: rec
        },
        "6_plant_suitability": {
          title: "6. Plant Suitability Analysis",
          suitability_matrix: opt.suitability || {},
          plant_counts: plantCounts
        },
        "7_battery_recommendation": {
          title: "7. Battery Recommendation",
          recommended_kwh: rec.battery_kwh || 0,
          role: "Night-peak buffering, solar surplus capture, and grid inertia regulation."
        },
        "8_renewable_contribution": {
          title: "8. Renewable Contribution",
          annual_renewable_generation_mwh: opt.energy_balance?.annual_ren_mwh || 0,
          renewable_penetration_achieved_pct: mix.renewable_total_pct || 0
        },
        "9_diesel_reduction": {
          title: "9. Diesel Reduction",
          diesel_reduction_pct: env.diesel_reduction_pct || 0,
          diesel_fuel_saved_liters_annual: env.diesel_liters_saved_annual || 0,
          annual_fuel_cost_savings_usd: env.fuel_cost_savings_usd || 0
        },
        "10_co2_reduction": {
          title: "10. CO₂ Reduction",
          co2_avoided_tons_annual: env.co2_reduction_tons_annual || 0,
          equivalent_trees_planted: Math.round((env.co2_reduction_tons_annual || 0) * 45)
        },
        "11_optimization_score": {
          title: "11. Optimization Score",
          total_score: score.total_score || 90,
          grade: score.grade || "Optimal (Tier 1)",
          formula_explanation: score.formula_explanation || ""
        },
        "12_simulation_results": {
          title: "12. Simulation Dynamics",
          loss_of_load_probability_pct: opt.dispatch_simulation?.loss_of_load_prob_pct || 0.0,
          grid_resilience_rating: "High (N-1 Generation Contingency with Standby Reserve)"
        },
        "13_recommendations": {
          title: "13. Recommendations & Phasing Strategy",
          phase_1: "Deploy rooftop/ground solar PV and initial BESS battery buffer.",
          phase_2: "Install coastal wind turbines for evening and seasonal monsoon wind capture.",
          phase_3: "Deploy OTEC deep-sea cold intake for continuous 24/7 clean baseload and desalination.",
          phase_4: "Retain diesel generators strictly as cold emergency standby."
        },
        "14_technical_summary": {
          title: "14. Technical Summary",
          summary_statement: `BlueGrid AI plan achieves ${mix.renewable_total_pct || 85}% renewable penetration, cutting ${env.diesel_liters_saved_annual?.toLocaleString() || 0} liters of diesel and avoiding ${env.co2_reduction_tons_annual?.toLocaleString() || 0} tons of CO2 annually.`
        }
      }
    };
  }

  // Initial check on load
  checkHealth();
  setInterval(checkHealth, 15000);

  return {
    checkHealth,
    getIslands,
    getIslandById,
    runOptimization,
    runSimulation,
    getProjects,
    saveProject,
    deleteProject,
    getReport,
    getMode,
    setMode,
    onModeChange
  };
})();

window.BlueGridAPI = BlueGridAPI;
