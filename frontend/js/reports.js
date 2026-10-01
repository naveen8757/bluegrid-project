/**
 * BlueGrid AI — Engineering Report Generation Controller
 * Section 25 Implementation: 14-Section Comprehensive Technical Report with Print & PDF Export
 */

const BlueGridReports = (() => {
  async function generateAndDisplayReport(runId) {
    const container = document.getElementById('reportDisplayArea');
    if (!container) return;

    container.innerHTML = '<div style="text-align: center; padding: 50px;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><p style="margin-top:12px; color:#537592;">Compiling 14-Section Engineering Report...</p></div>';

    const report = await BlueGridAPI.getReport(runId);
    if (!report || !report.sections) {
      container.innerHTML = '<div style="text-align:center; padding:40px; color:#EF4444;">Unable to load report payload. Please run an optimization first.</div>';
      return;
    }

    const s = report.sections;

    // Render formatted report sheet
    container.innerHTML = `
      <div class="report-sheet">
        <!-- Header -->
        <div class="report-header-banner">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
              <span style="font-size: 1.6rem;">🌊</span>
              <h2 style="margin: 0; font-size: 1.6rem; color: #063B70; font-weight: 800;">BLUEGRID AI</h2>
            </div>
            <p style="margin: 0; font-weight: 600; color: #087DB5; font-size: 1.05rem;">
              Hybrid Renewable Energy Optimization Report
            </p>
            <p style="margin: 2px 0 0; font-size: 0.85rem; color: #537592;">
              Target Island: <strong>${report.island_name}</strong> • Reference: #${report.run_id}
            </p>
          </div>
          <div style="text-align: right;">
            <span style="background: #EEF6FB; color: #087DB5; font-weight: 700; font-size: 0.78rem; padding: 4px 12px; border-radius: 20px; border: 1px solid #087DB5;">
              CONFIDENTIAL / ENGINEERING DRAFT
            </span>
            <div style="font-size: 0.76rem; color: #537592; margin-top: 6px;">
              Generated: ${report.generated_at}
            </div>
          </div>
        </div>

        <!-- Section 1: Island Profile -->
        <div class="report-section-block">
          <h3 class="report-section-title">${s['1_island_profile']?.title || '1. Island Profile'}</h3>
          <p style="font-size: 0.9rem; color: #082B45; margin-bottom: 12px;">
            ${s['1_island_profile']?.description || ''}
          </p>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; background: #EEF6FB; padding: 14px 18px; border-radius: 8px; font-size: 0.86rem;">
            <div><strong>Region:</strong> ${s['1_island_profile']?.region || 'Coastal'}</div>
            <div><strong>Coordinates:</strong> ${s['1_island_profile']?.coordinates || '--'}</div>
            <div><strong>Population:</strong> ${(s['1_island_profile']?.population || 0).toLocaleString()}</div>
            <div><strong>Area:</strong> ${s['1_island_profile']?.area_sqkm || '--'} km²</div>
            <div><strong>1000m Depth Dist:</strong> ${s['1_island_profile']?.bathymetry_distance_1000m_km || '--'} km</div>
            <div><strong>Surface / Deep Sea:</strong> ${s['1_island_profile']?.surface_temp_c}°C / ${s['1_island_profile']?.deep_sea_temp_c}°C</div>
          </div>
        </div>

        <!-- Section 2: Current Energy Infrastructure -->
        <div class="report-section-block">
          <h3 class="report-section-title">${s['2_current_energy_infrastructure']?.title || '2. Current Energy Infrastructure'}</h3>
          <table class="plant-counts-table">
            <thead>
              <tr>
                <th>Plant Type</th>
                <th>Installed Capacity</th>
                <th>Estimated Unit Count</th>
                <th>Role in Current Grid</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Diesel Generator Station</td>
                <td><strong>${s['2_current_energy_infrastructure']?.existing_diesel_kw || 0} kW</strong></td>
                <td>${s['2_current_energy_infrastructure']?.existing_plants_count?.diesel_gensets || 2} Gensets</td>
                <td>Primary continuous baseload (100% fossil fuel reliant)</td>
              </tr>
              <tr>
                <td>Solar PV Array</td>
                <td><strong>${s['2_current_energy_infrastructure']?.existing_solar_kw || 0} kW</strong></td>
                <td>${s['2_current_energy_infrastructure']?.existing_plants_count?.solar_plants || 0} Arrays</td>
                <td>Intermittent daytime solar offset</td>
              </tr>
              <tr>
                <td>Wind Turbines</td>
                <td><strong>${s['2_current_energy_infrastructure']?.existing_wind_kw || 0} kW</strong></td>
                <td>${s['2_current_energy_infrastructure']?.existing_plants_count?.wind_plants || 0} Turbines</td>
                <td>Coastal breeze trial</td>
              </tr>
              <tr>
                <td>OTEC Ocean Thermal</td>
                <td><strong>${s['2_current_energy_infrastructure']?.existing_otec_kw || 0} kW</strong></td>
                <td>${s['2_current_energy_infrastructure']?.existing_plants_count?.otec_plants || 0} Modules</td>
                <td>Pilot desalination/thermal module</td>
              </tr>
              <tr>
                <td>Battery Energy Storage</td>
                <td><strong>${s['2_current_energy_infrastructure']?.existing_battery_kwh || 0} kWh</strong></td>
                <td>${s['2_current_energy_infrastructure']?.existing_plants_count?.battery_systems || 0} Systems</td>
                <td>Short duration emergency backup</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Section 3 & 4: Demand & Renewable Potential -->
        <div class="report-section-block">
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px;">
            <div>
              <h3 class="report-section-title">${s['3_energy_demand']?.title || '3. Energy Demand'}</h3>
              <ul style="font-size: 0.88rem; list-style: none; padding: 0;">
                <li style="padding: 6px 0; border-bottom: 1px dashed #E2E8F0;">• Peak Microgrid Demand: <strong>${s['3_energy_demand']?.peak_demand_mw} MW</strong></li>
                <li style="padding: 6px 0; border-bottom: 1px dashed #E2E8F0;">• Average Daytime Demand: <strong>${s['3_energy_demand']?.average_demand_mw} MW</strong></li>
                <li style="padding: 6px 0; border-bottom: 1px dashed #E2E8F0;">• Annual Island Energy: <strong>${(s['3_energy_demand']?.annual_demand_mwh || 0).toLocaleString()} MWh/yr</strong></li>
                <li style="padding: 6px 0;">• Calculated Load Factor: <strong>${s['3_energy_demand']?.load_factor_pct || 65}%</strong></li>
              </ul>
            </div>
            <div>
              <h3 class="report-section-title">${s['4_renewable_potential']?.title || '4. Renewable Potential'}</h3>
              <ul style="font-size: 0.88rem; list-style: none; padding: 0;">
                <li style="padding: 6px 0; border-bottom: 1px dashed #E2E8F0;">• Solar Capacity Factor: <strong>${(s['4_renewable_potential']?.solar_cf * 100).toFixed(0)}%</strong> (Score: ${s['4_renewable_potential']?.solar_potential_score})</li>
                <li style="padding: 6px 0; border-bottom: 1px dashed #E2E8F0;">• Wind Capacity Factor: <strong>${(s['4_renewable_potential']?.wind_cf * 100).toFixed(0)}%</strong> (Score: ${s['4_renewable_potential']?.wind_potential_score})</li>
                <li style="padding: 6px 0; border-bottom: 1px dashed #E2E8F0;">• OTEC Capacity Factor: <strong>${(s['4_renewable_potential']?.otec_cf * 100).toFixed(0)}%</strong> (Score: ${s['4_renewable_potential']?.otec_potential_score})</li>
                <li style="padding: 6px 0;">• Thermal Gradient (ΔT): <strong>${s['4_renewable_potential']?.thermal_gradient_delta_t_c || 22}°C</strong></li>
              </ul>
            </div>
          </div>
        </div>

        <!-- Section 5: Recommended Energy Mix -->
        <div class="report-section-block">
          <h3 class="report-section-title">${s['5_recommended_energy_mix']?.title || '5. Recommended Energy Mix'}</h3>
          <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; text-align: center; margin-bottom: 16px;">
            <div style="background: #FFFBEB; border: 1px solid #FDE68A; padding: 14px 8px; border-radius: 8px;">
              <div style="font-size: 0.74rem; color: #92400E; font-weight: 700;">☀️ SOLAR</div>
              <div style="font-size: 1.4rem; font-weight: 800; color: #B45309;">${s['5_recommended_energy_mix']?.solar_pct}%</div>
              <div style="font-size: 0.72rem; color: #78350F;">${s['5_recommended_energy_mix']?.recommended_capacities?.solar_kw || 0} kW</div>
            </div>
            <div style="background: #ECFEFF; border: 1px solid #A5F3FC; padding: 14px 8px; border-radius: 8px;">
              <div style="font-size: 0.74rem; color: #155E75; font-weight: 700;">💨 WIND</div>
              <div style="font-size: 1.4rem; font-weight: 800; color: #087DB5;">${s['5_recommended_energy_mix']?.wind_pct}%</div>
              <div style="font-size: 0.72rem; color: #155E75;">${s['5_recommended_energy_mix']?.recommended_capacities?.wind_kw || 0} kW</div>
            </div>
            <div style="background: #EFF6FF; border: 1px solid #BFDBFE; padding: 14px 8px; border-radius: 8px;">
              <div style="font-size: 0.74rem; color: #1E40AF; font-weight: 700;">🌊 OTEC</div>
              <div style="font-size: 1.4rem; font-weight: 800; color: #063B70;">${s['5_recommended_energy_mix']?.otec_pct}%</div>
              <div style="font-size: 0.72rem; color: #1E40AF;">${s['5_recommended_energy_mix']?.recommended_capacities?.otec_kw || 0} kW</div>
            </div>
            <div style="background: #ECFDF5; border: 1px solid #A7F3D0; padding: 14px 8px; border-radius: 8px;">
              <div style="font-size: 0.74rem; color: #065F46; font-weight: 700;">🔋 BATTERY</div>
              <div style="font-size: 1.4rem; font-weight: 800; color: #10B981;">${s['5_recommended_energy_mix']?.battery_pct}%</div>
              <div style="font-size: 0.72rem; color: #065F46;">${s['5_recommended_energy_mix']?.recommended_capacities?.battery_kwh || 0} kWh</div>
            </div>
            <div style="background: #FEF2F2; border: 1px solid #FECACA; padding: 14px 8px; border-radius: 8px;">
              <div style="font-size: 0.74rem; color: #991B1B; font-weight: 700;">🛢 DIESEL</div>
              <div style="font-size: 1.4rem; font-weight: 800; color: #EF4444;">${s['5_recommended_energy_mix']?.diesel_pct}%</div>
              <div style="font-size: 0.72rem; color: #991B1B;">Standby Backup</div>
            </div>
          </div>
        </div>

        <!-- Section 6: Plant Suitability & Unit Sizing -->
        <div class="report-section-block">
          <h3 class="report-section-title">${s['6_plant_suitability']?.title || '6. Plant Suitability & Recommended Unit Sizing'}</h3>
          <table class="plant-counts-table">
            <thead>
              <tr>
                <th>Technology</th>
                <th>Existing Plants</th>
                <th>Recommended Plants</th>
                <th>Additional Units Needed</th>
                <th>Evaluation Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Solar Photovoltaic</strong></td>
                <td>${s['6_plant_suitability']?.plant_counts?.existing?.solar_plants || 0}</td>
                <td>${s['6_plant_suitability']?.plant_counts?.recommended?.solar_plants || 0}</td>
                <td>+${s['6_plant_suitability']?.plant_counts?.additions_required?.solar_plants || 0}</td>
                <td><span class="suit-badge green">Suitable / Expand</span></td>
              </tr>
              <tr>
                <td><strong>Wind Turbines</strong></td>
                <td>${s['6_plant_suitability']?.plant_counts?.existing?.wind_plants || 0}</td>
                <td>${s['6_plant_suitability']?.plant_counts?.recommended?.wind_plants || 0}</td>
                <td>+${s['6_plant_suitability']?.plant_counts?.additions_required?.wind_plants || 0}</td>
                <td><span class="suit-badge green">Complementary</span></td>
              </tr>
              <tr>
                <td><strong>OTEC Baseload Plant</strong></td>
                <td>${s['6_plant_suitability']?.plant_counts?.existing?.otec_plants || 0}</td>
                <td>${s['6_plant_suitability']?.plant_counts?.recommended?.otec_plants || 0}</td>
                <td>+${s['6_plant_suitability']?.plant_counts?.additions_required?.otec_plants || 0}</td>
                <td><span class="suit-badge green">High Potential</span></td>
              </tr>
              <tr>
                <td><strong>Battery Storage (BESS)</strong></td>
                <td>${s['6_plant_suitability']?.plant_counts?.existing?.battery_systems || 0}</td>
                <td>${s['6_plant_suitability']?.plant_counts?.recommended?.battery_systems || 0}</td>
                <td>+${s['6_plant_suitability']?.plant_counts?.additions_required?.battery_systems || 0}</td>
                <td><span class="suit-badge green">Essential Buffer</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Section 7, 8, 9, 10: Quantitative Impacts -->
        <div class="report-section-block">
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
            <div style="background: #EEF6FB; padding: 16px; border-radius: 8px;">
              <h4 style="font-size: 0.85rem; color: #087DB5; margin-bottom: 6px;">7 & 8. RENEWABLE SHARE</h4>
              <div style="font-size: 1.8rem; font-weight: 800; color: #063B70;">${s['8_renewable_contribution']?.renewable_penetration_achieved_pct}%</div>
              <div style="font-size: 0.76rem; color: #537592;">${(s['8_renewable_contribution']?.annual_renewable_generation_mwh || 0).toLocaleString()} MWh/yr Clean Gen</div>
            </div>
            <div style="background: #ECFDF5; padding: 16px; border-radius: 8px;">
              <h4 style="font-size: 0.85rem; color: #065F46; margin-bottom: 6px;">9. DIESEL CUT & SAVINGS</h4>
              <div style="font-size: 1.8rem; font-weight: 800; color: #10B981;">-${s['9_diesel_reduction']?.diesel_reduction_pct}%</div>
              <div style="font-size: 0.76rem; color: #065F46;">${(s['9_diesel_reduction']?.diesel_fuel_saved_liters_annual || 0).toLocaleString()} Liters Saved / yr ($${(s['9_diesel_reduction']?.annual_fuel_cost_savings_usd || 0).toLocaleString()})</div>
            </div>
            <div style="background: #F0FDF4; padding: 16px; border-radius: 8px;">
              <h4 style="font-size: 0.85rem; color: #166534; margin-bottom: 6px;">10. CO₂ AVOIDED</h4>
              <div style="font-size: 1.8rem; font-weight: 800; color: #15803D;">${(s['10_co2_reduction']?.co2_avoided_tons_annual || 0).toLocaleString()} <span style="font-size:0.9rem">Tons</span></div>
              <div style="font-size: 0.76rem; color: #166534;">≈ ${s['10_co2_reduction']?.equivalent_trees_planted?.toLocaleString() || 0} Trees Equivalent</div>
            </div>
          </div>
        </div>

        <!-- Section 11: Optimization Score -->
        <div class="report-section-block">
          <h3 class="report-section-title">${s['11_optimization_score']?.title || '11. Multi-Criteria Optimization Score'}</h3>
          <div style="display: flex; align-items: center; gap: 24px; background: #FAF5FF; border: 1px solid #E9D5FF; padding: 18px 24px; border-radius: 8px; margin-bottom: 12px;">
            <div style="text-align: center;">
              <div style="font-size: 2.5rem; font-weight: 800; color: #7C3AED; line-height: 1;">${s['11_optimization_score']?.total_score}</div>
              <div style="font-size: 0.72rem; color: #6D28D9; font-weight: 700;">OUT OF 100</div>
            </div>
            <div style="flex: 1;">
              <div style="font-weight: 700; color: #5B21B6; font-size: 0.95rem;">${s['11_optimization_score']?.grade}</div>
              <div style="font-size: 0.82rem; color: #6D28D9; margin-top: 4px;">${s['11_optimization_score']?.assessment}</div>
              <div style="font-size: 0.76rem; color: #7C3AED; margin-top: 6px; font-family: monospace;">${s['11_optimization_score']?.formula_explanation}</div>
            </div>
          </div>
        </div>

        <!-- Section 12 & 13: Simulation & Recommendations -->
        <div class="report-section-block">
          <h3 class="report-section-title">${s['13_recommendations']?.title || '13. Phased Implementation Roadmap'}</h3>
          <ol style="font-size: 0.88rem; line-height: 1.7; padding-left: 20px; color: #082B45;">
            <li><strong>Phase 1 (Immediate - Months 1-6):</strong> ${s['13_recommendations']?.phase_1}</li>
            <li><strong>Phase 2 (Intermediate - Months 6-18):</strong> ${s['13_recommendations']?.phase_2}</li>
            <li><strong>Phase 3 (Oceanic Baseload - Months 18-36):</strong> ${s['13_recommendations']?.phase_3}</li>
            <li><strong>Phase 4 (Zero-Diesel Grid - Months 36+):</strong> ${s['13_recommendations']?.phase_4}</li>
          </ol>
        </div>

        <!-- Section 14: Technical Summary -->
        <div class="report-section-block" style="border-bottom: none;">
          <h3 class="report-section-title">${s['14_technical_summary']?.title || '14. Technical Summary'}</h3>
          <div style="background: #063B70; color: #FFFFFF; padding: 20px 24px; border-radius: 8px; font-size: 0.9rem; line-height: 1.6;">
            ${s['14_technical_summary']?.summary_statement}
          </div>
        </div>
      </div>
    `;
  }

  function printReport() {
    window.print();
  }

  return {
    generateAndDisplayReport,
    printReport
  };
})();

window.BlueGridReports = BlueGridReports;
