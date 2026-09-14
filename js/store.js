/**
 * MARISENTINEL — Vanilla JS Central State Store & Simulation Engine
 * Incorporates strict maritime geofencing & real-time threat telemetry.
 */

(function () {
  const STORAGE_KEY = "marisentinel_state_v11"; // Calibrated threat alert intensity (4-5 critical threats daily max)

  /* ---------------- Maritime Geofencing Engine ---------------- */
  function getWestCoastMinLng(lat) {
    if (lat <= 9.0) return 79.2;
    if (lat <= 11.0) return 79.8 + ((lat - 9.0) * (80.0 - 79.8)) / 2.0;
    if (lat <= 13.0) return 80.0 + ((lat - 11.0) * (80.35 - 80.0)) / 2.0;
    if (lat <= 15.5) return 80.35 + ((lat - 13.0) * (80.25 - 80.35)) / 2.5;
    if (lat <= 16.5) return 80.25 + ((lat - 15.5) * (81.8 - 80.25)) / 1.0;
    if (lat <= 17.5) return 81.8 + ((lat - 16.5) * (83.2 - 81.8)) / 1.0;
    if (lat <= 18.5) return 83.2 + ((lat - 17.5) * (84.1 - 83.2)) / 1.0;
    if (lat <= 19.5) return 84.1 + ((lat - 18.5) * (85.2 - 84.1)) / 1.0;
    if (lat <= 20.5) return 85.2 + ((lat - 19.5) * (86.8 - 85.2)) / 1.0;
    if (lat <= 21.5) return 86.8 + ((lat - 20.5) * (87.7 - 86.8)) / 1.0;
    return 87.7 + ((lat - 21.5) * (88.5 - 87.7)) / 0.5;
  }

  function getEastCoastMaxLng(lat) {
    if (lat >= 21.0) return 91.8;
    if (lat >= 20.0) return 92.4;
    if (lat >= 18.0) return 93.6;
    if (lat >= 16.0) return 94.4;
    if (lat >= 14.0) return 97.2;
    return 98.0;
  }

  function isPointInMaritimeArea(lat, lng) {
    if (typeof lat !== "number" || typeof lng !== "number" || isNaN(lat) || isNaN(lng)) return false;
    if (lat < 8.0 || lat > 21.9) return false;
    const minLng = getWestCoastMinLng(lat);
    const maxLng = getEastCoastMaxLng(lat);
    return lng >= minLng && lng <= maxLng;
  }

  function clampToMaritime(lat, lng) {
    let safeLat = Math.min(21.75, Math.max(9.0, lat || 17.5));
    const minLng = getWestCoastMinLng(safeLat) + 0.12; // safe offshore buffer
    const maxLng = getEastCoastMaxLng(safeLat) - 0.12;
    let safeLng = Math.min(maxLng, Math.max(minLng, lng || 84.5));
    return [Math.round(safeLat * 1000) / 1000, Math.round(safeLng * 1000) / 1000];
  }

  window.MS_GEO = {
    isPointInMaritimeArea,
    clampToMaritime
  };

  // Prediction Pipeline Helper Functions
  function getRiskEngine() {
    if (typeof window !== "undefined" && window.calculateRisk) return window.calculateRisk;
    return (v) => ({ score: 0, reasons: [] });
  }

  function getThreatEngine() {
    if (typeof window !== "undefined" && window.classifyThreat) return window.classifyThreat;
    return (v, s) => "Normal";
  }

  async function fetchDataset(filename) {
    const candidatePaths = [
      `/data/${filename}`,
      `data/${filename}`,
      `./data/${filename}`,
      `/public/data/${filename}`,
      `public/data/${filename}`
    ];
    for (const p of candidatePaths) {
      try {
        const res = await fetch(p);
        if (res.ok) return await res.json();
      } catch (_) {}
    }
    throw new Error(`Unable to load dataset: ${filename}`);
  }

  async function loadVessels() {
    const raw = await fetchDataset("vessels.json");
    const calcRisk = getRiskEngine();
    const classifyThreat = getThreatEngine();

    return raw.map((v) => {
      const { score, reasons } = calcRisk(v);
      const threatType = classifyThreat(v, score);
      const level = score > 70 ? "HIGH" : score > 30 ? "MEDIUM" : "LOW";

      return {
        ...v,
        id: v.vesselId || v.id,
        vesselId: v.vesselId || v.id,
        riskScore: score,
        risk: score,
        level,
        threatType,
        reasons,
        behaviours: reasons,
        course: v.heading ?? v.course ?? 0,
        heading: v.heading ?? v.course ?? 0,
        ais: v.aisOff ? "lost" : "active",
        trail: v.trail || [[v.lat, v.lng]],
        lastUpdate: new Date().toISOString()
      };
    });
  }

  class MsStore {
    constructor() {
      this.listeners = new Set();
      this.state = this.getInitialFallbackState();
      this.timer = null;
      this.isReady = false;
      this.ready = this.init();
    }

    getInitialFallbackState() {
      const seed = window.MS_SEED || {};
      return {
        vessels: seed.vessels || [],
        zones: seed.zones || [],
        highRiskAreas: seed.highRiskAreas || [],
        alerts: seed.alerts || [],
        incidents: seed.incidents || [],
        users: seed.users || [],
        sources: seed.sources || [],
        weather: seed.weather || { windKts: 18, windDir: "NE", waveM: 2.1, visibilityKm: 8.5, seaState: "Moderate", advisory: "" },
        audit: seed.audit || [],
        threatRules: (seed.threatRules && seed.threatRules.length) ? seed.threatRules : [
          { id: "TR-01", name: "Restricted Zone Entry", weight: 25, description: "Vessel entered an active security zone or restricted perimeter", status: "active" },
          { id: "TR-02", name: "AIS Signal Blackout", weight: 20, description: "AIS transponder disabled or signal lost in monitored waters", status: "active" },
          { id: "TR-03", name: "Sudden Speed Variation", weight: 15, description: "Speed variation delta exceeding 30 kts", status: "active" },
          { id: "TR-04", name: "High-Risk Area Proximity", weight: 10, description: "Proximity to designated high-risk maritime sector", status: "active" },
          { id: "TR-05", name: "Prolonged Loitering Detected", weight: 10, description: "Prolonged loitering detected in operational grid", status: "active" },
          { id: "TR-06", name: "Course Deviation", weight: 10, description: "Course deviation from designated shipping lane", status: "active" },
          { id: "TR-07", name: "Low Speed Detected", weight: 5, description: "Low vessel speed (<5 kts) detected in monitored sector", status: "active" }
        ],
        notifications: seed.notifications || [],
        session: null,
        simRunning: true,
        tick: 280
      };
    }

    async init() {
      try {
        const [vessels, zones, highRiskAreas, incidents, users, sources, weather, audit, notifications, alerts] = await Promise.all([
          loadVessels().catch((e) => { console.warn("Vessels pipeline fallback:", e); return []; }),
          fetchDataset("zones.json").catch(() => []),
          fetchDataset("highRiskAreas.json").catch(() => []),
          fetchDataset("incidents.json").catch(() => []),
          fetchDataset("users.json").catch(() => []),
          fetchDataset("sources.json").catch(() => []),
          fetchDataset("weather.json").catch(() => ({
            windKts: 18, windDir: "NE", waveM: 2.1, visibilityKm: 8.5, seaState: "Moderate", advisory: ""
          })),
          fetchDataset("audit.json").catch(() => []),
          fetchDataset("notifications.json").catch(() => []),
          fetchDataset("alerts.json").catch(() => [])
        ]);

        this.loadedData = {
          ...this.getInitialFallbackState(),
          vessels,
          zones,
          highRiskAreas,
          incidents,
          users,
          sources,
          weather,
          audit,
          notifications,
          alerts
        };
        window.MS_SEED = this.loadedData;
      } catch (err) {
        console.warn("[MsStore] Dataset init error:", err);
      }

      this.state = this.loadState();
      this.isReady = true;
      this.startSimulation();
      this.notify();
      return this.state;
    }

    loadState() {
      const seed = this.loadedData || window.MS_SEED || this.getInitialFallbackState();
      try {
        localStorage.removeItem("marisentinel_state_v2");
        localStorage.removeItem("marisentinel_state_v3");
        localStorage.removeItem("marisentinel_state_v4");
        localStorage.removeItem("marisentinel_state_v5");
        localStorage.removeItem("marisentinel_state_v6");
        localStorage.removeItem("marisentinel_state_v7");
        localStorage.removeItem("marisentinel_state_v8");
        localStorage.removeItem("marisentinel_state_v9");
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          const rawVessels = parsed.vessels && parsed.vessels.length ? parsed.vessels : seed.vessels || [];
          const calcRisk = getRiskEngine();
          const classifyThreat = getThreatEngine();

          const canonicalRules = (seed.threatRules && seed.threatRules.length >= 7)
            ? seed.threatRules
            : this.getInitialFallbackState().threatRules;

          const rawAlerts = (parsed.alerts && parsed.alerts.length) ? parsed.alerts : (seed.alerts || []);
          const activeAlerts = rawAlerts.filter((a) => !a.id || !a.id.startsWith("AL-100"));
          const activeIncidents = (parsed.incidents && parsed.incidents.length)
            ? parsed.incidents.filter((i) => i.id !== "INC-1001" && i.id !== "INC-1002")
            : (seed.incidents || []).filter((i) => i.id !== "INC-1001" && i.id !== "INC-1002");

          const sanitizedVessels = rawVessels.map((v) => {
            const seedV = (seed.vessels || []).find((sv) => sv.vesselId === (v.vesselId || v.id) || sv.id === (v.vesselId || v.id) || sv.name === v.name) || {};
            const mergedVessel = {
              ...seedV,
              ...v,
              inRestrictedZone: v.inRestrictedZone ?? seedV.inRestrictedZone,
              nearHighRiskArea: v.nearHighRiskArea ?? seedV.nearHighRiskArea,
              aisOff: v.aisOff ?? seedV.aisOff,
              speedChange: v.speedChange ?? seedV.speedChange
            };

            let lat = mergedVessel.lat;
            let lng = mergedVessel.lng;
            if (!isPointInMaritimeArea(lat, lng)) {
              const [cLat, cLng] = clampToMaritime(lat, lng);
              lat = cLat;
              lng = cLng;
            }
            let { score, reasons } = calcRisk({ ...mergedVessel, lat, lng }, canonicalRules);

            // Synchronize with active threat alert or incident risk scores
            const activeAlert = activeAlerts.find((a) => a.vesselId === mergedVessel.vesselId || a.vesselId === mergedVessel.id || a.vesselName === mergedVessel.name);
            const activeInc = activeIncidents.find((inc) => inc.vesselId === mergedVessel.vesselId || inc.vesselId === mergedVessel.id || inc.vesselName === mergedVessel.name);

            if (activeAlert && activeAlert.risk > score) {
              score = activeAlert.risk;
              if (activeAlert.behaviours && activeAlert.behaviours.length) {
                reasons = Array.from(new Set([...reasons, ...activeAlert.behaviours]));
              }
            }
            if (activeInc && activeInc.risk > score) {
              score = activeInc.risk;
            }

            const threatType = classifyThreat({ ...mergedVessel, lat, lng }, score);
            const level = score > 70 ? "HIGH" : score > 30 ? "MEDIUM" : "LOW";

            return {
              ...mergedVessel,
              id: mergedVessel.vesselId || mergedVessel.id,
              vesselId: mergedVessel.vesselId || mergedVessel.id,
              lat,
              lng,
              riskScore: score,
              risk: score,
              level,
              threatType,
              reasons,
              behaviours: reasons
            };
          });

          const rawUsers = (parsed.users && parsed.users.length) ? parsed.users : (seed.users || []);
          const sanitizedUsers = rawUsers.map(u => {
            const seedU = (seed.users || []).find(su => su.id === u.id) || {};
            return {
              ...seedU,
              ...u,
              lat: u.lat ?? seedU.lat ?? (u.role === "field" ? 17.68 : undefined),
              lng: u.lng ?? seedU.lng ?? (u.role === "field" ? 83.38 : undefined)
            };
          });

          return {
            ...seed,
            ...parsed,
            vessels: sanitizedVessels,
            users: sanitizedUsers,
            threatRules: (parsed.threatRules && parsed.threatRules.length >= 7) ? parsed.threatRules : canonicalRules,
            highRiskAreas: seed.highRiskAreas || parsed.highRiskAreas || [],
            notifications: Array.isArray(parsed.notifications) ? parsed.notifications : (seed.notifications || []),
            alerts: activeAlerts,
            simRunning: true
          };
        }
      } catch (e) {
        console.warn("Using default seed dataset:", e);
      }
      return { ...seed, session: null, simRunning: true, tick: 280, notifications: Array.isArray(seed.notifications) ? seed.notifications : [], alerts: seed.alerts || [] };
    }

    saveState() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch (e) {
        console.error("Storage save failed:", e);
      }
    }

    getState() {
      return this.state;
    }

    subscribe(fn) {
      this.listeners.add(fn);
      return () => this.listeners.delete(fn);
    }

    notify() {
      this.listeners.forEach((fn) => {
        try {
          fn(this.state);
        } catch (e) {
          console.error(e);
        }
      });
    }

    setState(updater) {
      if (typeof updater === "function") {
        this.state = updater(this.state);
      } else {
        this.state = { ...this.state, ...updater };
      }
      this.saveState();
      this.notify();
    }

    /* ---------------- Authentication ---------------- */
    login(username, password, role) {
      const u = this.state.users.find(
        (user) => user.username.toLowerCase() === username.trim().toLowerCase()
      );
      if (!u || u.password !== password) {
        return { ok: false, error: "Invalid username or password." };
      }
      if (role && u.role !== role) {
        return { ok: false, error: "Selected role does not match account." };
      }
      this.setState((s) => ({
        ...s,
        session: {
          userId: u.id,
          name: u.name,
          role: u.role,
          loginAt: new Date().toISOString()
        }
      }));
      this.logAudit("Auth", `User ${u.name} signed in as ${u.role}`);
      return { ok: true, role: u.role };
    }

    logout() {
      this.setState((s) => ({ ...s, session: null }));
      window.location.href = "login.html";
    }

    /* ---------------- Administrator Actions ---------------- */
    addUser(name, username, role, region) {
      const newUser = {
        id: "usr-" + Math.floor(Math.random() * 9000 + 1000),
        name,
        username,
        password: "password123",
        role,
        region,
        status: "active",
        lastLogin: new Date().toISOString(),
        availability: role === "field" ? "available" : undefined,
        lat: role === "field" ? 17.68 : undefined,
        lng: role === "field" ? 83.38 : undefined
      };
      this.setState((s) => ({
        ...s,
        users: [...s.users, newUser]
      }));
      this.logAudit("User Management", `Created operator account for ${name} (${role})`);
      if (window.MS_UI) window.MS_UI.showToast(`User ${name} created successfully.`);
    }

    updateUser(userId, fields) {
      this.setState((s) => ({
        ...s,
        users: s.users.map((u) => (u.id === userId ? { ...u, ...fields } : u))
      }));
      const u = this.state.users.find((x) => x.id === userId);
      this.logAudit("User Management", `Updated account details for ${u?.name || userId}`);
      if (window.MS_UI) window.MS_UI.showToast(`User account updated.`);
    }

    toggleUserStatus(userId) {
      let nextStatus = "active";
      this.setState((s) => {
        const updatedUsers = s.users.map((u) => {
          if (u.id === userId) {
            nextStatus = u.status === "active" ? "disabled" : "active";
            return { ...u, status: nextStatus };
          }
          return u;
        });

        const updatedAlerts = (s.alerts || []).map((a) =>
          nextStatus === "disabled" && a.assignedTo === userId
            ? { ...a, status: "New", assignedTo: null }
            : a
        );

        const updatedIncidents = (s.incidents || []).map((i) =>
          nextStatus === "disabled" && i.assignedTo === userId
            ? { ...i, assignedTo: null, missionStatus: "Unassigned" }
            : i
        );

        return {
          ...s,
          users: updatedUsers,
          alerts: updatedAlerts,
          incidents: updatedIncidents
        };
      });
      const u = this.state.users.find((x) => x.id === userId);
      this.logAudit("User Management", `Changed ${u?.name || userId} status to ${nextStatus}`);
      if (window.MS_UI) window.MS_UI.showToast(`User status set to ${nextStatus}.`);
    }

    deleteUser(userId) {
      const u = this.state.users.find((x) => x.id === userId);
      this.setState((s) => ({
        ...s,
        users: s.users.filter((user) => user.id !== userId),
        alerts: (s.alerts || []).map((a) =>
          a.assignedTo === userId
            ? { ...a, status: "New", assignedTo: null }
            : a
        ),
        incidents: (s.incidents || []).map((i) =>
          i.assignedTo === userId
            ? { ...i, assignedTo: null, missionStatus: "Unassigned" }
            : i
        )
      }));
      this.logAudit("User Management", `Deleted operator account for ${u?.name || userId}. Reset assigned alerts & missions.`);
      if (window.MS_UI) window.MS_UI.showToast(`User ${u?.name || userId} removed. Assigned alerts reset to NEW.`);
    }

    addZone(name, classification, lat, lng, radiusKm, description) {
      const [cLat, cLng] = clampToMaritime(parseFloat(lat), parseFloat(lng));
      const newZone = {
        id: "ZN-" + Math.floor(Math.random() * 9000 + 1000),
        name,
        classification,
        lat: cLat,
        lng: cLng,
        radiusKm: parseFloat(radiusKm) || 25,
        status: "active",
        description: description || "Operational coastal security sector."
      };
      this.setState((s) => ({
        ...s,
        zones: [...s.zones, newZone]
      }));
      this.logAudit("Security Zones", `Created security zone ${name} (${classification})`);
      if (window.MS_UI) window.MS_UI.showToast(`Security Zone ${name} established.`);
    }

    toggleZoneStatus(zoneId) {
      let nextStatus = "active";
      this.setState((s) => ({
        ...s,
        zones: s.zones.map((z) => {
          if (z.id === zoneId) {
            nextStatus = z.status === "active" ? "inactive" : "active";
            return { ...z, status: nextStatus };
          }
          return z;
        })
      }));
      const z = this.state.zones.find((x) => x.id === zoneId);
      this.logAudit("Security Zones", `Updated zone ${z?.name || zoneId} status to ${nextStatus}`);
      if (window.MS_UI) window.MS_UI.showToast(`Zone status: ${nextStatus}.`);
    }

    deleteZone(zoneId) {
      const z = this.state.zones.find((x) => x.id === zoneId);
      this.setState((s) => ({
        ...s,
        zones: s.zones.filter((zone) => zone.id !== zoneId)
      }));
      this.logAudit("Security Zones", `Removed security zone ${z?.name || zoneId}`);
      if (window.MS_UI) window.MS_UI.showToast(`Zone ${z?.name || zoneId} removed.`);
    }

    toggleRuleStatus(ruleId) {
      let nextStatus = "active";
      this.setState((s) => ({
        ...s,
        threatRules: (s.threatRules || []).map((r) => {
          if (r.id === ruleId) {
            nextStatus = r.status === "active" ? "disabled" : "active";
            return { ...r, status: nextStatus };
          }
          return r;
        })
      }));
      const r = this.state.threatRules.find((x) => x.id === ruleId);
      this.logAudit("Threat Rules", `Toggled rule ${r?.name || ruleId} to ${nextStatus}`);
      if (window.MS_UI) window.MS_UI.showToast(`Rule ${r?.name || ruleId}: ${nextStatus}.`);
    }

    updateRuleWeight(ruleId, weight) {
      const w = parseInt(weight, 10);
      this.setState((s) => ({
        ...s,
        threatRules: (s.threatRules || []).map((r) => (r.id === ruleId ? { ...r, weight: w } : r))
      }));
      const r = this.state.threatRules.find((x) => x.id === ruleId);
      this.logAudit("Threat Rules", `Updated weight for ${r?.name || ruleId} to +${w} pts`);
      if (window.MS_UI) window.MS_UI.showToast(`Rule weight updated to +${w} pts.`);
    }

    addThreatRule(name, description, weight) {
      const newRule = {
        id: "TR-" + String((this.state.threatRules || []).length + 1).padStart(2, "0"),
        name,
        description,
        weight: parseInt(weight, 10) || 20,
        status: "active"
      };
      this.setState((s) => ({
        ...s,
        threatRules: [...(s.threatRules || []), newRule]
      }));
      this.logAudit("Threat Rules", `Defined threat rule ${name} (+${newRule.weight} pts)`);
      if (window.MS_UI) window.MS_UI.showToast(`Threat rule ${name} created.`);
    }

    toggleSource(sourceId) {
      this.setState((s) => ({
        ...s,
        sources: s.sources.map((src) =>
          src.id === sourceId
            ? {
                ...src,
                status: src.status === "connected" ? "disconnected" : "connected",
                lastSync: new Date().toISOString()
              }
            : src
        )
      }));
      const updated = this.state.sources.find((x) => x.id === sourceId);
      this.logAudit("Data Sources", `Updated data source ${updated?.name} status to ${updated?.status}`);
      if (window.MS_UI) window.MS_UI.showToast(`Source ${updated?.name} status: ${updated?.status}`);
    }

    /* ---------------- Notification Hub ---------------- */
    addNotification(title, message, type = "threat", severity = "high", meta = {}) {
      const newNotif = {
        id: "NOTIF-" + Math.floor(Math.random() * 90000 + 10000),
        title,
        message,
        type, // 'threat', 'mission', 'system', 'operational'
        severity, // 'critical', 'high', 'info'
        read: false,
        ts: new Date().toISOString(),
        ...meta
      };

      this.setState((s) => ({
        ...s,
        notifications: [newNotif, ...(s.notifications || [])].slice(0, 40)
      }));

      // Audio chime disabled per user preference
    }

    markNotificationRead(notifId) {
      this.setState((s) => ({
        ...s,
        notifications: (s.notifications || []).map((n) =>
          n.id === notifId ? { ...n, read: true } : n
        )
      }));
    }

    markAllNotificationsRead() {
      this.setState((s) => ({
        ...s,
        notifications: (s.notifications || []).map((n) => ({ ...n, read: true }))
      }));
      if (window.MS_UI) window.MS_UI.showToast("All notifications marked as read.");
    }

    clearNotifications(role) {
      const targetRole = role || (window.location.pathname.includes("admin") ? "administrator" : window.location.pathname.includes("field") ? "field" : "command");
      this.setState((s) => ({
        ...s,
        notifications: (s.notifications || []).filter((n) => {
          if (!n.targetRoles || !Array.isArray(n.targetRoles)) return false;
          return !n.targetRoles.includes(targetRole);
        })
      }));
      this.saveState();
      if (window.MS_UI) window.MS_UI.showToast("Notifications cleared.");
    }

    /* ---------------- Audit Logging ---------------- */
    logAudit(module, action, status = "success") {
      const user = this.state.session?.name || "System Engine";
      const entry = {
        id: "AUD-" + Math.floor(Math.random() * 9000 + 1000),
        ts: new Date().toISOString(),
        user,
        module,
        action,
        status
      };
      this.setState((s) => ({
        ...s,
        audit: [entry, ...(s.audit || [])].slice(0, 100)
      }));
    }

    /* ---------------- Alerts & Incidents ---------------- */
    confirmAlert(alertId, assignedOfficerId = "usr-field-1") {
      const alert = this.state.alerts.find((a) => a.id === alertId);
      if (!alert) return;
      const officer = this.state.users.find((u) => u.id === assignedOfficerId);
      const newInc = {
        id: "INC-" + Math.floor(Math.random() * 9000 + 1000),
        title: `${alert.threatType} — ${alert.vesselName}`,
        category: "Maritime Security Intrusion",
        riskLevel: alert.severity,
        risk: alert.risk,
        status: "In Progress",
        vesselName: alert.vesselName,
        vesselId: alert.vesselId,
        detectedAt: alert.ts,
        assignedTo: assignedOfficerId,
        deadline: new Date(Date.now() + 60 * 60000).toISOString(),
        lat: alert.lat,
        lng: alert.lng,
        description: `Confirmed incident from alert ${alert.id}. Zone: ${alert.zoneName}.`,
        missionStatus: "Assigned & Dispatched",
        timeline: [
          {
            ts: new Date().toISOString(),
            actor: this.state.session?.name || "Command Officer",
            status: "Confirmed",
            note: `Alert confirmed. Dispatched to ${officer?.name || "Field Unit"}.`
          }
        ]
      };
      this.setState((s) => ({
        ...s,
        alerts: s.alerts.map((a) => (a.id === alertId || a.vesselId === alert.vesselId ? { ...a, status: "Assigned", assignedTo: assignedOfficerId } : a)),
        incidents: [newInc, ...s.incidents],
        users: s.users.map((u) => (u.id === assignedOfficerId ? { ...u, availability: "on-mission" } : u))
      }));
      this.logAudit("Alerts", `Confirmed alert ${alertId} and dispatched ${officer?.name || assignedOfficerId} for ${newInc.id}`);
      this.addNotification(
        "🎯 Mission Dispatched: " + newInc.id,
        `Dispatched to ${officer?.name || 'Field Unit'} for ${alert.vesselName} (${alert.threatType}).`,
        "mission",
        "high",
        { targetRoles: ["field", "command"], incidentId: newInc.id, vesselId: alert.vesselId }
      );
      if (window.MS_UI) window.MS_UI.showToast(`Alert confirmed. ${newInc.id} dispatched to ${officer?.name || "field"}.`);
    }

    createIncident(title, category, vesselName, riskLevel, risk, assignedOfficerId, lat, lng, description) {
      const officer = this.state.users.find((u) => u.id === assignedOfficerId);
      const [cLat, cLng] = clampToMaritime(parseFloat(lat), parseFloat(lng));
      const newInc = {
        id: "INC-" + Math.floor(Math.random() * 9000 + 1000),
        title,
        category: category || "Maritime Security Intrusion",
        riskLevel: riskLevel || "High",
        risk: parseInt(risk, 10) || 75,
        status: "In Progress",
        vesselName: vesselName || "Unknown Contact",
        vesselId: "VS-" + Math.floor(Math.random() * 900 + 100),
        detectedAt: new Date().toISOString(),
        assignedTo: assignedOfficerId,
        deadline: new Date(Date.now() + 90 * 60000).toISOString(),
        lat: cLat,
        lng: cLng,
        description: description || "Tactical interception and vessel boarding authorization.",
        missionStatus: "Assigned & Dispatched",
        timeline: [
          {
            ts: new Date().toISOString(),
            actor: this.state.session?.name || "Command Officer",
            status: "Created",
            note: `Incident created and dispatched to ${officer?.name || "Field Officer"}.`
          }
        ]
      };
      this.setState((s) => ({
        ...s,
        incidents: [newInc, ...s.incidents],
        users: s.users.map((u) => (u.id === assignedOfficerId ? { ...u, availability: "on-mission" } : u))
      }));
      this.logAudit("Incidents", `Command created incident ${newInc.id} and dispatched to ${officer?.name || assignedOfficerId}`);
      this.addNotification(
        "🎯 Tactical Incident Created: " + newInc.id,
        `${title} assigned to ${officer?.name || 'Field Unit'}.`,
        "mission",
        risk >= 80 ? "critical" : "high",
        { targetRoles: ["field", "command"], incidentId: newInc.id }
      );
      if (window.MS_UI) window.MS_UI.showToast(`Incident ${newInc.id} created & assigned.`);
    }

    escalateVesselToIncident(vesselId, assignedOfficerId = "usr-field-1") {
      const v = this.state.vessels.find((x) => x.id === vesselId || x.vesselId === vesselId || x.name === vesselId);
      if (!v) return;
      const officer = this.state.users.find((u) => u.id === assignedOfficerId);
      const newInc = {
        id: "INC-" + Math.floor(Math.random() * 9000 + 1000),
        title: `Tactical Intercept — ${v.name} (${v.type})`,
        category: "Hostile Contact / EEZ Breach",
        riskLevel: v.risk >= 80 ? "Critical" : "High",
        risk: v.risk,
        status: "In Progress",
        vesselName: v.name,
        vesselId: v.id,
        detectedAt: new Date().toISOString(),
        assignedTo: assignedOfficerId,
        deadline: new Date(Date.now() + 60 * 60000).toISOString(),
        lat: v.lat,
        lng: v.lng,
        description: `Direct command escalation for ${v.name}. Violated rules: ${(v.behaviours || []).join(", ") || "Elevated threat score"}.`,
        missionStatus: "Assigned & Dispatched",
        timeline: [
          {
            ts: new Date().toISOString(),
            actor: this.state.session?.name || "Tactical Command",
            status: "Escalated to Incident",
            note: `Direct operational order issued. Interception dispatched to ${officer?.name || "Field Unit"}.`
          }
        ]
      };
      this.setState((s) => ({
        ...s,
        alerts: (s.alerts || []).map((a) =>
          a.vesselId === v.id || a.vesselId === v.vesselId || a.vesselName === v.name
            ? { ...a, status: "Assigned", assignedTo: assignedOfficerId }
            : a
        ),
        incidents: [newInc, ...s.incidents],
        users: s.users.map((u) => (u.id === assignedOfficerId ? { ...u, availability: "on-mission" } : u))
      }));
      this.logAudit("Threat Intelligence", `Escalated threat ${v.name} (${v.id}) to incident ${newInc.id}`);
      this.addNotification(
        "🚨 Direct Intercept Order: " + v.name,
        `Command escalated ${v.name} (Risk ${v.risk}/100) to Incident ${newInc.id}.`,
        "threat",
        "critical",
        { targetRoles: ["field", "command"], incidentId: newInc.id, vesselId: v.id }
      );
      if (window.MS_UI) window.MS_UI.showToast(`Threat escalated! Incident ${newInc.id} dispatched to ${officer?.name || "unit"}.`);
    }

    assignVesselToFieldOfficer(vesselId, assignedOfficerId = "usr-field-1") {
      const v = this.state.vessels.find((x) => x.id === vesselId || x.vesselId === vesselId || x.name === vesselId);
      if (!v) return;
      const officer = this.state.users.find((u) => u.id === assignedOfficerId) || this.state.users.find((u) => u.role === "field");
      const existingInc = this.state.incidents.find((i) => (i.vesselId === v.id || i.vesselId === v.vesselId || i.vesselName === v.name) && i.status !== "Closed");

      if (existingInc) {
        this.setState((s) => ({
          ...s,
          alerts: (s.alerts || []).map((a) =>
            a.vesselId === v.id || a.vesselId === v.vesselId || a.vesselName === v.name
              ? { ...a, status: "Assigned", assignedTo: officer?.id || assignedOfficerId }
              : a
          ),
          incidents: s.incidents.map((i) =>
            i.id === existingInc.id
              ? {
                  ...i,
                  assignedTo: officer?.id || assignedOfficerId,
                  status: "In Progress",
                  missionStatus: "On-Mission",
                  timeline: [
                    ...(i.timeline || []),
                    {
                      ts: new Date().toISOString(),
                      actor: this.state.session?.name || "Command Officer",
                      status: "Assigned & Dispatched",
                      note: `Mission assigned to ${officer?.name || "Field Officer"}.`
                    }
                  ]
                }
              : i
          ),
          users: s.users.map((u) => (u.id === (officer?.id || assignedOfficerId) ? { ...u, availability: "on-mission" } : u))
        }));

        this.addNotification(
          "🎯 New Mission Assigned: " + v.name,
          `Command Officer assigned mission ${existingInc.id} (${v.name}) to ${officer?.name || 'Field Officer'}.`,
          "mission",
          "high",
          { targetRoles: ["field", "command"], incidentId: existingInc.id, vesselId: v.id }
        );
        if (window.MS_UI) window.MS_UI.showToast(`Mission assigned to ${officer?.name || "Field Officer"} (Active Mission).`);
      } else {
        this.escalateVesselToIncident(v.id, officer?.id || assignedOfficerId);
      }
    }

    sendAisHail(vesselId) {
      const v = this.state.vessels.find((x) => x.id === vesselId);
      if (!v) return;
      this.logAudit("Comms", `Sent VHF Ch 16 / AIS Safety Hail to ${v.name} (MMSI: ${v.mmsi})`);
      this.addNotification(
        "📡 VHF / AIS Warning Transmitted",
        `Official safety hail sent to ${v.name} (MMSI: ${v.mmsi}, Callsign: ${v.callsign || 'N/A'}).`,
        "system",
        "info",
        { targetRoles: ["command", "administrator"], vesselId: v.id }
      );
      if (window.MS_UI) window.MS_UI.showToast(`📡 AIS Challenge transmitted to ${v.name} (Ch 16 / DSC).`);
    }

    rejectAlert(alertId) {
      this.setState((s) => ({
        ...s,
        alerts: s.alerts.map((a) => (a.id === alertId ? { ...a, status: "False Alarm" } : a))
      }));
      this.logAudit("Alerts", `Dismissed alert ${alertId} as false alarm`);
      if (window.MS_UI) window.MS_UI.showToast("Alert marked as False Alarm");
    }

    updateIncidentStatus(incidentId, status, note) {
      const actor = this.state.session?.name || "Field Officer";
      this.setState((s) => ({
        ...s,
        incidents: s.incidents.map((i) =>
          i.id === incidentId
            ? {
                ...i,
                missionStatus: status,
                timeline: [
                  ...i.timeline,
                  { ts: new Date().toISOString(), actor, status, note: note || `Status updated to ${status}` }
                ]
              }
            : i
        )
      }));
      this.logAudit("Incidents", `Officer updated incident ${incidentId} to ${status}`);
      this.addNotification(
        `⚡ Status: ${status} (${incidentId})`,
        `${actor}: ${note || 'Updated tactical execution stage.'}`,
        "mission",
        status === "Request Interception" ? "critical" : "high",
        { incidentId }
      );
      if (window.MS_UI) window.MS_UI.showToast(`Incident status: ${status}`);
    }

    addIncidentNote(incidentId, noteText) {
      const actor = this.state.session?.name || "Field Officer";
      this.setState((s) => ({
        ...s,
        incidents: s.incidents.map((i) =>
          i.id === incidentId
            ? {
                ...i,
                timeline: [
                  ...i.timeline,
                  { ts: new Date().toISOString(), actor, status: "Field Observation", note: noteText }
                ]
              }
            : i
        )
      }));
      this.logAudit("Incidents", `Field note logged for ${incidentId}: "${noteText}"`);
      if (window.MS_UI) window.MS_UI.showToast("Field observation logged to timeline.");
    }

    addIncidentEvidence(incidentId, evidenceObj) {
      this.setState((s) => ({
        ...s,
        incidents: s.incidents.map((i) =>
          i.id === incidentId
            ? {
                ...i,
                evidence: [...(i.evidence || []), evidenceObj],
                timeline: [
                  ...i.timeline,
                  {
                    ts: new Date().toISOString(),
                    actor: this.state.session?.name || "Field Officer",
                    status: "Evidence Uploaded",
                    note: `Attached: ${evidenceObj.name} (${evidenceObj.type})`
                  }
                ]
              }
            : i
        )
      }));
      this.logAudit("Incidents", `Evidence attached to ${incidentId}: ${evidenceObj.name}`);
      this.addNotification(
        "📸 New Evidence Uploaded",
        `Field attached ${evidenceObj.name} (${evidenceObj.type}) to ${incidentId}.`,
        "mission",
        "info",
        { incidentId }
      );
      if (window.MS_UI) window.MS_UI.showToast(`Evidence ${evidenceObj.name} saved.`);
    }

    rejectIncident(incidentId, reason = "Operational conflict / vessel out of intercept range.") {
      const actor = this.state.session?.name || "Field Officer";
      const inc = this.state.incidents.find((i) => i.id === incidentId);
      this.setState((s) => ({
        ...s,
        incidents: s.incidents.map((i) =>
          i.id === incidentId
            ? {
                ...i,
                status: "Investigating",
                missionStatus: "Declined by Unit",
                assignedTo: undefined,
                timeline: [
                  ...i.timeline,
                  { ts: new Date().toISOString(), actor, status: "Declined", note: `Assignment rejected: ${reason}` }
                ]
              }
            : i
        ),
        users: s.users.map((u) => (u.id === inc?.assignedTo ? { ...u, availability: "available" } : u))
      }));
      this.logAudit("Incidents", `Officer declined assignment for ${incidentId}: ${reason}`);
      this.addNotification(
        "⚠️ Mission Assignment Declined",
        `Officer declined ${incidentId}: "${reason}"`,
        "mission",
        "high",
        { incidentId }
      );
      if (window.MS_UI) window.MS_UI.showToast(`Mission assignment declined.`);
    }

    simulateOfficerMovement(officerId = "usr-field-1", targetIncidentId) {
      const inc = this.state.incidents.find((i) =>
        targetIncidentId ? i.id === targetIncidentId : i.status !== "Closed" && i.assignedTo === officerId
      );
      if (!inc) {
        if (window.MS_UI) window.MS_UI.showToast("No active mission target for movement simulation.");
        return;
      }

      this.setState((s) => ({
        ...s,
        users: s.users.map((u) => {
          if (u.id === officerId) {
            const currentLat = u.lat || 17.68;
            const currentLng = u.lng || 83.38;
            const rawLat = currentLat + (inc.lat - currentLat) * 0.35;
            const rawLng = currentLng + (inc.lng - currentLng) * 0.35;
            const [cLat, cLng] = clampToMaritime(rawLat, rawLng);
            return {
              ...u,
              lat: cLat,
              lng: cLng,
              availability: "on-mission"
            };
          }
          return u;
        })
      }));
      if (window.MS_UI) window.MS_UI.showToast("⚡ Interceptor craft underway toward target contact...");
    }

    closeIncident(incidentId, findings = "Mission completed successfully.") {
      const actor = this.state.session?.name || "Command Officer";
      const inc = this.state.incidents.find((i) => i.id === incidentId);
      this.setState((s) => ({
        ...s,
        incidents: s.incidents.map((i) =>
          i.id === incidentId
            ? {
                ...i,
                status: "Closed",
                missionStatus: "Completed",
                timeline: [
                  ...i.timeline,
                  { ts: new Date().toISOString(), actor, status: "Closed", note: findings }
                ]
              }
            : i
        ),
        users: s.users.map((u) => (u.id === inc?.assignedTo ? { ...u, availability: "available" } : u))
      }));
      this.logAudit("Incidents", `Closed & archived incident ${incidentId}`);
      this.addNotification(
        "✓ Incident Resolved & Archived",
        `${incidentId} closed: "${findings}"`,
        "mission",
        "info",
        { targetRoles: ["field", "administrator"], incidentId }
      );
      if (window.MS_UI) window.MS_UI.showToast(`Incident ${incidentId} closed & archived.`);
    }

    /* ---------------- Live Simulation Heartbeat ---------------- */
    startSimulation() {
      if (this.timer) clearInterval(this.timer);
      this.timer = setInterval(() => {
        if (!this.state.simRunning) return;
        this.tick();
      }, 3500);
    }

    toggleSimulation() {
      this.setState((s) => ({ ...s, simRunning: !s.simRunning }));
      if (window.MS_UI) {
        window.MS_UI.showToast(this.state.simRunning ? "Live Monitoring Resumed" : "Live Simulation Paused");
      }
    }

    tick() {
      this.setState((s) => {
        const nextTick = (s.tick || 280) + 1;
        const newAlerts = [];

        // Drift vessels along maritime lanes
        const updatedVessels = (s.vessels || []).map((v) => {
          const drift = 0.006 + Math.random() * 0.012;
          let rad = (v.course * Math.PI) / 180;
          let nextLat = v.lat + Math.cos(rad) * drift * (v.speed / 10);
          let nextLng = v.lng + Math.sin(rad) * drift * (v.speed / 10);
          let nextCourse = v.course;

          // Strictly geofence in Bay of Bengal water
          if (!isPointInMaritimeArea(nextLat, nextLng)) {
            // Steer vessel back into open sea
            nextCourse = Math.round((v.course + 135 + Math.random() * 60) % 360);
            const [cLat, cLng] = clampToMaritime(nextLat, nextLng);
            nextLat = cLat;
            nextLng = cLng;
          } else {
            nextCourse = Math.round((v.course + (Math.random() - 0.5) * 6 + 360) % 360);
          }

          const speed = Math.max(0.2, Math.round((v.speed + (Math.random() - 0.5) * 0.5) * 10) / 10);

          // Check if in restricted zone
          let insideRestricted = false;
          let activeZoneName = "Open water";
          for (const z of s.zones || []) {
            const dist = Math.hypot(nextLat - z.lat, nextLng - z.lng) * 111;
            if (dist <= z.radiusKm) {
              activeZoneName = z.name;
              if (z.classification === "Critical" || z.classification === "Restricted" || z.classification === "High Risk") {
                insideRestricted = true;
              }
            }
          }

          // Check if near high risk area
          let nearHRA = false;
          for (const hra of s.highRiskAreas || []) {
            const dist = Math.hypot(nextLat - hra.lat, nextLng - hra.lng) * 111;
            if (dist <= (hra.radiusKm || 40)) {
              nearHRA = true;
            }
          }

          // Dynamic Risk & Threat Pipeline Evaluation
          const calcRisk = getRiskEngine();
          const classifyThreat = getThreatEngine();

          const candidate = {
            ...v,
            lat: Math.round(nextLat * 1000) / 1000,
            lng: Math.round(nextLng * 1000) / 1000,
            speed,
            heading: nextCourse,
            course: nextCourse,
            inRestrictedZone: insideRestricted || !!v.inRestrictedZone,
            nearHighRiskArea: nearHRA || !!v.nearHighRiskArea,
            aisOff: v.aisOff ?? (v.ais === "lost")
          };

          const { score, reasons } = calcRisk(candidate, this.state.threatRules);
          const threatType = classifyThreat(candidate, score);
          const level = score > 70 ? "HIGH" : score > 30 ? "MEDIUM" : "LOW";

          // Alert generation for high threat vessels (throttled to 4-5 critical threats max daily)
          const existingForVessel = (s.alerts || []).some(a => (a.vesselId === (v.vesselId || v.id) || a.vesselName === v.name) && a.status === "New");
          const criticalCount = (s.alerts || []).filter(a => a.severity === "Critical" && a.status !== "Resolved" && a.status !== "False Alarm").length;

          if (score >= 75 && !existingForVessel && Math.random() > 0.995) {
            const isCritical = score >= 80 && criticalCount < 5;
            newAlerts.push({
              id: "AL-" + Math.floor(Math.random() * 9000 + 1000),
              ts: new Date().toISOString(),
              vesselId: v.vesselId || v.id,
              vesselName: v.name,
              threatType: threatType !== "Normal" ? threatType : "Restricted Zone Intrusion",
              risk: score,
              severity: isCritical ? "Critical" : "High",
              zoneName: activeZoneName,
              status: "New",
              lat: Math.round(nextLat * 1000) / 1000,
              lng: Math.round(nextLng * 1000) / 1000,
              behaviours: reasons
            });
          }

          const trail = [
            ...(v.trail || []).slice(-12),
            [Math.round(nextLat * 1000) / 1000, Math.round(nextLng * 1000) / 1000]
          ];

          return {
            ...v,
            id: v.vesselId || v.id,
            vesselId: v.vesselId || v.id,
            lat: Math.round(nextLat * 1000) / 1000,
            lng: Math.round(nextLng * 1000) / 1000,
            speed,
            course: nextCourse,
            heading: nextCourse,
            riskScore: score,
            risk: score,
            level,
            threatType,
            reasons,
            behaviours: reasons,
            trail,
            lastUpdate: new Date().toISOString()
          };
        });

        // Weather subtle fluctuation
        const weather = {
          ...s.weather,
          windKts: Math.max(6, Math.round(s.weather.windKts + (Math.random() - 0.5) * 1.5)),
          updatedAt: new Date().toISOString()
        };

        if (newAlerts.length > 0) {
          newAlerts.forEach((a) => {
            this.addNotification(
              `🚨 Threat Alert: ${a.vesselName}`,
              `${a.threatType} detected near ${a.zoneName} (Threat Score: ${a.risk}/100).`,
              "threat",
              a.severity === "Critical" ? "critical" : "high",
              { targetRoles: ["command", "field"], vesselId: a.vesselId }
            );
          });
        }

        const alerts = newAlerts.length ? [...newAlerts, ...(s.alerts || [])].slice(0, 10) : s.alerts;

        return {
          ...s,
          tick: nextTick,
          vessels: updatedVessels,
          alerts,
          weather
        };
      });
    }
  }

  window.msStore = new MsStore();
})();
