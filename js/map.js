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

  // Coastal Radar Stations (CSCR Phase II)
  const CSCR_RADAR_STATIONS = [
    { name: "Visakhapatnam Naval Radar (CSCR-01)", lat: 17.68, lng: 83.35, rangeKm: 65 },
    { name: "Paradip Port Surveillance Radar (CSCR-02)", lat: 20.25, lng: 86.70, rangeKm: 70 },
    { name: "Gopalpur Defence Radar (CSCR-03)", lat: 19.25, lng: 84.95, rangeKm: 60 },
    { name: "Chennai Coastal Radar (CSCR-04)", lat: 13.10, lng: 80.30, rangeKm: 65 },
    { name: "Port Blair Tri-Command Radar (CSCR-05)", lat: 11.68, lng: 92.75, rangeKm: 75 }
  ];

  function getRiskColor(risk) {
    if (risk >= 80) return "#ef4444"; // Critical Red
    if (risk >= 60) return "#f97316"; // High Orange
    if (risk >= 40) return "#f59e0b"; // Elevated Amber
    return "#22c55e"; // Nominal Green
  }

  function getRiskLabel(risk) {
    if (risk >= 80) return "CRITICAL THREAT";
    if (risk >= 60) return "HIGH RISK";
    if (risk >= 40) return "ELEVATED";
    return "NOMINAL";
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

    const center = options.center || [17.2, 85.5];
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

    // Tile Layers
    const baseTileLayers = {
      voyager: L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        maxZoom: 18,
        subdomains: "abcd"
      }),
      dark: L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 18,
        subdomains: "abcd"
      }),
      satellite: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 18
      })
    };

    let currentTileKey = options.theme === "dark" ? "dark" : "voyager";
    baseTileLayers[currentTileKey].addTo(map);

    // Overlays Groups
    const vesselLayer = L.layerGroup().addTo(map);
    const trailLayer = L.layerGroup().addTo(map);
    const zoneLayer = L.layerGroup().addTo(map);
    const incidentLayer = L.layerGroup().addTo(map);
    const officerLayer = L.layerGroup().addTo(map);
    const radarLayer = L.layerGroup().addTo(map);
    const eezLayer = L.layerGroup().addTo(map);

    // Filter State
    let activeFilter = "all"; // 'all', 'critical', 'blackout', 'incidents', 'field'
    let activeLayers = {
      vessels: true,
      zones: true,
      incidents: true,
      officers: true,
      radar: true,
      eez: true
    };

    // Draw Static EEZ & Territorial Water Lines
    function drawMaritimeBoundaries() {
      eezLayer.clearLayers();

      // 200 NM EEZ Line
      const eezLine = L.polyline(EEZ_COORDINATES, {
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
      const territorialLine = L.polyline(TERRITORIAL_WATERS_12NM, {
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
      CSCR_RADAR_STATIONS.forEach((st) => {
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

      // 2. Vessels & AIS Trails
      vesselLayer.clearLayers();
      trailLayer.clearLayers();

      if (activeLayers.vessels) {
        let filteredVessels = state.vessels || [];

        // Apply quick filter
        if (activeFilter === "critical") {
          filteredVessels = filteredVessels.filter((v) => v.risk >= 80);
        } else if (activeFilter === "blackout") {
          filteredVessels = filteredVessels.filter((v) => v.ais !== "active" || (v.behaviours && v.behaviours.some((b) => b.toLowerCase().includes("blackout") || b.toLowerCase().includes("dark"))));
        }

        filteredVessels.forEach((v) => {
          const color = getRiskColor(v.risk);
          const isCritical = v.risk >= 80;
          const isHigh = v.risk >= 60 && v.risk < 80;
          const size = isCritical ? 24 : isHigh ? 20 : 16;
          const heading = v.course || 0;

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

          // Interactive Popup with Threat Identity Breakdown & Instant Actions
          const popupHtml = `
            <div class="ms-tactical-popup" style="font-family:Inter,sans-serif; min-width:260px; max-width:320px; padding:2px;">
              <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e2e8f0; padding-bottom:6px; margin-bottom:8px;">
                <div>
                  <div style="font-weight:800; font-size:14px; color:#0f172a;">${v.name}</div>
                  <div style="font-size:10px; color:#64748b; font-family:'JetBrains Mono',monospace;">MMSI: ${v.mmsi} · ${v.callsign || 'N/A'}</div>
                </div>
                <span class="badge ${isCritical ? 'badge-critical' : isHigh ? 'badge-danger' : v.risk >= 40 ? 'badge-warn' : 'badge-ok'}" style="font-size:11px;">
                  ${v.risk}/100
                </span>
              </div>

              <div style="font-size:11px; display:grid; grid-template-columns:1fr 1fr; gap:4px 8px; margin-bottom:8px;">
                <div><span style="color:#64748b;">Flag:</span> <strong>${v.flag}</strong></div>
                <div><span style="color:#64748b;">Type:</span> <strong>${v.type}</strong></div>
                <div><span style="color:#64748b;">Speed:</span> <strong>${v.speed} kts</strong></div>
                <div><span style="color:#64748b;">Course:</span> <strong>${v.course}°</strong></div>
                <div><span style="color:#64748b;">AIS Status:</span> <strong style="color:${v.ais === 'active' ? '#22c55e' : '#ef4444'}; text-transform:uppercase;">${v.ais}</strong></div>
                <div><span style="color:#64748b;">Destination:</span> <strong>${v.destination || 'Bay of Bengal'}</strong></div>
              </div>

              ${
                v.behaviours && v.behaviours.length
                  ? `
                <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:6px; padding:6px 8px; margin-bottom:8px;">
                  <div style="font-size:10px; font-weight:800; text-transform:uppercase; color:#b91c1c; margin-bottom:3px;">Detected Violations</div>
                  ${v.behaviours
                    .map(
                      (b) => `
                    <div style="font-size:11px; color:#dc2626; display:flex; align-items:center; gap:4px; margin-bottom:2px;">
                      <span>⚠️</span> <span>${b}</span>
                    </div>
                  `
                    )
                    .join("")}
                </div>
              `
                  : `<div style="font-size:11px; color:#16a34a; margin-bottom:8px;">✓ Normal Navigation Pattern</div>`
              }

              <div style="display:flex; gap:6px; border-top:1px solid #e2e8f0; padding-top:8px;">
                <button class="btn btn-primary btn-sm" style="flex:1;" onclick="window.openThreatDossier('${v.id}')">
                  Threat Dossier
                </button>
                <button class="btn btn-secondary btn-sm" style="padding:4px 8px;" title="Transmit AIS Warning Hail" onclick="window.msStore.sendAisHail('${v.id}')">
                  📡 Hail
                </button>
                ${
                  isCritical || isHigh
                    ? `
                  <button class="btn btn-danger btn-sm" style="padding:4px 8px;" title="Escalate to Incident" onclick="window.msStore.escalateVesselToIncident('${v.id}')">
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

      // 4. Field Responders & Mission Intercept Routes
      officerLayer.clearLayers();
      if (activeLayers.officers) {
        (state.users || [])
          .filter((u) => u.role === "field" && u.lat && u.lng)
          .forEach((off) => {
            const pinHtml = `
              <div class="ms-pin-marker" style="background:#22c55e; border:2.5px solid #ffffff; font-weight:800; box-shadow:0 0 10px #22c55e;">
                F
              </div>
            `;
            const icon = L.divIcon({
              className: "ms-vessel-marker",
              html: pinHtml,
              iconSize: [26, 26],
              iconAnchor: [13, 13]
            });
            const marker = L.marker([off.lat, off.lng], { icon });

            // Assigned Incident
            const assignedInc = (state.incidents || []).find(
              (i) => i.status !== "Closed" && i.assignedTo === off.id
            );

            marker.bindPopup(`
              <div class="ms-tactical-popup" style="font-family:Inter,sans-serif; min-width:220px;">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e2e8f0; padding-bottom:4px; margin-bottom:6px;">
                  <strong style="font-size:13px;">${off.name}</strong>
                  <span class="badge ${off.availability === 'available' ? 'badge-ok' : 'badge-warn'}">${(off.availability || 'standby').toUpperCase()}</span>
                </div>
                <div style="font-size:11px; color:#64748b;">Base: ${off.region}</div>
                <div style="font-size:11px; color:#64748b; margin-top:2px;">Pos: <span class="mono">${off.lat.toFixed(2)}°N, ${off.lng.toFixed(2)}°E</span></div>
                ${
                  assignedInc
                    ? `
                  <div style="margin-top:8px; padding:6px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:6px; font-size:11px;">
                    <strong>Mission:</strong> ${assignedInc.id} — ${assignedInc.vesselName}
                    <button class="btn btn-sm btn-secondary" style="width:100%; margin-top:6px;" onclick="window.msStore.simulateOfficerMovement('${off.id}', '${assignedInc.id}')">
                      ▶ Advance Interceptor
                    </button>
                  </div>
                `
                    : ""
                }
              </div>
            `);
            marker.addTo(officerLayer);

            // Mission Intercept Vector Line
            if (assignedInc && assignedInc.lat && assignedInc.lng) {
              const routeLine = L.polyline(
                [[off.lat, off.lng], [assignedInc.lat, assignedInc.lng]],
                { color: "#22c55e", weight: 3, dashArray: "6, 8", opacity: 0.9 }
              );
              routeLine.bindTooltip(
                `<strong>Intercept Vector:</strong> ${off.name} &rarr; ${assignedInc.vesselName}`,
                { sticky: true }
              );
              routeLine.addTo(officerLayer);
            }
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
              <button class="ms-map-filter-btn" data-filter="blackout">📡 AIS Dark</button>
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
                <label><input type="checkbox" data-layer="officers" checked> Interceptors &amp; Routes</label>
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
    const v = s.vessels.find((x) => x.id === vesselId);
    if (!v) {
      if (window.MS_UI) window.MS_UI.showToast("Contact profile not found.", "error");
      return;
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

    const isCritical = v.risk >= 80;
    const isHigh = v.risk >= 60 && v.risk < 80;
    const zone = s.zones.find((z) => z.id === v.zoneId);

    const bodyEl = document.getElementById("dossier-body");
    bodyEl.innerHTML = `
      <!-- Threat Header Card -->
      <div style="background:${isCritical ? 'rgba(239, 68, 68, 0.08)' : isHigh ? 'rgba(249, 115, 22, 0.08)' : 'rgba(15, 23, 42, 0.04)'}; border:1px solid ${isCritical ? '#ef4444' : isHigh ? '#f97316' : '#cbd5e1'}; border-radius:var(--radius-md); padding:16px; margin-bottom:16px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <h2 style="font-size:18px; font-weight:800; color:var(--text-main); margin:0;">${v.name}</h2>
              <span class="badge ${isCritical ? 'badge-critical' : isHigh ? 'badge-danger' : v.risk >= 40 ? 'badge-warn' : 'badge-ok'}">
                ${getRiskLabel(v.risk)}
              </span>
            </div>
            <p style="font-size:12px; color:var(--text-muted); margin-top:4px;">
              ${v.type} · Flag: <strong>${v.flag}</strong> · Callsign: <strong class="mono">${v.callsign || 'N/A'}</strong>
            </p>
          </div>
          <div style="text-align:right;">
            <div style="font-size:24px; font-weight:900; color:${getRiskColor(v.risk)}; font-family:'JetBrains Mono',monospace;">
              ${v.risk}<span style="font-size:14px; font-weight:600; color:var(--text-muted);">/100</span>
            </div>
            <span style="font-size:10px; text-transform:uppercase; color:var(--text-muted); font-weight:700;">Threat Score</span>
          </div>
        </div>

        <div class="risk-meter-bar" style="margin-top:10px;">
          <div class="risk-meter-fill" style="width:${v.risk}%; background:${getRiskColor(v.risk)};"></div>
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
      <div class="keyval-row"><span class="keyval-key">AIS Signal Status</span><span class="keyval-val badge ${v.ais === 'active' ? 'badge-ok' : 'badge-critical'}">${v.ais.toUpperCase()}</span></div>
      <div class="keyval-row"><span class="keyval-key">Reported Destination</span><span class="keyval-val">${v.destination || 'Unscheduled'} (ETA: ${v.eta || 'N/A'})</span></div>
      <div class="keyval-row"><span class="keyval-key">Hull Dimensions</span><span class="keyval-val">${v.dimensions || 'Standard Coastal Craft'}</span></div>
      <div class="keyval-row"><span class="keyval-key">Operational Sector</span><span class="keyval-val">${zone ? `${zone.name} (${zone.classification})` : 'Open Water Corridor'}</span></div>

      <!-- Behaviour & Rule Violations -->
      <div style="margin-top:16px;">
        <span class="form-label" style="font-weight:700;">Detected Threat Behaviors &amp; Violations:</span>
        <div style="margin-top:6px; display:flex; flex-direction:column; gap:6px;">
          ${
            v.behaviours && v.behaviours.length
              ? v.behaviours
                  .map(
                    (b) => `
                <div style="display:flex; align-items:center; justify-content:space-between; background:var(--bg-card-subtle); padding:8px 12px; border-radius:var(--radius-md); border-left:3px solid #ef4444;">
                  <span style="font-size:12px; font-weight:600; color:#ef4444;">⚠️ ${b}</span>
                  <span class="badge badge-danger">+${b.includes('naval') || b.includes('Restricted') ? '35' : b.includes('blackout') ? '30' : '20'} pts</span>
                </div>
              `
                  )
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

    const footerEl = document.getElementById("dossier-footer");
    footerEl.innerHTML = `
      <button type="button" class="btn btn-secondary" onclick="document.getElementById('threat-dossier-modal').classList.remove('open')">Close</button>
      <button type="button" class="btn btn-secondary" onclick="window.msStore.sendAisHail('${v.id}')">📡 Transmit AIS Hail</button>
      ${
        isCritical || isHigh
          ? `
        <button type="button" class="btn btn-primary" onclick="document.getElementById('threat-dossier-modal').classList.remove('open'); if(window.openDispatchModal) window.openDispatchModal('${v.id}'); else window.msStore.escalateVesselToIncident('${v.id}');">
          🎯 Intercept / Deploy Unit
        </button>
      `
          : `
        <button type="button" class="btn btn-primary" onclick="document.getElementById('threat-dossier-modal').classList.remove('open'); window.msStore.escalateVesselToIncident('${v.id}');">
          🚨 Log Incident
        </button>
      `
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
