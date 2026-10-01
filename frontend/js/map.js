/**
 * BlueGrid AI — Interactive Leaflet Map Controller & Geospatial API Manager
 * Pre-activates High-Resolution Satellite & Ocean Bathymetric Layers with zero API friction,
 * while maintaining support for custom Mapbox and Weather tokens.
 */

const BlueGridMap = (() => {
  let mapInstance = null;
  let markersLayer = null;
  let bathymetryLayer = null;
  let layerControl = null;
  let currentIslands = [];
  let currentBaseLayer = null;
  let baseLayers = {};

  // Stored Mapbox Token (if user inputs one)
  let mapboxToken = localStorage.getItem('bluegrid_mapbox_api_key') || '';
  let activeLayerKey = localStorage.getItem('bluegrid_active_map_layer') || '🛰️ High-Res Satellite (Active)';

  function initMap(containerId = 'islandMap') {
    const mapElement = document.getElementById(containerId);
    if (!mapElement) return;

    if (mapInstance) {
      setTimeout(() => {
        mapInstance.invalidateSize();
        if (currentIslands.length > 0) renderMarkers(currentIslands);
      }, 50);
      return;
    }

    // Centered around Lakshadweep & Arabian Sea
    mapInstance = L.map(containerId, {
      center: [10.85, 74.0],
      zoom: 6,
      minZoom: 4,
      maxZoom: 18,
      zoomControl: true
    });

    // 1. High-Res Satellite Imagery (Active & Free)
    const esriSatellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri, Maxar, Earthstar Geographics, CNES/Airbus DS',
      maxZoom: 18
    });

    // 2. High-Detail Ocean Bathymetry & Seabed Depths
    const oceanBase = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Sources: GEBCO, NOAA, CHS, DeLorme',
      maxZoom: 13
    });
    const oceanReference = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Reference/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 13
    });
    const esriOceanGroup = L.layerGroup([oceanBase, oceanReference]);

    // 3. Clean Coastal & Marine Navigation (CARTO Voyager)
    const cartoVoyager = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19
    });

    // 4. OpenStreetMap Standard
    const osmStandard = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    });

    baseLayers = {
      "🛰️ High-Res Satellite (Active)": esriSatellite,
      "🌊 Ocean Bathymetry & Depths": esriOceanGroup,
      "🗺️ Marine Coastal Navigation": cartoVoyager,
      "🌐 OpenStreetMap Standard": osmStandard
    };

    // If Mapbox token is present, add custom Mapbox tiles
    if (mapboxToken) {
      addMapboxTileLayers(mapboxToken);
    }

    // Default to High-Res Satellite or stored preference
    if (baseLayers[activeLayerKey]) {
      baseLayers[activeLayerKey].addTo(mapInstance);
      currentBaseLayer = baseLayers[activeLayerKey];
    } else {
      esriSatellite.addTo(mapInstance);
      currentBaseLayer = esriSatellite;
    }

    // Overlay layers
    markersLayer = L.layerGroup().addTo(mapInstance);
    bathymetryLayer = L.layerGroup().addTo(mapInstance);

    const overlays = {
      "🏝️ Island Microgrid Markers": markersLayer,
      "🔵 1,000m OTEC Depth Buffer": bathymetryLayer
    };

    // Layer control on top-right of map
    layerControl = L.control.layers(baseLayers, overlays, { position: 'topright', collapsed: false }).addTo(mapInstance);

    // Update active status badge
    updateMapStatusBadge();

    // Trigger multiple resize invalidations to handle SPA transitions smoothly
    [100, 300, 600, 1000].forEach(delay => {
      setTimeout(() => {
        if (mapInstance) mapInstance.invalidateSize();
      }, delay);
    });

    window.addEventListener('resize', () => {
      if (mapInstance) mapInstance.invalidateSize();
    });
  }

  function addMapboxTileLayers(token) {
    if (!token) return;

    const mapboxSat = L.tileLayer(`https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/{z}/{x}/{y}?access_token=${token}`, {
      attribution: '&copy; <a href="https://www.mapbox.com/">Mapbox</a> &copy; OpenStreetMap',
      tileSize: 512,
      zoomOffset: -1,
      maxZoom: 19
    });

    baseLayers["⚡ Mapbox Satellite Streets"] = mapboxSat;

    if (layerControl && mapInstance) {
      mapInstance.removeControl(layerControl);
      layerControl = L.control.layers(baseLayers, {
        "🏝️ Island Microgrid Markers": markersLayer,
        "🔵 1,000m OTEC Depth Buffer": bathymetryLayer
      }, { position: 'topright', collapsed: false }).addTo(mapInstance);
    }
  }

  function renderMarkers(islands) {
    if (!islands || islands.length === 0) return;
    currentIslands = islands;

    if (!mapInstance || !markersLayer) return;

    markersLayer.clearLayers();
    bathymetryLayer.clearLayers();

    const bounds = [];

    islands.forEach(island => {
      if (!island.latitude || !island.longitude) return;

      const latLng = [island.latitude, island.longitude];
      bounds.push(latLng);

      // 1. 1,000m OTEC Bathymetry Depth Buffer Circle
      const depthDistMeters = (island.depth_1000m_dist_km || 3.0) * 1000;
      const bathyCircle = L.circle(latLng, {
        radius: depthDistMeters,
        color: '#16C7D9',
        weight: 2,
        dashArray: '5, 5',
        fillColor: '#087DB5',
        fillOpacity: 0.15
      }).bindTooltip(`<strong>${island.name} OTEC Thermal Basin:</strong> 1,000m depth reachable at ${island.depth_1000m_dist_km || 3.0} km`, {
        direction: 'top'
      });
      bathymetryLayer.addLayer(bathyCircle);

      // 2. Custom Island Marker Pin
      const customIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `
          <div class="island-map-marker" title="${island.name}">
            <i class="fa-solid fa-water"></i>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -20]
      });

      const popupContent = `
        <div style="min-width: 250px; font-family: 'Inter', sans-serif;">
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #087DB5; padding-bottom: 6px; margin-bottom: 8px;">
            <h4 style="margin: 0; color: #063B70; font-size: 1.1rem; font-weight: 800;">${island.name}</h4>
            <span style="font-size: 0.72rem; background: #EEF6FB; color: #087DB5; padding: 2px 8px; border-radius: 12px; font-weight: 700;">${island.region}</span>
          </div>
          <div style="font-size: 0.8rem; color: #537592; margin-bottom: 8px; line-height: 1.5;">
            <div><strong>Population:</strong> ${(island.population || 0).toLocaleString()} residents</div>
            <div><strong>Peak Demand:</strong> ${island.peak_demand_mw} MW (Avg: ${island.average_demand_mw} MW)</div>
            <div><strong>1000m Ocean Depth:</strong> ${island.depth_1000m_dist_km || 3.0} km offshore</div>
            <div><strong>Sea Temps:</strong> ${island.surface_temp_c}°C Surface / ${island.deep_sea_temp_c}°C Deep</div>
          </div>
          <div style="background: #F8FAFC; border-radius: 6px; padding: 6px 10px; margin-bottom: 10px; font-size: 0.76rem;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
              <span>☀️ Solar CF:</span><strong>${(island.solar_potential * 100).toFixed(0)}%</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
              <span>💨 Wind CF:</span><strong>${(island.wind_potential * 100).toFixed(0)}%</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>🌊 OTEC Baseload:</span><strong style="color: #087DB5;">${island.otec_potential} (ΔT ~22°C)</strong>
            </div>
          </div>
          <div style="display: flex; gap: 6px;">
            <button onclick="BlueGridApp.selectIslandAndOptimize(${island.id})" style="flex: 1; background: #063B70; color: #fff; border: none; padding: 8px 10px; border-radius: 6px; font-size: 0.8rem; font-weight: 700; cursor: pointer;">
              ⚡ Optimize Island
            </button>
            <button onclick="BlueGridApp.viewIslandDetails(${island.id})" style="background: #EEF6FB; color: #087DB5; border: 1px solid #087DB5; padding: 8px 10px; border-radius: 6px; font-size: 0.8rem; font-weight: 600; cursor: pointer;">
              Details
            </button>
          </div>
        </div>
      `;

      const marker = L.marker(latLng, { icon: customIcon }).bindPopup(popupContent);
      markersLayer.addLayer(marker);
    });

    if (bounds.length > 0) {
      mapInstance.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
    }
  }

  function setLayer(layerKey) {
    if (!mapInstance) return;
    let targetLayer = baseLayers[layerKey];
    if (!targetLayer) {
      // Find by partial name
      const match = Object.keys(baseLayers).find(k => k.toLowerCase().includes(layerKey.toLowerCase()));
      if (match) targetLayer = baseLayers[match];
    }

    if (targetLayer) {
      if (currentBaseLayer) mapInstance.removeLayer(currentBaseLayer);
      targetLayer.addTo(mapInstance);
      currentBaseLayer = targetLayer;
      activeLayerKey = layerKey;
      localStorage.setItem('bluegrid_active_map_layer', layerKey);
      updateMapStatusBadge();
      BlueGridApp.showToast(`Switched map layer to: ${layerKey}`, 'info');
    }
  }

  function updateMapStatusBadge() {
    const badge = document.getElementById('mapActiveLayerBadge');
    if (!badge) return;

    if (mapboxToken) {
      badge.innerHTML = `<span class="status-dot green"></span> <strong>Mapbox Satellite API: ACTIVE</strong>`;
      badge.className = 'suit-badge green';
    } else {
      badge.innerHTML = `<span class="status-dot green"></span> <strong>Geospatial Satellite & Bathymetry API: ACTIVE</strong>`;
      badge.className = 'suit-badge green';
    }
    badge.style.display = 'inline-flex';
    badge.style.alignItems = 'center';
  }

  function openApiKeyModal() {
    const modal = document.getElementById('mapApiKeyModal');
    if (!modal) return;
    const tokenInput = document.getElementById('inputMapboxToken');
    if (tokenInput) tokenInput.value = mapboxToken;
    modal.classList.add('active');
  }

  function closeApiKeyModal() {
    const modal = document.getElementById('mapApiKeyModal');
    if (modal) modal.classList.remove('active');
  }

  async function saveAndActivateMapboxKey() {
    const tokenInput = document.getElementById('inputMapboxToken');
    const statusMsg = document.getElementById('mapboxKeyStatusMsg');
    if (!tokenInput) return;

    const token = tokenInput.value.trim();
    if (!token) {
      mapboxToken = '';
      localStorage.removeItem('bluegrid_mapbox_api_key');
      setLayer("🛰️ High-Res Satellite (Active)");
      updateMapStatusBadge();
      BlueGridApp.showToast('Reset to built-in Satellite API (Active).', 'info');
      closeApiKeyModal();
      return;
    }

    if (statusMsg) {
      statusMsg.innerHTML = '<span style="color:#087DB5;"><i class="fa-solid fa-spinner fa-spin"></i> Validating token with Mapbox API...</span>';
    }

    try {
      const res = await fetch('/api/verify-mapbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const data = await res.json();

      if (res.ok && data.valid) {
        mapboxToken = token;
        localStorage.setItem('bluegrid_mapbox_api_key', token);
        addMapboxTileLayers(token);
        setLayer("⚡ Mapbox Satellite Streets");
        updateMapStatusBadge();
        BlueGridApp.showToast('Mapbox API Token Activated! 🛰️', 'success');
        closeApiKeyModal();
      } else {
        if (statusMsg) {
          statusMsg.innerHTML = `<span style="color:#EF4444;"><i class="fa-solid fa-triangle-exclamation"></i> ${data.message || 'Invalid Mapbox token.'}</span>`;
        }
      }
    } catch (e) {
      mapboxToken = token;
      localStorage.setItem('bluegrid_mapbox_api_key', token);
      addMapboxTileLayers(token);
      updateMapStatusBadge();
      BlueGridApp.showToast('Mapbox token saved locally.', 'info');
      closeApiKeyModal();
    }
  }

  function focusIsland(islandId) {
    if (!mapInstance) return;
    const island = currentIslands.find(i => i.id == islandId);
    if (island && island.latitude && island.longitude) {
      mapInstance.flyTo([island.latitude, island.longitude], 11, { duration: 1.2 });
    }
  }

  return {
    initMap,
    renderMarkers,
    focusIsland,
    openApiKeyModal,
    closeApiKeyModal,
    saveAndActivateMapboxKey,
    setLayer,
    updateMapStatusBadge
  };
})();

window.BlueGridMap = BlueGridMap;
