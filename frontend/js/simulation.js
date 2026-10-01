/**
 * BlueGrid AI — Interactive Simulation Controller
 * Section 3 & Section 18 Implementation: Live slider recalculations without page reload
 */

const BlueGridSimulation = (() => {
  let debounceTimer = null;
  let activeIsland = null;

  function initSimulation(island) {
    activeIsland = island || {
      name: "Agatti",
      average_demand_mw: 0.45,
      peak_demand_mw: 0.70,
      existing_solar_kw: 100,
      existing_wind_kw: 0,
      existing_otec_kw: 0,
      battery_kwh: 500
    };

    // Populate initial slider values
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
      const label = document.getElementById(id + 'Val');
      if (label) label.textContent = val;
    };

    setVal('simDemandMult', 1.0);
    setVal('simSolar', Math.round(activeIsland.peak_demand_mw * 1000 * 1.2));
    setVal('simWind', Math.round(activeIsland.average_demand_mw * 1000 * 0.6));
    setVal('simOtec', Math.round(activeIsland.average_demand_mw * 1000 * 0.5));
    setVal('simBattery', Math.round(activeIsland.peak_demand_mw * 1000 * 2.5));
    setVal('simRenTarget', 85);

    attachSliderListeners();
    triggerSimulationRun();
  }

  function attachSliderListeners() {
    const sliders = [
      { id: 'simDemandMult', suffix: 'x' },
      { id: 'simSolar', suffix: ' kW' },
      { id: 'simWind', suffix: ' kW' },
      { id: 'simOtec', suffix: ' kW' },
      { id: 'simBattery', suffix: ' kWh' },
      { id: 'simRenTarget', suffix: '%' }
    ];

    sliders.forEach(({ id, suffix }) => {
      const el = document.getElementById(id);
      const valLabel = document.getElementById(id + 'Val');
      if (el) {
        el.oninput = (e) => {
          if (valLabel) valLabel.textContent = `${e.target.value}${suffix}`;
          debouncedRun();
        };
      }
    });
  }

  function debouncedRun() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      triggerSimulationRun();
    }, 120);
  }

  async function triggerSimulationRun() {
    // Switch to SIMULATION MODE indicator
    BlueGridAPI.setMode('SIMULATION');

    const mult = parseFloat(document.getElementById('simDemandMult')?.value || 1.0);
    const solarKw = parseFloat(document.getElementById('simSolar')?.value || 500);
    const windKw = parseFloat(document.getElementById('simWind')?.value || 200);
    const otecKw = parseFloat(document.getElementById('simOtec')?.value || 250);
    const batteryKwh = parseFloat(document.getElementById('simBattery')?.value || 1000);
    const renTarget = parseFloat(document.getElementById('simRenTarget')?.value || 85);

    const baseAvg = activeIsland ? activeIsland.average_demand_mw : 0.45;
    const basePeak = activeIsland ? activeIsland.peak_demand_mw : 0.70;

    const simParams = {
      demand_multiplier: mult,
      solar_kw: solarKw,
      wind_kw: windKw,
      otec_kw: otecKw,
      battery_kwh: batteryKwh,
      base_avg_demand_mw: baseAvg,
      base_peak_demand_mw: basePeak,
      target_renewable_pct: renTarget
    };

    const res = await BlueGridAPI.runSimulation(simParams);
    renderSimulationOutputs(res);
  }

  function renderSimulationOutputs(sim) {
    const setHtml = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = text;
    };

    setHtml('simOutRenPct', `${sim.renewable_penetration_pct}%`);
    setHtml('simOutDieselRed', `${sim.diesel_reduction_pct}%`);
    setHtml('simOutCo2', `${sim.co2_reduction_tons.toLocaleString()} <span style="font-size:0.9rem">Tons</span>`);
    setHtml('simOutScore', `${sim.score} <span style="font-size:0.9rem">/100</span>`);
    setHtml('simOutEffectiveLoad', `${(sim.effective_peak_demand_mw).toFixed(2)} MW Peak (${(sim.effective_avg_demand_mw).toFixed(2)} MW Avg)`);

    // Update Diurnal Chart in Simulation Panel
    if (sim.balance && sim.dispatch) {
      BlueGridCharts.renderDiurnalDispatchChart('simDiurnalChart', sim.balance, sim.dispatch);
    }

    // Dynamic Suitability Assessment Update
    const suitSolar = sim.solar_kw > (sim.effective_avg_demand_mw * 1000 * 0.8) ? '🟢 High Solar' : '🟡 Modest Solar';
    const suitOtec = sim.otec_kw > 100 ? '🟢 Stable Baseload Active' : '⚪ Zero OTEC Baseload';
    const suitBatt = sim.battery_kwh > (sim.effective_peak_demand_mw * 1000 * 1.5) ? '🟢 Sufficient Storage' : '🔴 Battery Storage Tight';

    setHtml('simSuitabilityNotes', `
      <div style="font-size: 0.85rem; line-height: 1.6; color: #082B45;">
        <div>• <strong>Solar Contribution:</strong> ${suitSolar} (${sim.solar_kw.toLocaleString()} kW)</div>
        <div>• <strong>Ocean Thermal:</strong> ${suitOtec} (${sim.otec_kw.toLocaleString()} kW)</div>
        <div>• <strong>Storage Buffer:</strong> ${suitBatt} (${sim.battery_kwh.toLocaleString()} kWh)</div>
        <div>• <strong>Grid Reliability:</strong> Loss of load risk: <strong>${sim.loss_of_load_prob_pct}%</strong></div>
      </div>
    `);
  }

  return {
    initSimulation,
    triggerSimulationRun
  };
})();

window.BlueGridSimulation = BlueGridSimulation;
