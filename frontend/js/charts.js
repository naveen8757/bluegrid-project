/**
 * BlueGrid AI — Chart.js Visualizations Controller
 * Renders high-fidelity responsive charts for energy mix, 24-hour diurnal dispatch, emissions, and analytics.
 */

const BlueGridCharts = (() => {
  const chartInstances = {};

  function destroyChart(key) {
    if (chartInstances[key]) {
      chartInstances[key].destroy();
      delete chartInstances[key];
    }
  }

  // 1. Recommended Energy Mix (Doughnut Chart)
  function renderEnergyMixDoughnut(canvasId, mixData) {
    destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dataValues = [
      mixData.solar_pct || 0,
      mixData.wind_pct || 0,
      mixData.otec_pct || 0,
      mixData.battery_pct || 0,
      mixData.diesel_pct || 0
    ];

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Solar PV', 'Wind Power', 'OTEC Baseload', 'Battery Buffer', 'Diesel Backup'],
        datasets: [{
          data: dataValues,
          backgroundColor: [
            '#FFD166', // Solar (warm sun)
            '#16C7D9', // Wind (cyan)
            '#087DB5', // OTEC (deep ocean blue)
            '#10B981', // Battery (green)
            '#EF4444'  // Diesel (red)
          ],
          borderWidth: 2,
          borderColor: '#FFFFFF',
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 12,
              font: { family: 'Inter', size: 12, weight: 600 },
              padding: 14
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => ` ${context.label}: ${context.raw}%`
            }
          }
        },
        cutout: '68%'
      }
    });
  }

  // 2. 24-Hour Diurnal Dispatch Simulation Chart
  function renderDiurnalDispatchChart(canvasId, balanceData, dispatchData) {
    destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const hours = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: hours,
        datasets: [
          {
            label: 'Island Load Demand (kW)',
            data: balanceData.demand_hourly_kw || [],
            borderColor: '#082B45',
            borderWidth: 3,
            borderDash: [5, 4],
            tension: 0.35,
            fill: false,
            pointRadius: 2,
            yAxisID: 'y'
          },
          {
            label: 'Solar Generation (kW)',
            data: balanceData.solar_hourly_kw || [],
            borderColor: '#FFD166',
            backgroundColor: 'rgba(255, 209, 102, 0.25)',
            borderWidth: 2,
            tension: 0.4,
            fill: true,
            pointRadius: 0,
            yAxisID: 'y'
          },
          {
            label: 'Wind Generation (kW)',
            data: balanceData.wind_hourly_kw || [],
            borderColor: '#16C7D9',
            backgroundColor: 'rgba(22, 199, 217, 0.2)',
            borderWidth: 2,
            tension: 0.4,
            fill: true,
            pointRadius: 0,
            yAxisID: 'y'
          },
          {
            label: 'OTEC Baseload (kW)',
            data: balanceData.otec_hourly_kw || [],
            borderColor: '#087DB5',
            backgroundColor: 'rgba(8, 125, 181, 0.2)',
            borderWidth: 2,
            fill: true,
            pointRadius: 0,
            yAxisID: 'y'
          },
          {
            label: 'Battery Discharge (kW)',
            data: dispatchData.discharge_kw || [],
            borderColor: '#10B981',
            backgroundColor: 'rgba(16, 185, 129, 0.35)',
            borderWidth: 1.5,
            tension: 0.2,
            fill: true,
            pointRadius: 0,
            yAxisID: 'y'
          },
          {
            label: 'Diesel Backup (kW)',
            data: dispatchData.diesel_gen_kw || [],
            borderColor: '#EF4444',
            backgroundColor: 'rgba(239, 68, 68, 0.3)',
            borderWidth: 1.5,
            tension: 0.1,
            fill: true,
            pointRadius: 0,
            yAxisID: 'y'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { family: 'Inter', size: 10 } }
          },
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Power (kW)', font: { family: 'Inter', size: 12, weight: 600 } },
            grid: { color: 'rgba(8, 125, 181, 0.08)' }
          }
        },
        plugins: {
          legend: {
            position: 'top',
            labels: { boxWidth: 12, font: { family: 'Inter', size: 11, weight: 600 } }
          }
        }
      }
    });
  }

  // 3. Installed Capacity Comparison (Bar Chart)
  function renderCapacityBarChart(canvasId, suitabilityData) {
    destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const categories = ['Solar PV', 'Wind Power', 'OTEC Plant', 'Battery (BESS)', 'Diesel'];
    const existing = [
      suitabilityData.solar?.existing_kw || 0,
      suitabilityData.wind?.existing_kw || 0,
      suitabilityData.otec?.existing_kw || 0,
      suitabilityData.battery?.existing_kwh || 0,
      suitabilityData.diesel?.existing_kw || 0
    ];
    const recommended = [
      suitabilityData.solar?.recommended_kw || 0,
      suitabilityData.wind?.recommended_kw || 0,
      suitabilityData.otec?.recommended_kw || 0,
      suitabilityData.battery?.recommended_kwh || 0,
      suitabilityData.diesel?.recommended_kw || 0
    ];

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: categories,
        datasets: [
          {
            label: 'Existing Capacity',
            data: existing,
            backgroundColor: 'rgba(83, 117, 146, 0.45)',
            borderRadius: 6
          },
          {
            label: 'Recommended Optimal Capacity',
            data: recommended,
            backgroundColor: 'rgba(8, 125, 181, 0.85)',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Capacity (kW or kWh for BESS)', font: { family: 'Inter', size: 11, weight: 600 } },
            grid: { color: 'rgba(8, 125, 181, 0.08)' }
          }
        },
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, font: { family: 'Inter', size: 11, weight: 600 } } }
        }
      }
    });
  }

  // 4. Monthly Generation Projection (Renewable vs Diesel)
  function renderMonthlyComparison(canvasId, annualRenMwh, annualDieselMwh) {
    destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Seasonal weighting (Monsoon wind spike in Jun-Aug, Solar dip, steady OTEC)
    const seasonalRenWeights = [0.95, 1.05, 1.15, 1.18, 1.08, 0.88, 0.85, 0.90, 0.98, 1.00, 0.96, 0.92];
    const monthlyRen = seasonalRenWeights.map(w => Math.round((annualRenMwh / 12) * w));
    const monthlyDiesel = seasonalRenWeights.map(w => Math.round((annualDieselMwh / 12) * (2 - w)));

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [
          {
            label: 'Clean Renewable Generation (MWh)',
            data: monthlyRen,
            backgroundColor: '#087DB5',
            stack: 'Stack 0',
            borderRadius: 4
          },
          {
            label: 'Diesel Backup Generation (MWh)',
            data: monthlyDiesel,
            backgroundColor: '#EF4444',
            stack: 'Stack 0',
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { display: false } },
          y: {
            stacked: true,
            beginAtZero: true,
            title: { display: true, text: 'Energy (MWh/month)', font: { family: 'Inter', size: 11, weight: 600 } },
            grid: { color: 'rgba(8, 125, 181, 0.08)' }
          }
        },
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, font: { family: 'Inter', size: 11, weight: 600 } } }
        }
      }
    });
  }

  // 5. 10-Year Cumulative Fuel Cost & Emissions Savings
  function renderEmissionsSavingsChart(canvasId, annualCo2Tons, annualFuelSavingsUsd) {
    destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const years = Array.from({ length: 10 }, (_, i) => `Year ${i + 1}`);
    const cumulativeCo2 = years.map((_, i) => Math.round(annualCo2Tons * (i + 1)));
    const cumulativeSavingsUsd = years.map((_, i) => Math.round((annualFuelSavingsUsd * (i + 1)) / 1000)); // in $K

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: years,
        datasets: [
          {
            label: 'Cumulative CO₂ Avoided (Metric Tons)',
            data: cumulativeCo2,
            borderColor: '#10B981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.3,
            yAxisID: 'y'
          },
          {
            label: 'Cumulative Fuel Savings ($ in Thousands USD)',
            data: cumulativeSavingsUsd,
            borderColor: '#16C7D9',
            backgroundColor: 'rgba(22, 199, 217, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.3,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: { display: true, text: 'CO₂ Avoided (Tons)', font: { family: 'Inter', size: 11, weight: 600 } },
            grid: { color: 'rgba(8, 125, 181, 0.08)' }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            title: { display: true, text: 'Savings ($ Thousands)', font: { family: 'Inter', size: 11, weight: 600 } },
            grid: { drawOnChartArea: false }
          }
        },
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, font: { family: 'Inter', size: 11, weight: 600 } } }
        }
      }
    });
  }

  return {
    renderEnergyMixDoughnut,
    renderDiurnalDispatchChart,
    renderCapacityBarChart,
    renderMonthlyComparison,
    renderEmissionsSavingsChart,
    destroyChart
  };
})();

window.BlueGridCharts = BlueGridCharts;
