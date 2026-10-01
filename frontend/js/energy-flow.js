/**
 * BlueGrid AI — Animated Energy Flow Visualization Controller
 * Section 16 Implementation: Generation -> Storage -> Consumption
 */

const BlueGridEnergyFlow = (() => {
  function updateFlow(data) {
    const recCap = data.recommended_capacities || {};
    const mix = data.energy_mix || {};
    const balance = data.energy_balance || {};
    const dispatch = data.dispatch_simulation || {};

    // Get midday peak values for demonstration
    const middaySolar = balance.solar_hourly_kw ? balance.solar_hourly_kw[12] : (recCap.solar_kw || 0);
    const avgWind = balance.wind_hourly_kw ? balance.wind_hourly_kw[14] : (recCap.wind_kw || 0);
    const otecBase = recCap.otec_kw ? Math.round(recCap.otec_kw * 0.8) : 0;
    const battPower = dispatch.charge_kw ? dispatch.charge_kw[12] : Math.round(recCap.battery_kwh * 0.2);
    const avgLoad = balance.demand_hourly_kw ? balance.demand_hourly_kw[12] : Math.round((data.inputs?.average_demand_mw || 0.45) * 1000);

    // Update Node Text Labels
    const setText = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    setText('flowSolarVal', `${middaySolar.toLocaleString()} kW`);
    setText('flowSolarSub', `${mix.solar_pct || 0}% of Mix`);

    setText('flowWindVal', `${avgWind.toLocaleString()} kW`);
    setText('flowWindSub', `${mix.wind_pct || 0}% of Mix`);

    setText('flowOtecVal', `${otecBase.toLocaleString()} kW`);
    setText('flowOtecSub', `${mix.otec_pct || 0}% Continuous`);

    setText('flowHubVal', `${(middaySolar + avgWind + otecBase).toLocaleString()} kW`);
    setText('flowHubSub', `${mix.renewable_total_pct || 85}% Clean Energy`);

    setText('flowBatteryVal', `${(recCap.battery_kwh || 0).toLocaleString()} kWh`);
    setText('flowBatterySub', `Buffer & Peak Shift`);

    setText('flowLoadVal', `${avgLoad.toLocaleString()} kW`);
    setText('flowLoadSub', `Island Microgrid Load`);

    // Animate SVG Conduit lines
    updateConduitPaths();
  }

  function updateConduitPaths() {
    const svg = document.getElementById('energyFlowSvg');
    if (!svg) return;

    const solarEl = document.querySelector('.flow-node.solar');
    const windEl = document.querySelector('.flow-node.wind');
    const otecEl = document.querySelector('.flow-node.otec');
    const hubEl = document.querySelector('.flow-node.hub');
    const battEl = document.querySelector('.flow-node.battery');
    const loadEl = document.querySelector('.flow-node.load');

    if (!solarEl || !windEl || !otecEl || !hubEl || !battEl || !loadEl) return;

    const containerRect = svg.getBoundingClientRect();
    if (containerRect.width === 0 || containerRect.height === 0) return;

    const getCenter = (el) => {
      const r = el.getBoundingClientRect();
      return {
        x: r.left + r.width / 2 - containerRect.left,
        y: r.top + r.height / 2 - containerRect.top
      };
    };

    const solarPos = getCenter(solarEl);
    const windPos = getCenter(windEl);
    const otecPos = getCenter(otecEl);
    const hubPos = getCenter(hubEl);
    const battPos = getCenter(battEl);
    const loadPos = getCenter(loadEl);

    // Build SVG paths
    svg.innerHTML = `
      <defs>
        <linearGradient id="streamSolar" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#FFD166" />
          <stop offset="100%" stop-color="#16C7D9" />
        </linearGradient>
        <linearGradient id="streamWind" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#16C7D9" />
          <stop offset="100%" stop-color="#16C7D9" />
        </linearGradient>
        <linearGradient id="streamOtec" x1="100%" y1="0%" x2="0%" y2="0%">
          <stop offset="0%" stop-color="#087DB5" />
          <stop offset="100%" stop-color="#16C7D9" />
        </linearGradient>
        <linearGradient id="streamBatt" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#16C7D9" />
          <stop offset="100%" stop-color="#10B981" />
        </linearGradient>
        <linearGradient id="streamLoad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#10B981" />
          <stop offset="100%" stop-color="#FF9F1C" />
        </linearGradient>
      </defs>

      <!-- Solar to Hub -->
      <path d="M ${solarPos.x} ${solarPos.y} L ${hubPos.x} ${hubPos.y}" stroke="url(#streamSolar)" stroke-width="4" fill="none" class="flow-stream" />
      
      <!-- Wind to Hub -->
      <path d="M ${windPos.x} ${windPos.y} L ${hubPos.x} ${hubPos.y}" stroke="url(#streamWind)" stroke-width="4" fill="none" class="flow-stream" />
      
      <!-- OTEC to Hub -->
      <path d="M ${otecPos.x} ${otecPos.y} L ${hubPos.x} ${hubPos.y}" stroke="url(#streamOtec)" stroke-width="4" fill="none" class="flow-stream" />
      
      <!-- Hub to Battery -->
      <path d="M ${hubPos.x} ${hubPos.y} L ${battPos.x} ${battPos.y}" stroke="url(#streamBatt)" stroke-width="4" fill="none" class="flow-stream" />
      
      <!-- Battery to Island Load -->
      <path d="M ${battPos.x} ${battPos.y} L ${loadPos.x} ${loadPos.y}" stroke="url(#streamLoad)" stroke-width="4" fill="none" class="flow-stream" />
    `;
  }

  // Update conduit coordinates on resize
  window.addEventListener('resize', () => {
    setTimeout(updateConduitPaths, 150);
  });

  return {
    updateFlow,
    updateConduitPaths
  };
})();

window.BlueGridEnergyFlow = BlueGridEnergyFlow;
