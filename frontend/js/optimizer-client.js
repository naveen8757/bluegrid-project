/**
 * BlueGrid AI — Client-Side Local Optimization Engine
 * Mirrors the Python optimization algorithms to enable 100% standalone offline operation.
 */

const BlueGridLocalOptimizer = (() => {
  // Profiles
  const HOURLY_DEMAND_PROFILE = [
    0.68, 0.62, 0.58, 0.55, 0.58, 0.65,
    0.74, 0.86, 0.94, 0.98, 1.00, 0.98,
    0.95, 0.92, 0.90, 0.88, 0.92, 1.05,
    1.18, 1.25, 1.20, 1.10, 0.92, 0.78
  ];

  const HOURLY_SOLAR_PROFILE = [
    0.0, 0.0, 0.0, 0.0, 0.0, 0.02,
    0.15, 0.40, 0.68, 0.88, 0.98, 1.00,
    0.96, 0.85, 0.65, 0.38, 0.12, 0.01,
    0.0, 0.0, 0.0, 0.0, 0.0, 0.0
  ];

  const HOURLY_WIND_PROFILE = [
    0.42, 0.40, 0.38, 0.35, 0.36, 0.38,
    0.45, 0.52, 0.60, 0.68, 0.72, 0.75,
    0.78, 0.80, 0.82, 0.80, 0.75, 0.70,
    0.65, 0.60, 0.55, 0.50, 0.46, 0.44
  ];

  const DIESEL_LITERS_PER_KWH = 0.28;
  const DIESEL_EMISSIONS_KG_PER_KWH = 0.78;
  const DIESEL_COST_USD_PER_LITER = 1.15;
  const BATTERY_ROUNDTRIP_EFFICIENCY = 0.88;
  const BATTERY_MIN_SOC = 0.15;
  const BATTERY_MAX_DOD = 0.85;

  function getHourlyDemand(avgMw, peakMw) {
    const mean = HOURLY_DEMAND_PROFILE.reduce((a, b) => a + b, 0) / HOURLY_DEMAND_PROFILE.length;
    const targetAvgKw = avgMw * 1000.0;
    const targetPeakKw = peakMw * 1000.0;
    const profilePeak = Math.max(...HOURLY_DEMAND_PROFILE);
    const peakIdx = HOURLY_DEMAND_PROFILE.indexOf(profilePeak);

    const hourly = HOURLY_DEMAND_PROFILE.map(val => {
      let scaled = targetAvgKw * (val / mean);
      if (scaled > targetPeakKw) scaled = targetPeakKw;
      return Math.round(scaled * 10) / 10;
    });

    hourly[peakIdx] = Math.round(targetPeakKw * 10) / 10;
    return hourly;
  }

  function getHourlyRenewable(solarKw, windKw, otecKw, solarCf, windCf, otecCf) {
    const solarMean = HOURLY_SOLAR_PROFILE.reduce((a, b) => a + b, 0) / HOURLY_SOLAR_PROFILE.length;
    const windMean = HOURLY_WIND_PROFILE.reduce((a, b) => a + b, 0) / HOURLY_WIND_PROFILE.length;

    const solar = HOURLY_SOLAR_PROFILE.map(val => Math.round((solarKw * (val / solarMean) * solarCf) * 10) / 10);
    const wind = HOURLY_WIND_PROFILE.map(val => Math.round((windKw * (val / windMean) * windCf) * 10) / 10);
    const otec = new Array(24).fill(Math.round((otecKw * otecCf) * 10) / 10);
    const total = solar.map((s, i) => Math.round((s + wind[i] + otec[i]) * 10) / 10);

    return { solar, wind, otec, total_renewable: total };
  }

  function calculateBalance(avgMw, peakMw, solarKw, windKw, otecKw, solarCf = 0.20, windCf = 0.35, otecCf = 0.80) {
    const demandHourly = getHourlyDemand(avgMw, peakMw);
    const ren = getHourlyRenewable(solarKw, windKw, otecKw, solarCf, windCf, otecCf);

    const surplusHourly = [];
    const deficitHourly = [];

    for (let i = 0; i < 24; i++) {
      const net = ren.total_renewable[i] - demandHourly[i];
      if (net > 0) {
        surplusHourly.push(Math.round(net * 10) / 10);
        deficitHourly.push(0);
      } else {
        surplusHourly.push(0);
        deficitHourly.push(Math.round(Math.abs(net) * 10) / 10);
      }
    }

    const annualDemandMwh = Math.round(avgMw * 8760.0 * 10) / 10;
    const annualSolarMwh = Math.round(((solarKw * solarCf * 8760.0) / 1000.0) * 10) / 10;
    const annualWindMwh = Math.round(((windKw * windCf * 8760.0) / 1000.0) * 10) / 10;
    const annualOtecMwh = Math.round(((otecKw * otecCf * 8760.0) / 1000.0) * 10) / 10;
    const annualRenMwh = Math.round((annualSolarMwh + annualWindMwh + annualOtecMwh) * 10) / 10;

    return {
      hours: Array.from({ length: 24 }, (_, i) => i),
      demand_hourly_kw: demandHourly,
      solar_hourly_kw: ren.solar,
      wind_hourly_kw: ren.wind,
      otec_hourly_kw: ren.otec,
      total_renewable_hourly_kw: ren.total_renewable,
      surplus_hourly_kw: surplusHourly,
      deficit_hourly_kw: deficitHourly,
      annual_demand_mwh: annualDemandMwh,
      annual_solar_mwh: annualSolarMwh,
      annual_wind_mwh: annualWindMwh,
      annual_otec_mwh: annualOtecMwh,
      annual_ren_mwh: annualRenMwh
    };
  }

  function simulateDispatch(demandHourly, renGenHourly, batteryKwh, dieselCapacityKw = 1000.0) {
    const effOneWay = Math.sqrt(BATTERY_ROUNDTRIP_EFFICIENCY);
    const minSocKwh = batteryKwh * BATTERY_MIN_SOC;
    const maxSocKwh = batteryKwh;
    const usableKwh = maxSocKwh - minSocKwh;
    const maxPowerKw = batteryKwh * 0.5;

    let soc = minSocKwh + usableKwh * 0.40;
    let res = {};

    for (let pass = 0; pass < 2; pass++) {
      const socArr = [], socPctArr = [], chgArr = [], disArr = [], dslArr = [], curtArr = [], unmetArr = [];

      for (let i = 0; i < 24; i++) {
        const d = demandHourly[i];
        const r = renGenHourly[i];
        const net = r - d;

        if (net > 0) {
          const surplus = net;
          const maxChg = (maxSocKwh - soc) / effOneWay;
          const chgPower = Math.min(surplus, maxPowerKw, maxChg);
          soc += chgPower * effOneWay;
          soc = Math.min(maxSocKwh, soc);

          chgArr.push(Math.round(chgPower * 10) / 10);
          disArr.push(0);
          dslArr.push(0);
          curtArr.push(Math.round((surplus - chgPower) * 10) / 10);
          unmetArr.push(0);
        } else {
          const needed = Math.abs(net);
          const maxDis = (soc - minSocKwh) * effOneWay;
          const disPower = Math.min(needed, maxPowerKw, maxDis);
          soc -= disPower / effOneWay;
          soc = Math.max(minSocKwh, soc);

          const rem = needed - disPower;
          const dsl = Math.min(rem, dieselCapacityKw);
          const unmet = Math.max(0, rem - dsl);

          chgArr.push(0);
          disArr.push(Math.round(disPower * 10) / 10);
          dslArr.push(Math.round(dsl * 10) / 10);
          curtArr.push(0);
          unmetArr.push(Math.round(unmet * 10) / 10);
        }

        socArr.push(Math.round(soc * 10) / 10);
        socPctArr.push(batteryKwh > 0 ? Math.round((soc / batteryKwh * 100) * 10) / 10 : 0);
      }

      res = {
        battery_soc_kwh: socArr,
        battery_soc_pct: socPctArr,
        charge_kw: chgArr,
        discharge_kw: disArr,
        diesel_gen_kw: dslArr,
        curtailed_kw: curtArr,
        unmet_kw: unmetArr
      };
    }

    const totalDemand = demandHourly.reduce((a, b) => a + b, 0);
    const totalDiesel = res.diesel_gen_kw.reduce((a, b) => a + b, 0);
    const totalUnmet = res.unmet_kw.reduce((a, b) => a + b, 0);
    const totalRenServed = totalDemand - totalDiesel - totalUnmet;
    const totalCurtailed = res.curtailed_kw.reduce((a, b) => a + b, 0);

    const renFrac = totalDemand > 0 ? Math.max(0, Math.min(1, totalRenServed / totalDemand)) : 0;
    const annDieselMwh = Math.round(((totalDiesel * 365) / 1000) * 100) / 100;
    const annUnmetMwh = Math.round(((totalUnmet * 365) / 1000) * 100) / 100;
    const annCurtailedMwh = Math.round(((totalCurtailed * 365) / 1000) * 100) / 100;

    return {
      ...res,
      daily_demand_kwh: Math.round(totalDemand * 10) / 10,
      daily_diesel_kwh: Math.round(totalDiesel * 10) / 10,
      daily_renewable_served_kwh: Math.round(totalRenServed * 10) / 10,
      daily_curtailed_kwh: Math.round(totalCurtailed * 10) / 10,
      daily_unmet_kwh: Math.round(totalUnmet * 10) / 10,
      annual_diesel_mwh: annDieselMwh,
      annual_unmet_mwh: annUnmetMwh,
      annual_curtailed_mwh: annCurtailedMwh,
      renewable_penetration_pct: Math.round(renFrac * 1000) / 10,
      loss_of_load_prob_pct: totalDemand > 0 ? Math.round((totalUnmet / totalDemand * 100) * 1000) / 1000 : 0
    };
  }

  function calculateScore(renFrac, unmetFrac, dslRedFrac, curtFrac, totalKw, peakKw) {
    const relScore = Math.max(0, Math.min(30, Math.round((30 * (1 - unmetFrac * 10)) * 10) / 10));
    const renScore = Math.max(0, Math.min(30, Math.round((30 * renFrac) * 10) / 10));
    const dslScore = Math.max(0, Math.min(25, Math.round((25 * dslRedFrac) * 10) / 10));
    const utilScore = Math.max(0, Math.min(15, Math.round((15 * (1 - curtFrac * 1.5)) * 10) / 10));

    const oversizing = peakKw > 0 ? totalKw / peakKw : 1;
    const overPenalty = oversizing > 2.8 ? Math.min(15, Math.round(((oversizing - 2.8) * 4) * 10) / 10) : 0;

    const total = Math.max(0, Math.min(100, Math.round((relScore + renScore + dslScore + utilScore - overPenalty) * 10) / 10));

    let grade = "Optimal (Tier 1)";
    let assessment = "Outstanding hybrid balance with clean baseload and minimal curtailment.";
    if (total < 60) {
      grade = "Sub-Optimal (Tier 4)";
      assessment = "High reliance on diesel generators. Further renewable sizing needed.";
    } else if (total < 75) {
      grade = "Moderate (Tier 3)";
      assessment = "Moderate carbon reduction. Additional battery storage or OTEC recommended.";
    } else if (total < 90) {
      grade = "High Efficiency (Tier 2)";
      assessment = "Strong renewable displacement meeting island sustainability targets.";
    }

    return {
      total_score: total,
      grade,
      assessment,
      formula_explanation: `Score = Reliability (${relScore}/30) + Renewable Share (${renScore}/30) + Diesel Reduction (${dslScore}/25) + Efficiency (${utilScore}/15) - Overcapacity (-${overPenalty}/15) = ${total}/100`,
      breakdown: {
        reliability_score: relScore,
        max_reliability: 30,
        renewable_score: renScore,
        max_renewable: 30,
        diesel_reduction_score: dslScore,
        max_diesel_reduction: 25,
        resource_utilization_score: utilScore,
        max_resource_utilization: 15,
        overcapacity_penalty: overPenalty,
        max_overcapacity_penalty: 15
      }
    };
  }

  function getSuitabilityStatus(curVal, recVal) {
    if (recVal <= 0) return { code: "not_required", badge: "⚪ Not Required", color: "gray", text: "Resource not prioritized." };
    if (curVal >= recVal * 0.95) return { code: "suitable", badge: "🟢 Suitable", color: "green", text: "Existing infrastructure is sufficient." };
    if (curVal > 0) return { code: "expand", badge: "🟡 Expand", color: "amber", text: `Expansion required: add ${(recVal - curVal).toLocaleString()} units.` };
    return { code: "insufficient", badge: "🔴 Insufficient / Add New", color: "red", text: `New plant required: develop ${recVal.toLocaleString()} units.` };
  }

  function optimize(params) {
    const peakMw = parseFloat(params.peak_demand_mw || 0.70);
    const avgMw = parseFloat(params.average_demand_mw || 0.45);
    const peakKw = peakMw * 1000;
    const avgKw = avgMw * 1000;

    const existSolar = parseFloat(params.existing_solar_kw || 0);
    const existWind = parseFloat(params.existing_wind_kw || 0);
    const existOtec = parseFloat(params.existing_otec_kw || 0);
    const existBatt = parseFloat(params.battery_kwh || 0);
    const existDiesel = parseFloat(params.existing_diesel_kw || 1000);

    const solPot = parseFloat(params.solar_potential || 0.22);
    const winPot = parseFloat(params.wind_potential || 0.32);
    const otecPot = parseFloat(params.otec_potential || 0.80);

    const solCf = parseFloat(params.solar_cf || 0.20);
    const winCf = parseFloat(params.wind_cf || 0.35);
    const otecCf = parseFloat(params.otec_cf || 0.80);

    const solUnit = parseFloat(params.solar_unit_kw || 250);
    const winUnit = parseFloat(params.wind_unit_kw || 500);
    const otecUnit = parseFloat(params.otec_unit_kw || 500);
    const battUnit = parseFloat(params.battery_unit_kwh || 500);

    const targetRenPct = parseFloat(params.target_renewable_pct || 85);
    const targetRatio = Math.min(1.0, Math.max(0.2, targetRenPct / 100.0));

    // OTEC
    let recOtec = 0;
    if (otecPot >= 0.50) {
      recOtec = Math.max(existOtec, avgKw * 0.55 * (otecPot / 0.80) * targetRatio);
    } else {
      recOtec = existOtec;
    }

    const uncoveredAvgKw = Math.max(0, avgKw - (recOtec * otecCf));
    const solScale = (solPot / 0.20) * 1.15 * targetRatio;
    let recSolar = Math.max(existSolar, (uncoveredAvgKw * 1.8 + peakKw * 0.4) * solScale);

    let recWind = 0;
    if (winPot >= 0.25) {
      recWind = Math.max(existWind, uncoveredAvgKw * 0.85 * (winPot / 0.35) * targetRatio);
    } else {
      recWind = existWind;
    }

    const rawBatt = Math.max(uncoveredAvgKw * 6, (recSolar - avgKw) * 2.5) / BATTERY_MAX_DOD;
    let recBatt = Math.max(existBatt, Math.ceil((rawBatt * (targetRatio ** 1.3)) / 50) * 50);

    // Iterative convergence
    let balance = calculateBalance(avgMw, peakMw, recSolar, recWind, recOtec, solCf, winCf, otecCf);
    let dispatch = simulateDispatch(balance.demand_hourly_kw, balance.total_renewable_hourly_kw, recBatt, existDiesel);

    if (dispatch.renewable_penetration_pct < targetRenPct) {
      const step = 1.0 + Math.min(0.25, (targetRenPct - dispatch.renewable_penetration_pct) / 100.0);
      recSolar *= step;
      if (winPot >= 0.25) recWind *= step;
      recBatt *= (step ** 1.2);
    }

    recSolar = Math.round(recSolar);
    recWind = Math.round(recWind);
    recOtec = Math.round(recOtec);
    recBatt = Math.round(recBatt);

    balance = calculateBalance(avgMw, peakMw, recSolar, recWind, recOtec, solCf, winCf, otecCf);
    dispatch = simulateDispatch(balance.demand_hourly_kw, balance.total_renewable_hourly_kw, recBatt, existDiesel);

    // Suitability
    const suitability = {
      solar: { name: "Solar Photovoltaic", existing_kw: existSolar, recommended_kw: recSolar, expansion_kw: Math.max(0, recSolar - existSolar), potential_score: solPot, status: getSuitabilityStatus(existSolar, recSolar) },
      wind: { name: "Wind Energy", existing_kw: existWind, recommended_kw: recWind, expansion_kw: Math.max(0, recWind - existWind), potential_score: winPot, status: getSuitabilityStatus(existWind, recWind) },
      otec: { name: "Ocean Thermal Energy (OTEC)", existing_kw: existOtec, recommended_kw: recOtec, expansion_kw: Math.max(0, recOtec - existOtec), potential_score: otecPot, status: getSuitabilityStatus(existOtec, recOtec) },
      battery: { name: "Battery Storage (BESS)", existing_kwh: existBatt, recommended_kwh: recBatt, expansion_kwh: Math.max(0, recBatt - existBatt), potential_score: 0.95, status: getSuitabilityStatus(existBatt, recBatt) },
      diesel: { name: "Diesel Backup Generator", existing_kw: existDiesel, recommended_kw: Math.round(peakKw * 0.9), status: { badge: "Standby Reserve", color: "blue", text: "Retained strictly as emergency reserve." } }
    };

    // Plant unit counts
    const existPlants = {
      solar_plants: existSolar > 0 ? Math.ceil(existSolar / solUnit) : 0,
      wind_plants: existWind > 0 ? Math.ceil(existWind / winUnit) : 0,
      otec_plants: existOtec > 0 ? Math.ceil(existOtec / otecUnit) : 0,
      battery_systems: existBatt > 0 ? Math.ceil(existBatt / battUnit) : 0,
      diesel_gensets: existDiesel > 0 ? Math.ceil(existDiesel / 400) : 0
    };
    const recPlants = {
      solar_plants: recSolar > 0 ? Math.ceil(recSolar / solUnit) : 0,
      wind_plants: recWind > 0 ? Math.ceil(recWind / winUnit) : 0,
      otec_plants: recOtec > 0 ? Math.ceil(recOtec / otecUnit) : 0,
      battery_systems: recBatt > 0 ? Math.ceil(recBatt / battUnit) : 0,
      diesel_gensets: existPlants.diesel_gensets
    };
    const addPlants = {
      solar_plants: Math.max(0, recPlants.solar_plants - existPlants.solar_plants),
      wind_plants: Math.max(0, recPlants.wind_plants - existPlants.wind_plants),
      otec_plants: Math.max(0, recPlants.otec_plants - existPlants.otec_plants),
      battery_systems: Math.max(0, recPlants.battery_systems - existPlants.battery_systems)
    };

    // Energy mix
    const totalEffective = balance.annual_solar_mwh + balance.annual_wind_mwh + balance.annual_otec_mwh + dispatch.annual_diesel_mwh;
    const solPct = totalEffective > 0 ? Math.round((balance.annual_solar_mwh / totalEffective * 100) * 10) / 10 : 0;
    const winPct = totalEffective > 0 ? Math.round((balance.annual_wind_mwh / totalEffective * 100) * 10) / 10 : 0;
    const otecPct = totalEffective > 0 ? Math.round((balance.annual_otec_mwh / totalEffective * 100) * 10) / 10 : 0;
    const dslPct = totalEffective > 0 ? Math.round((dispatch.annual_diesel_mwh / totalEffective * 100) * 10) / 10 : 100;
    const battDischargeAnnual = Math.round((dispatch.discharge_kw.reduce((a, b) => a + b, 0) * 365 / 1000) * 10) / 10;
    const battPct = balance.annual_demand_mwh > 0 ? Math.round((battDischargeAnnual / balance.annual_demand_mwh * 100) * 10) / 10 : 0;

    // Environmental metrics
    const baseDslLiters = balance.annual_demand_mwh * 1000 * DIESEL_LITERS_PER_KWH;
    const actDslLiters = dispatch.annual_diesel_mwh * 1000 * DIESEL_LITERS_PER_KWH;
    const dslSavedLiters = Math.max(0, baseDslLiters - actDslLiters);
    const dslRedPct = baseDslLiters > 0 ? Math.round(((baseDslLiters - actDslLiters) / baseDslLiters * 100) * 10) / 10 : 0;
    const co2AvoidedTons = Math.round(((balance.annual_demand_mwh - dispatch.annual_diesel_mwh) * 1000 * DIESEL_EMISSIONS_KG_PER_KWH / 1000) * 10) / 10;
    const costSavedUsd = Math.round(dslSavedLiters * DIESEL_COST_USD_PER_LITER);
    const costSavedInr = Math.round(costSavedUsd * 86.5);

    const score = calculateScore(
      dispatch.renewable_penetration_pct / 100.0,
      dispatch.loss_of_load_prob_pct / 100.0,
      dslRedPct / 100.0,
      Math.min(1.0, dispatch.annual_curtailed_mwh / (balance.annual_ren_mwh + 0.1)),
      recSolar + recWind + recOtec,
      peakKw
    );

    return {
      status: "success",
      source: "local_browser_optimizer",
      inputs: params,
      recommended_capacities: {
        solar_kw: recSolar,
        wind_kw: recWind,
        otec_kw: recOtec,
        battery_kwh: recBatt,
        diesel_standby_kw: Math.round(peakKw * 0.9),
        total_renewable_capacity_kw: recSolar + recWind + recOtec
      },
      suitability,
      plant_counts: {
        existing: existPlants,
        recommended: recPlants,
        additions_required: addPlants,
        unit_specs: { solar_unit_kw: solUnit, wind_unit_kw: winUnit, otec_unit_kw: otecUnit, battery_unit_kwh: battUnit }
      },
      energy_mix: {
        solar_pct: solPct,
        wind_pct: winPct,
        otec_pct: otecPct,
        battery_pct: battPct,
        diesel_pct: dslPct,
        renewable_total_pct: Math.round((solPct + winPct + otecPct) * 10) / 10
      },
      energy_balance: balance,
      dispatch_simulation: dispatch,
      environmental_impact: {
        diesel_reduction_pct: dslRedPct,
        diesel_liters_saved_annual: Math.round(dslSavedLiters),
        baseline_diesel_liters: Math.round(baseDslLiters),
        actual_diesel_liters: Math.round(actDslLiters),
        co2_reduction_tons_annual: co2AvoidedTons,
        fuel_cost_savings_usd: costSavedUsd,
        fuel_cost_savings_inr: costSavedInr
      },
      optimization_score: score
    };
  }

  function simulate(params) {
    const mult = parseFloat(params.demand_multiplier || 1.0);
    const solKw = parseFloat(params.solar_kw || 500);
    const winKw = parseFloat(params.wind_kw || 200);
    const otecKw = parseFloat(params.otec_kw || 250);
    const battKwh = parseFloat(params.battery_kwh || 1000);
    const baseAvg = parseFloat(params.base_avg_demand_mw || 0.50);
    const basePeak = parseFloat(params.base_peak_demand_mw || 0.80);
    const solCf = parseFloat(params.solar_cf || 0.20);
    const winCf = parseFloat(params.wind_cf || 0.35);
    const otecCf = parseFloat(params.otec_cf || 0.80);

    const simAvg = baseAvg * mult;
    const simPeak = basePeak * mult;

    const balance = calculateBalance(simAvg, simPeak, solKw, winKw, otecKw, solCf, winCf, otecCf);
    const dispatch = simulateDispatch(balance.demand_hourly_kw, balance.total_renewable_hourly_kw, battKwh, simPeak * 1000);

    const baseDsl = balance.annual_demand_mwh * 1000 * DIESEL_LITERS_PER_KWH;
    const actDsl = dispatch.annual_diesel_mwh * 1000 * DIESEL_LITERS_PER_KWH;
    const dslRed = baseDsl > 0 ? Math.round(((baseDsl - actDsl) / baseDsl * 100) * 10) / 10 : 0;
    const co2 = Math.round(((balance.annual_demand_mwh - dispatch.annual_diesel_mwh) * 1000 * DIESEL_EMISSIONS_KG_PER_KWH / 1000) * 10) / 10;

    const score = calculateScore(
      dispatch.renewable_penetration_pct / 100.0,
      dispatch.loss_of_load_prob_pct / 100.0,
      dslRed / 100.0,
      Math.min(1.0, dispatch.annual_curtailed_mwh / (balance.annual_ren_mwh + 0.1)),
      solKw + winKw + otecKw,
      simPeak * 1000
    );

    return {
      status: "success",
      source: "local_browser_optimizer",
      demand_multiplier: mult,
      effective_avg_demand_mw: Math.round(simAvg * 1000) / 1000,
      effective_peak_demand_mw: Math.round(simPeak * 1000) / 1000,
      solar_kw: solKw,
      wind_kw: winKw,
      otec_kw: otecKw,
      battery_kwh: battKwh,
      renewable_penetration_pct: dispatch.renewable_penetration_pct,
      loss_of_load_prob_pct: dispatch.loss_of_load_prob_pct,
      diesel_reduction_pct: dslRed,
      co2_reduction_tons: co2,
      annual_energy_mwh: balance.annual_ren_mwh,
      score: score.total_score,
      score_details: score,
      balance,
      dispatch
    };
  }

  return {
    optimize,
    simulate,
    calculateBalance,
    simulateDispatch
  };
})();

// Export globally
window.BlueGridLocalOptimizer = BlueGridLocalOptimizer;
