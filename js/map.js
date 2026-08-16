/**
 * MARISENTINEL — Vanilla JS Leaflet Interactive Maritime Map Controller
 */

window.MS_MAP = (function () {
  function initMap(containerId, options = {}) {
    const el = document.getElementById(containerId);
    if (!el || typeof L === "undefined") return null;

    const center = options.center || [17.5, 84.5];
    const zoom = options.zoom || 6;

    const map = L.map(containerId, {
      center,
      zoom,
      zoomControl: true,
      attributionControl: false
    });

    // High-contrast clean cartographic tiles
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      maxZoom: 18,
      subdomains: "abcd"
    }).addTo(map);

    let vesselLayer = L.layerGroup().addTo(map);
    let zoneLayer = L.layerGroup().addTo(map);
    let incidentLayer = L.layerGroup().addTo(map);
    let officerLayer = L.layerGroup().addTo(map);
    let trailLayer = L.layerGroup().addTo(map);

    function getRiskColor(risk) {
      if (risk >= 80) return "#ef4444"; // red critical (Tertiary #EF4444)
      if (risk >= 60) return "#f97316"; // orange high
      if (risk >= 40) return "#f59e0b"; // amber elevated
      return "#22c55e"; // green normal (Secondary #22C55E)
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

    function updateLayers(state) {
      if (!map) return;

      // 1. Zones
      zoneLayer.clearLayers();
      (state.zones || []).forEach((z) => {
        const color = getZoneColor(z.classification);
        const circle = L.circle([z.lat, z.lng], {
          radius: z.radiusKm * 1000,
          color,
          weight: 1.5,
          fillColor: color,
          fillOpacity: 0.08,
          dashArray: z.status === "active" ? null : "4, 4"
        });
        circle.bindTooltip(`<strong>${z.name}</strong><br><span style="text-transform:uppercase;font-size:10px;">${z.classification} · ${z.radiusKm} km radius</span>`, {
          direction: "top"
        });
        circle.addTo(zoneLayer);
      });

      // 2. Vessels & Trails
      vesselLayer.clearLayers();
      trailLayer.clearLayers();
      (state.vessels || []).forEach((v) => {
        const color = getRiskColor(v.risk);
        const size = v.risk >= 80 ? 18 : 14;

        // Trail line
        if (v.trail && v.trail.length > 1) {
          L.polyline(v.trail, {
            color,
            weight: 1.5,
            opacity: 0.6,
            dashArray: "4, 4"
          }).addTo(trailLayer);
        }

        // Custom Vessel HTML Marker
        const markerHtml = `
          <div style="
            width:${size}px;
            height:${size}px;
            background:${color};
            border-radius:50%;
            border:2px solid #ffffff;
            box-shadow:0 0 8px ${color};
            ${v.risk >= 80 ? `outline: 2px solid ${color}; outline-offset: 3px;` : ""}
          "></div>
        `;

        const icon = L.divIcon({
          className: "ms-vessel-marker",
          html: markerHtml,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2]
        });

        const m = L.marker([v.lat, v.lng], { icon });
        m.bindPopup(`
          <div style="font-family:Inter,sans-serif;font-size:12px;min-width:180px;">
            <div style="font-weight:700;font-size:13px;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin-bottom:6px;">
              ${v.name}
            </div>
            <div><strong>MMSI:</strong> ${v.mmsi}</div>
            <div><strong>Type:</strong> ${v.type} (${v.flag})</div>
            <div><strong>Speed:</strong> ${v.speed} kts · <strong>Heading:</strong> ${v.course}°</div>
            <div><strong>Threat Risk:</strong> <span style="font-weight:700;color:${color};">${v.risk}/100</span></div>
            ${v.behaviours && v.behaviours.length ? `<div style="margin-top:4px;color:#ef4444;font-size:11px;">⚠️ ${v.behaviours.join(", ")}</div>` : ""}
          </div>
        `);
        m.addTo(vesselLayer);
      });

      // 3. Active Incidents
      incidentLayer.clearLayers();
      (state.incidents || [])
        .filter((i) => i.status !== "Closed")
        .forEach((inc) => {
          const pinHtml = `
            <div class="ms-pin-marker" style="background:#ef4444;border:2px solid #ffffff;">!</div>
          `;
          const icon = L.divIcon({
            className: "ms-vessel-marker",
            html: pinHtml,
            iconSize: [26, 26],
            iconAnchor: [13, 13]
          });
          const marker = L.marker([inc.lat, inc.lng], { icon });
          marker.bindPopup(`
            <div style="font-family:Inter,sans-serif;font-size:12px;">
              <strong style="color:#ef4444;">${inc.id} · ${inc.category}</strong>
              <p style="margin-top:4px;">${inc.title}</p>
              <div style="margin-top:4px;font-size:11px;color:#64748b;">Risk: ${inc.riskLevel} (${inc.risk})</div>
            </div>
          `);
          marker.addTo(incidentLayer);
        });

      // 4. Field Officers & Mission Routes
      officerLayer.clearLayers();
      (state.users || [])
        .filter((u) => u.role === "field" && u.lat && u.lng)
        .forEach((off) => {
          const pinHtml = `
            <div class="ms-pin-marker" style="background:#22c55e;border:2px solid #ffffff;font-weight:700;">F</div>
          `;
          const icon = L.divIcon({
            className: "ms-vessel-marker",
            html: pinHtml,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          });
          const marker = L.marker([off.lat, off.lng], { icon });
          marker.bindPopup(`
            <div style="font-family:Inter,sans-serif;font-size:12px;">
              <strong>${off.name}</strong>
              <div style="color:#64748b;font-size:11px;">${off.region}</div>
              <div style="margin-top:4px;">Status: <span style="font-weight:700; color:#22c55e;">${(off.availability || 'available').toUpperCase()}</span></div>
              <div style="font-size:11px;color:#94a3b8;margin-top:2px;">${off.lat.toFixed(2)}°N, ${off.lng.toFixed(2)}°E</div>
            </div>
          `);
          marker.addTo(officerLayer);

          // Find assigned incident for mission route line
          const assignedInc = (state.incidents || []).find((i) => i.status !== "Closed" && i.assignedTo === off.id);
          if (assignedInc && assignedInc.lat && assignedInc.lng) {
            const routeLine = L.polyline(
              [[off.lat, off.lng], [assignedInc.lat, assignedInc.lng]],
              { color: "#22c55e", weight: 3, dashArray: "6, 8", opacity: 0.85 }
            );
            routeLine.bindTooltip(`Mission Route: ${off.name} &rarr; ${assignedInc.id}`, { permanent: false, sticky: true });
            routeLine.addTo(officerLayer);
          }
        });
    }

    // Auto resize observer to prevent grey/black tile artifacts
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => {
        if (map) {
          map.invalidateSize();
        }
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
    window.msStore.subscribe(updateLayers);

    return {
      map,
      updateLayers
    };
  }

  return {
    initMap
  };
})();
