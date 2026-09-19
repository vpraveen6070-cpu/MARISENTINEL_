/**
 * MARISENTINEL — Vanilla JS Central State Store & Simulation Engine
 * Incorporates strict maritime geofencing & real-time threat telemetry.
 */

(function () {
  const STORAGE_KEY = "marisentinel_state_v18"; // Synchronized 5 compound explainability threat rules

  /* ---------------- Maritime Geofencing Engine (Bay of Bengal Open Waters Only) ---------------- */
  function getWestCoastMinLng(lat) {
    if (lat <= 7.8) return 79.5;
    if (lat <= 9.8) return 81.8; // Avoid Sri Lanka land mass (79.5°E to 81.8°E)
    if (lat <= 11.0) return 80.1; // Tamil Nadu coast
    if (lat <= 13.5) return 80.3; // Chennai / Puducherry coast
    if (lat <= 15.5) return 80.4; // Nellore / AP coast
    if (lat <= 17.0) return 82.3; // Machilipatnam / Kakinada coast
    if (lat <= 18.2) return 83.3; // Visakhapatnam coast
    if (lat <= 19.5) return 85.0; // Gopalpur / Puri coast
    if (lat <= 20.8) return 86.8; // Paradip / Dhamra coast
    return 87.2;                  // West Bengal / Digha coast
  }

  function getEastCoastMaxLng(lat) {
    if (lat >= 20.5) return 90.8; // Avoid Bangladesh / Chittagong land mass
    if (lat >= 19.0) return 92.5; // Avoid Myanmar Northern coast
    if (lat >= 15.0) return 93.2; // Avoid Myanmar Central coast
    if (lat >= 10.0) return 93.8; // Avoid Andaman Sea east land
    return 94.2;                  // South Andaman / Nicobar Sea
  }

  function isPointInMaritimeArea(lat, lng) {
    if (typeof lat !== "number" || typeof lng !== "number" || isNaN(lat) || isNaN(lng)) return false;
    // Strict Latitude limits for Bay of Bengal Grid (7.8°N to 21.2°N)
    if (lat < 7.8 || lat > 21.2) return false;

    // Sri Lanka Land Exclude Box (7.8°N to 9.8°N, 79.5°E to 81.8°E)
    if (lat >= 7.8 && lat <= 9.8 && lng >= 79.5 && lng <= 81.8) return false;

    const minLng = getWestCoastMinLng(lat);
    const maxLng = getEastCoastMaxLng(lat);

    return lng >= minLng && lng <= maxLng;
  }

  function clampToMaritime(lat, lng) {
    let safeLat = Math.min(21.2, Math.max(7.8, lat || 17.5));
    
    // If in Sri Lanka box, push out into open Bay of Bengal (east of Sri Lanka)
    if (safeLat >= 7.8 && safeLat <= 9.8 && (lng || 83.0) < 81.8) {
      return [Math.round(safeLat * 1000) / 1000, 82.2];
    }

    const minLng = getWestCoastMinLng(safeLat);
    const maxLng = getEastCoastMaxLng(safeLat);
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
    const fusionService = (typeof window !== "undefined" && window.MS_FUSION) ? window.MS_FUSION : null;

    // Immediately map with baseline/cached data so page rendering and authentication are instant (< 50ms)
    const initialVessels = raw.map((v) => {
      const fused = fusionService ? fusionService.getCached(v.vesselId || v.id) : null;
      const mlPred = fused ? fused.mlPrediction : null;
      const ruleInsights = fused ? fused.ruleInsights : null;
      
      const score = mlPred ? mlPred.riskScore : (v.riskScore ?? (v.risk ?? 15));
      const level = mlPred ? mlPred.level : (score >= 70 ? "HIGH" : score >= 35 ? "MEDIUM" : "LOW");
      const threatType = mlPred ? mlPred.threatType : (v.threatType || "Normal Transit");
      const confidence = mlPred ? mlPred.confidence : (v.confidence || (level === "HIGH" ? 92.4 : 96.0));
      const contributingFeatures = (mlPred && mlPred.contributingFeatures) || v.contributingFeatures || [];
      const reasons = (ruleInsights && ruleInsights.triggeredRules && ruleInsights.triggeredRules.length)
        ? ruleInsights.triggeredRules
        : (v.reasons || v.behaviours || []);
      const ruleScore = (ruleInsights && typeof ruleInsights.ruleScore === "number")
        ? ruleInsights.ruleScore
        : score;

      return {
        ...v,
        id: v.vesselId || v.id,
        vesselId: v.vesselId || v.id,
        riskScore: score,
        risk: score,
        level,
        threatType,
        confidence,
        contributingFeatures,
        ruleScore,
        reasons,
        behaviours: reasons,
        course: v.heading ?? v.course ?? 0,
        heading: v.heading ?? v.course ?? 0,
        ais: v.aisOff ? "lost" : "active",
        trail: v.trail || [[v.lat, v.lng]],
        lastUpdate: new Date().toISOString()
      };
    });

    // Run ML evaluation asynchronously in the background so it NEVER blocks login or page rendering
    if (fusionService && fusionService.evaluateVesselsBatch) {
      setTimeout(async () => {
        try {
          const evaluated = await fusionService.evaluateVesselsBatch(raw);
          if (evaluated && evaluated.length && window.msStore) {
            window.msStore.setState((s) => {
              const currentVessels = s.vessels || [];
              const updated = currentVessels.map((v, idx) => {
                const fused = evaluated[idx] || (fusionService ? fusionService.getCached(v.vesselId || v.id) : null);
                if (!fused) return v;
                const mlPred = fused.mlPrediction;
                const ruleInsights = fused.ruleInsights;
                const score = mlPred ? mlPred.riskScore : v.riskScore;
                const level = mlPred ? mlPred.level : (score >= 70 ? "HIGH" : score >= 35 ? "MEDIUM" : "LOW");
                return {
                  ...v,
                  riskScore: score,
                  risk: score,
                  level,
                  threatType: mlPred ? mlPred.threatType : v.threatType,
                  confidence: mlPred ? mlPred.confidence : v.confidence,
                  contributingFeatures: (mlPred && mlPred.contributingFeatures) || v.contributingFeatures || [],
                  ruleScore: (ruleInsights && typeof ruleInsights.ruleScore === "number") ? ruleInsights.ruleScore : v.ruleScore,
                  reasons: (ruleInsights && ruleInsights.triggeredRules && ruleInsights.triggeredRules.length) ? ruleInsights.triggeredRules : v.reasons
                };
              });
              return { ...s, vessels: updated };
            });
          }
        } catch (e) {
          console.warn("[MsStore] Background ML sync fallback:", e);
        }
      }, 50);
    }

    return initialVessels;
  }

  class MsStore {
    constructor() {
      this.listeners = new Set();
      this.state = this.loadState();
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
        users: (seed.users && seed.users.length) ? seed.users : [
          { id: "usr-admin-1", username: "admin", password: "admin123", name: "Dr. Arvind Rao", role: "administrator", status: "active", region: "Visakhapatnam HQ" },
          { id: "usr-cmd-1", username: "command", password: "command123", name: "Cdr. Rajesh Menon", role: "command", status: "active", region: "Eastern Naval Command" },
          { id: "usr-field-1", username: "field", password: "field123", name: "Lt. Manoj Barua", role: "field", status: "active", region: "Visakhapatnam Squadron", availability: "on-mission", lat: 17.68, lng: 83.38 },
          { id: "usr-field-2", username: "kdas", password: "field123", name: "Officer K. Das", role: "field", status: "active", region: "Paradip Station", availability: "on-mission", lat: 20.25, lng: 86.70 },
          { id: "usr-field-3", username: "sneha", password: "field123", name: "Lt. Sneha Roy", role: "field", status: "active", region: "Chennai Base", availability: "available", lat: 13.10, lng: 80.30 }
        ],
        sources: seed.sources || [],
        weather: seed.weather || { windKts: 18, windDir: "NE", waveM: 2.1, visibilityKm: 8.5, seaState: "Moderate", advisory: "" },
        audit: seed.audit || [],
        threatRules: (seed.threatRules && seed.threatRules.length) ? seed.threatRules : [
          { id: "TR-01", name: "Dark Activity / Smuggling", condition: "AIS OFF + Restricted Zone", weight: 35, description: "Vessel transponder deactivated inside restricted maritime security perimeter", status: "active", role: "explanation" },
          { id: "TR-02", name: "Suspicious Loitering", condition: "Loitering + High Risk Area", weight: 25, description: "Vessel loitering or stationary near designated critical infrastructure or high-risk grid", status: "active", role: "explanation" },
          { id: "TR-03", name: "Illegal Fishing", condition: "Low Speed + Restricted Zone", weight: 20, description: "Slow speed (<5 kts) maneuvering inside marine conservation or restricted zone", status: "active", role: "explanation" },
          { id: "TR-04", name: "Border Intrusion", condition: "Route Deviation + Border", weight: 25, description: "Course trajectory diverging towards International Maritime Boundary Line", status: "active", role: "explanation" },
          { id: "TR-05", name: "Anomalous Behavior", condition: "speedChange > 30 AND nearHighRiskArea", weight: 20, description: "Sudden extreme velocity variation exceeding operational threshold while near high-risk area", status: "active", role: "explanation" }
        ],
        notifications: seed.notifications || [],
        session: null,
        simRunning: true,
        tick: 280
      };
    }

    async init() {
      try {
        const [vessels, zones, highRiskAreas, incidents, users, sources, weather, audit, notifications, alerts, threatRules] = await Promise.all([
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
          fetchDataset("alerts.json").catch(() => []),
          fetchDataset("threatRules.json").catch(() => [])
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
          alerts,
          threatRules: (threatRules && threatRules.length) ? threatRules : undefined
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
        localStorage.removeItem("marisentinel_state_v10");
        localStorage.removeItem("marisentinel_state_v11");
        localStorage.removeItem("marisentinel_state_v12");
        localStorage.removeItem("marisentinel_state_v13");
        localStorage.removeItem("marisentinel_state_v14");
        localStorage.removeItem("marisentinel_state_v15");
        localStorage.removeItem("marisentinel_state_v16");
        localStorage.removeItem("marisentinel_state_v17");
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          const rawVessels = parsed.vessels && parsed.vessels.length ? parsed.vessels : seed.vessels || [];

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

            // Continuous ML Model score from Random Forest (seedV / ML Fusion)
            const score = (typeof seedV.riskScore === "number")
              ? seedV.riskScore
              : (typeof v.riskScore === "number" ? v.riskScore : (typeof seedV.risk === "number" ? seedV.risk : 15));
            const level = seedV.level || v.level || (score >= 70 ? "HIGH" : score >= 35 ? "MEDIUM" : "LOW");
            const threatType = seedV.threatType || v.threatType || (level === "HIGH" ? "Dark Activity / Smuggling" : "Normal Transit");
            const confidence = typeof seedV.confidence === "number" ? seedV.confidence : (typeof v.confidence === "number" ? v.confidence : (level === "HIGH" ? 92.4 : 96.0));
            const contributingFeatures = seedV.contributingFeatures || v.contributingFeatures || [];
            const reasons = (seedV.reasons && seedV.reasons.length) ? seedV.reasons : (v.reasons || v.behaviours || []);

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
              confidence,
              contributingFeatures,
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
            threatRules: (parsed.threatRules && parsed.threatRules.length >= 5) ? parsed.threatRules : (seed.threatRules || canonicalRules),
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
      if (typeof window !== "undefined" && window.location && window.location.pathname.includes("login.html")) {
        return; // Skip simulation engine on login screen
      }
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

          // Strictly geofence in Bay of Bengal open water
          if (!isPointInMaritimeArea(nextLat, nextLng)) {
            const [cLat, cLng] = clampToMaritime(nextLat, nextLng);
            nextLat = cLat;
            nextLng = cLng;
            // Steer vessel back toward center of Bay of Bengal (16.5°N, 86.0°E)
            const dLat = 16.5 - nextLat;
            const dLng = 86.0 - nextLng;
            let targetAngle = (Math.atan2(dLng, dLat) * 180) / Math.PI;
            if (targetAngle < 0) targetAngle += 360;
            nextCourse = Math.round((targetAngle + (Math.random() - 0.5) * 30 + 360) % 360);
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

          // Dynamic Hybrid AI Pipeline Evaluation
          const ruleEngine = (typeof window !== "undefined" && window.MS_RULE_ENGINE) ? window.MS_RULE_ENGINE : null;
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

          // Heuristic rule explanation evaluation
          const ruleEval = ruleEngine ? ruleEngine.evaluateRules(candidate, this.state.threatRules) : { triggeredRules: [], ruleScore: 0 };
          const triggeredRules = ruleEval.triggeredRules || [];
          const ruleScore = ruleEval.ruleScore || 0;

          // ML output is the primary authority
          const mlScore = typeof v.riskScore === "number" ? v.riskScore : (v.risk ?? 15);
          const level = v.level || (mlScore >= 70 ? "HIGH" : mlScore >= 35 ? "MEDIUM" : "LOW");
          const threatType = v.threatType || (level === "HIGH" ? "Dark Activity / Smuggling" : level === "MEDIUM" ? "Suspicious Loitering" : "Normal Transit");
          const confidence = typeof v.confidence === "number" ? v.confidence : (level === "HIGH" ? 92.4 : 96.0);

          // STEP 5: Trigger alert ONLY based on ML level (level === "HIGH")
          if (level === "HIGH") {
            const existingAlertIndex = (s.alerts || []).findIndex(a => a.vesselId === (v.vesselId || v.id) || a.vesselName === v.name);
            const severity = mlScore >= 85 ? "Critical" : "High";
            const zoneText = activeZoneName !== "Open water" ? activeZoneName : `${v.destination || 'Bay of Bengal'} (${Math.round(nextLat * 100) / 100}°N, ${Math.round(nextLng * 100) / 100}°E)`;

            if (existingAlertIndex === -1) {
              const newAlert = {
                id: "AL-" + Math.floor(Math.random() * 9000 + 1000),
                ts: new Date().toISOString(),
                vesselId: v.vesselId || v.id,
                vesselName: v.name,
                threatType: threatType !== "Normal Transit" ? threatType : "High Risk Anomaly",
                risk: mlScore,
                level: "HIGH",
                confidence,
                severity,
                zoneName: zoneText,
                status: "New",
                lat: Math.round(nextLat * 1000) / 1000,
                lng: Math.round(nextLng * 1000) / 1000,
                behaviours: triggeredRules
              };
              newAlerts.push(newAlert);

              // Show alert popup / toast
              if (typeof window !== "undefined" && window.MS_UI && window.MS_UI.showToast) {
                window.MS_UI.showToast(`🚨 High Threat Alert: ${v.name} (${threatType} · ${mlScore}/100)`, "error");
              }

              // Log audit event
              if (Array.isArray(this.state.audit)) {
                this.state.audit.unshift({
                  id: "AUD-" + Math.floor(Math.random() * 90000 + 10000),
                  timestamp: new Date().toISOString(),
                  action: "THREAT_ALERT_TRIGGERED",
                  actor: "HYBRID_AI_ENGINE (Random Forest)",
                  details: `High threat alert generated for vessel ${v.name} (${v.vesselId || v.id}). Primary AI Score: ${mlScore}, Confidence: ${confidence}%. Heuristic triggers: ${triggeredRules.join("; ")}`
                });
              }
            }
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
            riskScore: mlScore,
            risk: mlScore,
            level,
            threatType,
            confidence,
            ruleScore,
            contributingFeatures: v.contributingFeatures || [],
            reasons: triggeredRules,
            behaviours: triggeredRules,
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

        // Merge newly detected alerts into existing alerts list cleanly
        const updatedAlerts = (s.alerts || [])
          .map(a => {
            const v = updatedVessels.find(x => x.id === a.vesselId || x.vesselId === a.vesselId || x.name === a.vesselName);
            if (v) {
              const score = typeof v.riskScore === "number" ? v.riskScore : (a.risk || 0);
              const severity = score >= 80 ? "Critical" : score >= 70 ? "High" : score >= 35 ? "Medium" : "Low";
              return {
                ...a,
                risk: score,
                severity,
                threatType: v.threatType || a.threatType,
                lat: v.lat,
                lng: v.lng,
                behaviours: v.reasons || a.behaviours
              };
            }
            return a;
          })
          .filter(a => (a.risk >= 35 && a.severity !== "Low"));

        const alerts = [...newAlerts, ...updatedAlerts];

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
