/**
 * MARISENTINEL — Vanilla JS Tactical Maritime Map Controller
 * Real-time Bay of Bengal digital twin, geofences, EEZ lines, radar arcs, and threat intelligence.
 */

window.MS_MAP = (function () {
  // Keep track of active map instances by container ID
  const mapInstances = {};

  // Canonical Indian EEZ & Maritime Boundary Coordinates (Bay of Bengal / Andaman sector)
  const EEZ_COORDINATES = [
    [8.0, 77.5], [7.5, 78.8], [7.0, 80.5], [6.5, 83.5], [8.0, 86.5],
    [10.5, 88.0], [13.0, 89.2], [15.5, 90.5], [18.0, 91.5], [20.2, 91.2],
    [21.2, 89.8], [21.5, 88.2]
  ];

  const TERRITORIAL_WATERS_12NM = [
    [8.1, 77.7], [9.3, 79.3], [10.4, 80.0], [11.8, 80.0], [13.1, 80.5],
    [15.8, 80.6], [16.2, 81.4], [16.9, 82.5], [17.7, 83.5], [19.2, 85.2],
    [20.1, 86.9], [20.7, 87.2], [21.4, 87.7], [21.6, 88.4]
  ];

  // Coastal Radar Stations (CSCR Phase II) - Fallback
  const CSCR_RADAR_STATIONS = [
    { name: "Visakhapatnam Naval Radar (CSCR-01)", lat: 17.68, lng: 83.35, rangeKm: 65 },
    { name: "Paradip Port Surveillance Radar (CSCR-02)", lat: 20.25, lng: 86.70, rangeKm: 70 },
    { name: "Gopalpur Defence Radar (CSCR-03)", lat: 19.25, lng: 84.95, rangeKm: 60 },
    { name: "Chennai Coastal Radar (CSCR-04)", lat: 13.10, lng: 80.30, rangeKm: 65 },
    { name: "Port Blair Tri-Command Radar (CSCR-05)", lat: 11.68, lng: 92.75, rangeKm: 75 }
  ];

  function getRadarStations() {
    return (window.MS_SEED && window.MS_SEED.radarStations && window.MS_SEED.radarStations.length)
      ? window.MS_SEED.radarStations
      : CSCR_RADAR_STATIONS;
  }

  function getEezCoordinates() {
    return (window.MS_SEED && window.MS_SEED.maritimeBoundaries && window.MS_SEED.maritimeBoundaries.eezCoordinates)
      ? window.MS_SEED.maritimeBoundaries.eezCoordinates
      : EEZ_COORDINATES;
  }

  function getTerritorialWaters() {
    return (window.MS_SEED && window.MS_SEED.maritimeBoundaries && window.MS_SEED.maritimeBoundaries.territorialWaters12Nm)
      ? window.MS_SEED.maritimeBoundaries.territorialWaters12Nm
      : TERRITORIAL_WATERS_12NM;
  }

  function getRiskColor(riskOrVessel) {
    if (typeof riskOrVessel === "object" && riskOrVessel !== null) {
      const level = riskOrVessel.level;
      if (level === "HIGH") return "#ef4444"; // Red -> High
      if (level === "MEDIUM") return "#eab308"; // Yellow -> Medium
      if (level === "LOW") return "#22c55e"; // Green -> Low
      const score = riskOrVessel.riskScore ?? riskOrVessel.risk ?? 0;
      if (score > 70) return "#ef4444";
      if (score > 30) return "#eab308";
      return "#22c55e";
    }
    const score = Number(riskOrVessel) || 0;
    if (score > 70) return "#ef4444"; // Red -> High
    if (score > 30) return "#eab308"; // Yellow -> Medium
    return "#22c55e"; // Green -> Low
  }

  function getRiskLabel(riskOrVessel) {
    if (typeof riskOrVessel === "object" && riskOrVessel !== null) {
      if (riskOrVessel.threatType && riskOrVessel.threatType !== "Normal") {
        return riskOrVessel.threatType.toUpperCase();
      }
      return (riskOrVessel.level || "LOW") + " RISK";
    }
    const score = Number(riskOrVessel) || 0;
    if (score > 70) return "HIGH RISK";
    if (score > 30) return "MEDIUM RISK";
    return "LOW RISK";
  }

  function getZoneColor(classification) {
    switch (classification) {
      case "Critical": return "#ef4444";
      case "High Risk": return "#f97316";
      case "Restricted": return "#f59e0b";
      case "Monitoring": return "#0284c7";
      default: return "#22c55e";
    }
  }

  function initMap(containerId, options = {}) {
    const el = document.getElementById(containerId);
    if (!el || typeof L === "undefined") return null;

    // Clean up previous map on this container if it exists
    if (mapInstances[containerId]) {
      try {
        mapInstances[containerId].remove();
      } catch (e) {
        console.warn("Map teardown error:", e);
      }
      delete mapInstances[containerId];
    }
    if (el._leaflet_id) {
      el._leaflet_id = null;
    }

    let center = options.center;
    if (!Array.isArray(center) || center.length < 2 || center[0] == null || center[1] == null || isNaN(center[0]) || isNaN(center[1])) {
      center = [17.68, 83.38];
    }
    const zoom = options.zoom || 6;

    const map = L.map(containerId, {
      center,
      zoom,
      minZoom: 4,
      maxZoom: 14,
      zoomControl: false,
      attributionControl: false
    });

    mapInstances[containerId] = map;

    // Zoom control at bottom right
    L.control.zoom({ position: "bottomright" }).addTo(map);

    // Tile Layers (100% keyless, no watermarks, public open access)
    const baseTileLayers = {
      voyager: L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }),
      dark: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 16,
        attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ'
      }),
      satellite: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 18,
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and GIS User Community'
      })
    };

    let currentTileKey = options.theme === "dark" ? "dark" : "voyager";
    baseTileLayers[currentTileKey].addTo(map);

    // Overlays Groups
    const vesselLayer = L.layerGroup().addTo(map);
    const trailLayer = L.layerGroup().addTo(map);
    const zoneLayer = L.layerGroup().addTo(map);
    const hraLayer = L.layerGroup().addTo(map);
    const incidentLayer = L.layerGroup().addTo(map);
    const radarLayer = L.layerGroup().addTo(map);
    const eezLayer = L.layerGroup().addTo(map);

    // Filter State
    let activeFilter = "all"; // 'all', 'critical', 'blackout'
    let activeLayers = {
      vessels: true,
      zones: true,
      highRiskAreas: true,
      incidents: true,
      radar: true,
      eez: true
    };

    // Draw Static EEZ & Territorial Water Lines
    function drawMaritimeBoundaries() {
      eezLayer.clearLayers();

      // 200 NM EEZ Line
      const eezLine = L.polyline(getEezCoordinates(), {
        color: "#0284c7",
        weight: 2,
        dashArray: "8, 6",
        opacity: 0.75
      });
      eezLine.bindTooltip("<strong>Indian Exclusive Economic Zone (EEZ 200 NM)</strong>", {
        sticky: true,
        direction: "top"
      });
      eezLine.addTo(eezLayer);

      // 12 NM Territorial Sea Line
      const territorialLine = L.polyline(getTerritorialWaters(), {
        color: "#f59e0b",
        weight: 1.5,
        dashArray: "4, 4",
        opacity: 0.65
      });
      territorialLine.bindTooltip("<strong>Territorial Sea Limit (12 NM)</strong>", {
        sticky: true,
        direction: "top"
      });
      territorialLine.addTo(eezLayer);
    }

    // Draw Coastal Radar Arcs
    function drawCoastalRadarCoverage() {
      radarLayer.clearLayers();
      getRadarStations().forEach((st) => {
        const radarCircle = L.circle([st.lat, st.lng], {
          radius: st.rangeKm * 1000,
          color: "#0284c7",
          weight: 1,
          dashArray: "3, 6",
          fillColor: "#0284c7",
          fillOpacity: 0.04
        });
        radarCircle.bindTooltip(`<strong>${st.name}</strong><br><span style="font-size:10px;">Operational CSCR Range: ${st.rangeKm} km</span>`, {
          direction: "top"
        });
        radarCircle.addTo(radarLayer);

        // Radar station icon
        const radarIcon = L.divIcon({
          className: "ms-radar-station",
          html: `<div style="width:12px;height:12px;background:#0284c7;border:2px solid #ffffff;border-radius:50%;box-shadow:0 0 8px #0284c7;" title="${st.name}"></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6]
        });
        L.marker([st.lat, st.lng], { icon: radarIcon }).addTo(radarLayer);
      });
    }

    drawMaritimeBoundaries();
    drawCoastalRadarCoverage();

    function updateLayers(state) {
      if (!map) return;
      state = state || window.msStore.getState();

      // 1. Security Zones & Geofences
      zoneLayer.clearLayers();
      if (activeLayers.zones) {
        (state.zones || []).forEach((z) => {
          const color = getZoneColor(z.classification);
          const circle = L.circle([z.lat, z.lng], {
            radius: z.radiusKm * 1000,
            color,
            weight: 2,
            fillColor: color,
            fillOpacity: z.status === "active" ? 0.1 : 0.03,
            dashArray: z.status === "active" ? null : "6, 6"
          });

          circle.bindTooltip(
            `<strong>${z.name}</strong><br><span style="text-transform:uppercase;font-size:10px;color:${color};font-weight:700;">${z.classification} Geofence · ${z.radiusKm} km radius</span>`,
            { direction: "top", sticky: true }
          );

          circle.on("click", () => {
            if (window.MS_UI) {
              window.MS_UI.showToast(`Inspecting Geofence: ${z.name} (${z.classification})`);
            }
          });

          circle.addTo(zoneLayer);
        });
      }

      // 1b. High Risk Maritime Areas
      hraLayer.clearLayers();
      if (activeLayers.highRiskAreas) {
        (state.highRiskAreas || []).forEach((hra) => {
          const circle = L.circle([hra.lat, hra.lng], {
            radius: hra.radiusKm * 1000,
            color: "#f43f5e",
            weight: 1.5,
            fillColor: "#f43f5e",
            fillOpacity: 0.08,
            dashArray: "5, 5"
          });
          circle.bindTooltip(
            `<strong>⚠️ High Risk Sector: ${hra.name}</strong><br><span style="text-transform:uppercase;font-size:10px;color:#f43f5e;font-weight:700;">${hra.threatLevel} · ${hra.radiusKm} km radius</span><br><span style="font-size:10px;color:#64748b;">${hra.description}</span>`,
            { direction: "top", sticky: true }
          );
          circle.addTo(hraLayer);
        });
      }

      // 2. Vessels & AIS Trails
      vesselLayer.clearLayers();
      trailLayer.clearLayers();

      if (activeLayers.vessels) {
        let filteredVessels = state.vessels || [];

        // Apply quick filter
        if (activeFilter === "critical") {
          filteredVessels = filteredVessels.filter((v) => (v.riskScore ?? v.risk) > 70);
        } else if (activeFilter === "blackout") {
          filteredVessels = filteredVessels.filter((v) => v.aisOff || v.ais !== "active");
        }

        filteredVessels.forEach((v) => {
          const calcRisk = (typeof window !== "undefined" && window.calculateRisk) ? window.calculateRisk : () => ({ score: 0, reasons: [] });
          const classifyThreat = (typeof window !== "undefined" && window.classifyThreat) ? window.classifyThreat : () => "Normal";
          const freshEval = calcRisk(v, state.threatRules);

          const activeAlert = (state.alerts || []).find((a) => a.vesselId === v.id || a.vesselId === v.vesselId || a.vesselName === v.name);
          const activeInc = (state.incidents || []).find((inc) => inc.vesselId === v.id || inc.vesselId === v.vesselId || inc.vesselName === v.name);

          let score = Math.max(v.riskScore ?? v.risk ?? 0, freshEval.score);
          if (activeAlert && activeAlert.risk > score) score = activeAlert.risk;
          if (activeInc && activeInc.risk > score) score = activeInc.risk;

          const color = getRiskColor(score);
          const isCritical = score >= 70;
          const isMedium = score >= 35 && score < 70;
          const size = isCritical ? 24 : isMedium ? 20 : 16;
          const heading = v.heading ?? v.course ?? 0;
          const threatType = (activeAlert && activeAlert.threatType) || v.threatType || classifyThreat(v, score);
          const reasonsList = v.reasons && v.reasons.length ? v.reasons : (v.behaviours || []);

          // Breadcrumb Trail
          if (v.trail && v.trail.length > 1) {
            L.polyline(v.trail, {
              color,
              weight: isCritical ? 2.5 : 1.5,
              opacity: isCritical ? 0.85 : 0.55,
              dashArray: "4, 5"
            }).addTo(trailLayer);
          }

          // Custom Vessel Marker HTML with directional heading arrow & pulse ring for critical contacts
          const markerHtml = `
            <div class="ms-vessel-wrapper" style="position:relative;width:${size}px;height:${size}px;">
              ${
                isCritical
                  ? `<div class="ms-critical-pulse-ring" style="border-color:${color};"></div>`
                  : ""
              }
              <div style="
                width:${size}px;
                height:${size}px;
                background:${color};
                border-radius:50%;
                border:2.5px solid #ffffff;
                box-shadow:0 0 10px ${color}, 0 2px 6px rgba(0,0,0,0.3);
                display:flex;
                align-items:center;
                justify-content:center;
                cursor:pointer;
              ">
                <div style="
                  width:0;
                  height:0;
                  border-left: 3.5px solid transparent;
                  border-right: 3.5px solid transparent;
                  border-bottom: 7px solid #ffffff;
                  transform: rotate(${heading}deg);
                  transition: transform 0.4s ease;
                "></div>
              </div>
            </div>
          `;

          const icon = L.divIcon({
            className: "ms-vessel-icon",
            html: markerHtml,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2]
          });

          const m = L.marker([v.lat, v.lng], { icon });

          // Interactive Popup displaying: Vessel details, Threat type, Reasons list
          const popupHtml = `
            <div class="ms-tactical-popup" style="font-family:Inter,sans-serif; min-width:280px; max-width:340px; padding:2px;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid #e2e8f0; padding-bottom:6px; margin-bottom:8px;">
                <div>
                  <div style="font-weight:800; font-size:14px; color:#0f172a;">${v.name || v.vesselId}</div>
                  <div style="font-size:10px; color:#64748b; font-family:'JetBrains Mono',monospace;">ID: ${v.vesselId || v.id} · MMSI: ${v.mmsi || 'N/A'}</div>
                </div>
                <span class="badge" style="font-size:11px; background:${color}; color:#ffffff; font-weight:700;">
                  ${v.level || (score > 70 ? 'HIGH' : score > 30 ? 'MEDIUM' : 'LOW')} (${score}/100)
                </span>
              </div>

              <!-- Threat Classification Badge -->
              <div style="margin-bottom:8px; padding:6px 8px; border-radius:6px; background:${isCritical ? '#fef2f2' : isMedium ? '#fefce8' : '#f0fdf4'}; border:1px solid ${isCritical ? '#fecaca' : isMedium ? '#fef08a' : '#bbf7d0'};">
                <div style="font-size:10px; font-weight:700; text-transform:uppercase; color:${isCritical ? '#991b1b' : isMedium ? '#854d0e' : '#166534'};">
                  Predicted Threat Type
                </div>
                <div style="font-size:13px; font-weight:800; color:${isCritical ? '#dc2626' : isMedium ? '#ca8a04' : '#15803d'};">
                  ${threatType}
                </div>
              </div>

              <!-- Vessel Details -->
              <div style="font-size:11px; display:grid; grid-template-columns:1fr 1fr; gap:4px 8px; margin-bottom:8px;">
                <div><span style="color:#64748b;">Speed:</span> <strong>${v.speed} kts</strong></div>
                <div><span style="color:#64748b;">Heading:</span> <strong>${heading}°</strong></div>
                <div><span style="color:#64748b;">Coordinates:</span> <strong>${v.lat}, ${v.lng}</strong></div>
                <div><span style="color:#64748b;">AIS Status:</span> <strong style="color:${v.aisOff ? '#ef4444' : '#22c55e'}; text-transform:uppercase;">${v.aisOff ? 'OFF' : 'ACTIVE'}</strong></div>
                <div><span style="color:#64748b;">Restricted Zone:</span> <strong>${v.inRestrictedZone ? 'YES ⚠️' : 'No'}</strong></div>
                <div><span style="color:#64748b;">High Risk Area:</span> <strong>${v.nearHighRiskArea ? 'YES ⚠️' : 'No'}</strong></div>
              </div>

              <!-- Reasons List -->
              <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:6px 8px; margin-bottom:8px;">
                <div style="font-size:10px; font-weight:800; text-transform:uppercase; color:#475569; margin-bottom:4px;">
                  Threat Reasoning (${reasonsList.length})
                </div>
                ${
                  reasonsList && reasonsList.length
                    ? reasonsList
                        .map(
                          (r) => `
                        <div style="font-size:11px; color:#b91c1c; display:flex; align-items:center; gap:4px; margin-bottom:2px;">
                          <span>⚠️</span> <span>${r}</span>
                        </div>
                      `
                        )
                        .join("")
                    : `<div style="font-size:11px; color:#16a34a;">✓ Standard transit criteria met</div>`
                }
              </div>

              <div style="display:flex; gap:6px; border-top:1px solid #e2e8f0; padding-top:8px;">
                <button class="btn btn-primary btn-sm" style="flex:1;" onclick="window.openThreatDossier('${v.vesselId || v.id}')">
                  Threat Dossier
                </button>
                <button class="btn btn-secondary btn-sm" style="padding:4px 8px;" title="Transmit AIS Warning Hail" onclick="window.msStore.sendAisHail('${v.vesselId || v.id}')">
                  📡 Hail
                </button>
                ${
                  isCritical
                    ? `
                  <button class="btn btn-danger btn-sm" style="padding:4px 8px;" title="Escalate to Incident" onclick="window.msStore.escalateVesselToIncident('${v.vesselId || v.id}')">
                    🚨 Intercept
                  </button>
                `
                    : ""
                }
              </div>
            </div>
          `;

          m.bindPopup(popupHtml);
          m.addTo(vesselLayer);
        });
      }

      // 3. Active Incidents
      incidentLayer.clearLayers();
      if (activeLayers.incidents) {
        (state.incidents || [])
          .filter((i) => i.status !== "Closed")
          .forEach((inc) => {
            const pinHtml = `
              <div class="ms-pin-marker ms-incident-pulse" style="background:#ef4444; border:2.5px solid #ffffff; box-shadow:0 0 12px #ef4444;">
                !
              </div>
            `;
            const icon = L.divIcon({
              className: "ms-vessel-marker",
              html: pinHtml,
              iconSize: [28, 28],
              iconAnchor: [14, 14]
            });
            const marker = L.marker([inc.lat, inc.lng], { icon });

            marker.bindPopup(`
              <div class="ms-tactical-popup" style="font-family:Inter,sans-serif; min-width:240px;">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e2e8f0; padding-bottom:4px; margin-bottom:6px;">
                  <strong style="color:#ef4444; font-size:13px;">${inc.id}</strong>
                  <span class="badge badge-critical">${inc.riskLevel} (${inc.risk}/100)</span>
                </div>
                <div style="font-weight:700; font-size:12px; margin-bottom:4px;">${inc.title}</div>
                <div style="font-size:11px; color:#64748b; margin-bottom:6px;">Target Contact: <strong>${inc.vesselName}</strong></div>
                <div style="font-size:10px; color:#94a3b8; margin-bottom:8px;">${inc.description}</div>
                <div style="display:flex; gap:6px;">
                  <button class="btn btn-primary btn-sm" style="flex:1;" onclick="if(window.renderTab) window.renderTab('incidents');">
                    Manage Case &rarr;
                  </button>
                  <button class="btn btn-secondary btn-sm" onclick="window.openThreatDossier('${inc.vesselId}')">
                    Inspect Target
                  </button>
                </div>
              </div>
            `);
            marker.addTo(incidentLayer);
          });
      }
    }

    // Attach Tactical Controls Overlay to Container
    function attachTacticalMapControls() {
      // Check if control panel already exists
      let toolbar = el.querySelector(".ms-map-tactical-toolbar");
      if (!toolbar) {
        toolbar = document.createElement("div");
        toolbar.className = "ms-map-tactical-toolbar";
        toolbar.innerHTML = `
          <div class="ms-map-toolbar-row">
            <div class="ms-map-filter-group">
              <button class="ms-map-filter-btn active" data-filter="all">All Fleet</button>
              <button class="ms-map-filter-btn" data-filter="critical">🚨 Threats (Risk &ge; 80)</button>
            </div>

            <div class="ms-map-sector-group">
              <select class="ms-map-sector-select">
                <option value="overview">📍 Bay of Bengal Grid</option>
                <option value="vizag">⚓ Visakhapatnam Sector</option>
                <option value="paradip">🚢 Paradip Strategic Approach</option>
                <option value="chennai">🏙️ Chennai Outer Roadstead</option>
                <option value="andaman">🌴 Andaman &amp; Nicobar</option>
              </select>
            </div>

            <div class="ms-map-layer-dropdown">
              <button class="ms-map-layer-btn" title="Toggle Map Layers">
                🗺️ Layers ▾
              </button>
              <div class="ms-map-layer-menu">
                <label><input type="checkbox" data-layer="vessels" checked> Vessel Fleet &amp; Tracks</label>
                <label><input type="checkbox" data-layer="zones" checked> Security Geofences</label>
                <label><input type="checkbox" data-layer="incidents" checked> Active Tactical Incidents</label>
                <label><input type="checkbox" data-layer="radar" checked> Coastal Radar Coverage</label>
                <label><input type="checkbox" data-layer="eez" checked> EEZ &amp; Territorial Bounds</label>
                <hr style="margin:6px 0; border:0; border-top:1px solid #e2e8f0;">
                <div style="font-size:10px; font-weight:700; color:#64748b; margin-bottom:4px; text-transform:uppercase;">Map Style</div>
                <label><input type="radio" name="basemap-${containerId}" value="voyager" ${currentTileKey === 'voyager' ? 'checked' : ''}> Tactical Marine</label>
                <label><input type="radio" name="basemap-${containerId}" value="dark" ${currentTileKey === 'dark' ? 'checked' : ''}> Dark C2 Command</label>
                <label><input type="radio" name="basemap-${containerId}" value="satellite" ${currentTileKey === 'satellite' ? 'checked' : ''}> Ocean Satellite</label>
              </div>
            </div>
          </div>
        `;
        el.style.position = "relative";
        el.appendChild(toolbar);

        // Toolbar Events
        toolbar.querySelectorAll(".ms-map-filter-btn").forEach((btn) => {
          btn.addEventListener("click", () => {
            toolbar.querySelectorAll(".ms-map-filter-btn").forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            activeFilter = btn.getAttribute("data-filter");
            updateLayers();
          });
        });

        const sectorSelect = toolbar.querySelector(".ms-map-sector-select");
        sectorSelect.addEventListener("change", (e) => {
          const val = e.target.value;
          if (val === "vizag") {
            map.flyTo([17.68, 83.38], 9, { duration: 1.2 });
          } else if (val === "paradip") {
            map.flyTo([20.20, 86.75], 9, { duration: 1.2 });
          } else if (val === "chennai") {
            map.flyTo([13.15, 80.38], 9, { duration: 1.2 });
          } else if (val === "andaman") {
            map.flyTo([11.8, 92.8], 8, { duration: 1.2 });
          } else {
            map.flyTo([17.2, 85.5], 6, { duration: 1.2 });
          }
        });

        // Layer check toggles
        toolbar.querySelectorAll(".ms-map-layer-menu input[type='checkbox']").forEach((cb) => {
          cb.addEventListener("change", (e) => {
            const layerKey = e.target.getAttribute("data-layer");
            activeLayers[layerKey] = e.target.checked;
            if (layerKey === "eez") {
              if (e.target.checked) drawMaritimeBoundaries();
              else eezLayer.clearLayers();
            } else if (layerKey === "radar") {
              if (e.target.checked) drawCoastalRadarCoverage();
              else radarLayer.clearLayers();
            }
            updateLayers();
          });
        });

        // Basemap switcher
        toolbar.querySelectorAll(`.ms-map-layer-menu input[name='basemap-${containerId}']`).forEach((rb) => {
          rb.addEventListener("change", (e) => {
            const nextKey = e.target.value;
            map.removeLayer(baseTileLayers[currentTileKey]);
            baseTileLayers[nextKey].addTo(map);
            currentTileKey = nextKey;
          });
        });

        // Layer dropdown toggle
        const layerBtn = toolbar.querySelector(".ms-map-layer-btn");
        const layerMenu = toolbar.querySelector(".ms-map-layer-menu");
        layerBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          layerMenu.classList.toggle("open");
        });

        window.addEventListener("click", () => {
          layerMenu.classList.remove("open");
        });
        layerMenu.addEventListener("click", (e) => e.stopPropagation());
      }
    }

    attachTacticalMapControls();

    // Auto resize observer to prevent grey/black tile artifacts
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => {
        if (map) map.invalidateSize();
      });
      ro.observe(el);
    }

    window.addEventListener("resize", () => {
      if (map) map.invalidateSize();
    });

    [50, 150, 300, 500].forEach((delay) => {
      setTimeout(() => {
        if (map) map.invalidateSize();
      }, delay);
    });

    // Initial render & sync with store
    updateLayers(window.msStore.getState());
    const unsubscribe = window.msStore.subscribe(updateLayers);

    return {
      map,
      updateLayers,
      flyToContact: (lat, lng, zoom = 9) => {
        if (map) map.flyTo([lat, lng], zoom, { duration: 1.2 });
      },
      destroy: () => {
        unsubscribe();
        if (mapInstances[containerId]) {
          mapInstances[containerId].remove();
          delete mapInstances[containerId];
        }
      }
    };
  }

  /* ---------------- Global Threat Dossier Modal Handler ---------------- */
  window.openThreatDossier = function (vesselId) {
    const s = window.msStore.getState();
    const v = s.vessels.find((x) => x.id === vesselId || x.vesselId === vesselId || x.name === vesselId);
    if (!v) {
      if (window.MS_UI) window.MS_UI.showToast("Contact profile not found.", "error");
      return;
    }

    if (v.lat && v.lng) {
      Object.values(mapInstances).forEach((m) => {
        if (m && typeof m.panTo === "function") {
          m.panTo([v.lat, v.lng], { animate: true });
        }
      });
    }

    let modal = document.getElementById("threat-dossier-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "threat-dossier-modal";
      modal.className = "modal-backdrop";
      modal.innerHTML = `
        <div class="modal-dialog" style="max-width: 600px;">
          <div class="modal-header" style="background:var(--bg-card-subtle);">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:18px;">🛡️</span>
              <h3 class="modal-title" id="dossier-title">Tactical Threat Dossier</h3>
            </div>
            <button class="toast-close" onclick="document.getElementById('threat-dossier-modal').classList.remove('open')">&times;</button>
          </div>
          <div class="modal-body" id="dossier-body">
            <!-- Dynamic Telemetry Dossier -->
          </div>
          <div class="modal-footer" id="dossier-footer">
            <!-- Dynamic Actions -->
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    // Dynamic threat risk evaluation using active threat rules
    const calcRisk = (typeof window !== "undefined" && window.calculateRisk) ? window.calculateRisk : (x) => ({ score: 0, reasons: [] });
    const classifyThreat = (typeof window !== "undefined" && window.classifyThreat) ? window.classifyThreat : (x, s) => "Normal";
    const freshEval = calcRisk(v, s.threatRules);

    // Synchronize effective risk score and threat behaviors with active alerts/incidents
    const relatedAlert = (s.alerts || []).find((a) => a.vesselId === v.id || a.vesselId === v.vesselId || a.vesselName === v.name);
    const relatedInc = (s.incidents || []).find((inc) => inc.vesselId === v.id || inc.vesselId === v.vesselId || inc.vesselName === v.name);

    let effectiveRisk = Math.max(v.riskScore ?? v.risk ?? 0, freshEval.score);
    if (relatedAlert && relatedAlert.risk > effectiveRisk) {
      effectiveRisk = relatedAlert.risk;
    }
    if (relatedInc && relatedInc.risk > effectiveRisk) {
      effectiveRisk = relatedInc.risk;
    }

    const cleanReason = (r) => (typeof r === "string" ? r.replace(/\s*\(\+\d+\s*pts\)/gi, "").trim() : "");
    let rawList = [
      ...(Array.isArray(v.behaviours) ? v.behaviours : []),
      ...(Array.isArray(v.reasons) ? v.reasons : []),
      ...(freshEval.reasons || [])
    ];
    if (relatedAlert && relatedAlert.behaviours && relatedAlert.behaviours.length) {
      rawList.push(...relatedAlert.behaviours);
    }
    const effectiveBehaviours = Array.from(new Set(rawList.map(cleanReason).filter(Boolean)));
    let effectiveThreatType = (relatedAlert && relatedAlert.threatType) || classifyThreat(v, effectiveRisk);

    const isCritical = effectiveRisk >= 80;
    const isHigh = effectiveRisk >= 60 && effectiveRisk < 80;
    const zone = s.zones.find((z) => z.id === v.zoneId);

    const bodyEl = document.getElementById("dossier-body");
    bodyEl.innerHTML = `
      <!-- Threat Header Card -->
      <div style="background:${isCritical ? 'rgba(239, 68, 68, 0.08)' : isHigh ? 'rgba(249, 115, 22, 0.08)' : 'rgba(15, 23, 42, 0.04)'}; border:1px solid ${isCritical ? '#ef4444' : isHigh ? '#f97316' : '#cbd5e1'}; border-radius:var(--radius-md); padding:16px; margin-bottom:16px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <h2 style="font-size:18px; font-weight:800; color:var(--text-main); margin:0;">${v.name}</h2>
              <span class="badge ${isCritical ? 'badge-critical' : isHigh ? 'badge-danger' : effectiveRisk >= 40 ? 'badge-warn' : 'badge-ok'}">
                ${getRiskLabel({ level: isCritical ? 'HIGH' : isHigh ? 'HIGH' : effectiveRisk >= 40 ? 'MEDIUM' : 'LOW', threatType: effectiveThreatType, risk: effectiveRisk })}
              </span>
            </div>
            <p style="font-size:12px; color:var(--text-muted); margin-top:4px;">
              ${v.type} · Flag: <strong>${v.flag}</strong> · Callsign: <strong class="mono">${v.callsign || 'N/A'}</strong>
            </p>
          </div>
          <div style="text-align:right;">
            <div style="font-size:24px; font-weight:900; color:${getRiskColor(effectiveRisk)}; font-family:'JetBrains Mono',monospace;">
              ${effectiveRisk}<span style="font-size:14px; font-weight:600; color:var(--text-muted);">/100</span>
            </div>
            <span style="font-size:10px; text-transform:uppercase; color:var(--text-muted); font-weight:700;">Threat Score</span>
          </div>
        </div>

        <div class="risk-meter-bar" style="margin-top:10px;">
          <div class="risk-meter-fill" style="width:${effectiveRisk}%; background:${getRiskColor(effectiveRisk)};"></div>
        </div>
      </div>

      <!-- Telemetry Matrix -->
      <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; margin-bottom:16px;">
        <div style="background:var(--bg-card-subtle); padding:10px; border-radius:var(--radius-md); border:1px solid var(--border-color);">
          <span style="font-size:10px; text-transform:uppercase; color:var(--text-muted); font-weight:700;">MMSI / IMO</span>
          <div class="mono" style="font-size:13px; font-weight:700; margin-top:2px;">${v.mmsi}</div>
          <div style="font-size:10px; color:var(--text-muted);">IMO: ${v.imo || 'N/A'}</div>
        </div>

        <div style="background:var(--bg-card-subtle); padding:10px; border-radius:var(--radius-md); border:1px solid var(--border-color);">
          <span style="font-size:10px; text-transform:uppercase; color:var(--text-muted); font-weight:700;">Speed &amp; Heading</span>
          <div class="mono" style="font-size:13px; font-weight:700; margin-top:2px;">${v.speed} kts</div>
          <div style="font-size:10px; color:var(--text-muted);">${v.course}° Course Over Ground</div>
        </div>

        <div style="background:var(--bg-card-subtle); padding:10px; border-radius:var(--radius-md); border:1px solid var(--border-color);">
          <span style="font-size:10px; text-transform:uppercase; color:var(--text-muted); font-weight:700;">Coordinates</span>
          <div class="mono" style="font-size:12px; font-weight:700; margin-top:2px;">${v.lat}°N, ${v.lng}°E</div>
          <div style="font-size:10px; color:var(--text-muted);">Bay of Bengal Grid</div>
        </div>
      </div>

      <!-- Navigation & AIS Status -->
      <div class="keyval-row"><span class="keyval-key">AIS Signal Status</span><span class="keyval-val badge ${v.ais === 'active' ? 'badge-ok' : 'badge-critical'}">${(v.ais || (v.aisOff ? 'lost' : 'active')).toUpperCase()}</span></div>
      <div class="keyval-row"><span class="keyval-key">Reported Destination</span><span class="keyval-val">${v.destination || 'Unscheduled'} (ETA: ${v.eta || 'N/A'})</span></div>
      <div class="keyval-row"><span class="keyval-key">Hull Dimensions</span><span class="keyval-val">${v.dimensions || 'Standard Coastal Craft'}</span></div>
      <div class="keyval-row"><span class="keyval-key">Operational Sector</span><span class="keyval-val">${zone ? `${zone.name} (${zone.classification})` : 'Open Water Corridor'}</span></div>

      <!-- Behaviour & Rule Violations -->
      <div style="margin-top:16px;">
        <span class="form-label" style="font-weight:700;">Detected Threat Behaviors &amp; Violations:</span>
        <div style="margin-top:6px; display:flex; flex-direction:column; gap:6px;">
          ${
            effectiveBehaviours && effectiveBehaviours.length
              ? effectiveBehaviours
                  .map((b) => {
                    const pts = b.includes("Restricted") || b.includes("restricted") ? 25
                              : b.includes("AIS") || b.includes("blackout") || b.includes("off") ? 20
                              : b.includes("speed variation") || b.includes("Speed variation") ? 15
                              : b.includes("high-risk") || b.includes("High-risk") ? 10
                              : b.includes("loitering") || b.includes("Loitering") ? 10
                              : b.includes("deviation") || b.includes("Deviation") ? 10
                              : b.includes("Low speed") || b.includes("low speed") ? 5 : 10;
                    return `
                      <div style="display:flex; align-items:center; justify-content:space-between; background:var(--bg-card-subtle); padding:8px 12px; border-radius:var(--radius-md); border-left:3px solid #ef4444;">
                        <span style="font-size:12px; font-weight:600; color:#ef4444;">⚠️ ${b}</span>
                        <span class="badge badge-danger">+${pts} pts</span>
                      </div>
                    `;
                  })
                  .join("")
              : `
                <div style="display:flex; align-items:center; gap:6px; background:#f0fdf4; padding:8px 12px; border-radius:var(--radius-md); color:#16a34a; font-size:12px;">
                  <span>✓</span> <span>No rule violations triggered. Standard maritime compliance.</span>
                </div>
              `
          }
        </div>
      </div>
    `;

    const isAdminPage = window.location.pathname.includes("admin") || (s.session && s.session.role === "administrator");

    const footerEl = document.getElementById("dossier-footer");
    footerEl.innerHTML = `
      <button type="button" class="btn btn-secondary" onclick="document.getElementById('threat-dossier-modal').classList.remove('open')">Close</button>
      ${
        !isAdminPage
          ? `
        <button type="button" class="btn btn-primary" onclick="document.getElementById('threat-dossier-modal').classList.remove('open'); window.msStore.assignVesselToFieldOfficer('${v.id}');">
          🎯 Assign
        </button>
      `
          : ""
      }
    `;

    modal.classList.add("open");
  };

  return {
    initMap,
    getRiskColor,
    getZoneColor
  };
})();
