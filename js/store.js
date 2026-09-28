/**
 * MARISENTINEL — Vanilla JS Central State Store & Simulation Engine
 * Incorporates strict maritime geofencing & real-time threat telemetry.
 */

(function () {
  const STORAGE_KEY = "marisentinel_state_v21"; // Purely dynamic live incidents and notifications

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

  let _cachedDataPrefix = null;

  async function fetchDataset(filename) {
    // If a working prefix was previously determined, try it first
    if (_cachedDataPrefix) {
      try {
        const res = await fetch(`${_cachedDataPrefix}${filename}`);
        if (res.ok) return await res.json();
      } catch (_) {}
    }

    // Relative candidates first to work cleanly under GitHub Pages subpaths (e.g. /MARISENTINEL_/)
    const candidatePaths = [
      `data/${filename}`,
      `public/data/${filename}`,
      `./data/${filename}`,
      `./public/data/${filename}`,
      `/data/${filename}`,
      `/public/data/${filename}`
    ];

    for (const p of candidatePaths) {
      try {
        const res = await fetch(p);
        if (res.ok) {
          // Cache prefix (everything before filename) for instant next loads
          _cachedDataPrefix = p.substring(0, p.length - filename.length);
          return await res.json();
        }
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
      const threatType = mlPred ? mlPred.threatType : (v.threatType || (level === "HIGH" ? "Dark Activity / Smuggling" : level === "MEDIUM" ? "Suspicious Loitering" : "Normal Transit"));
      const confidence = mlPred ? mlPred.confidence : (v.confidence || (level === "HIGH" ? 92.4 : 96.0));
      const ruleEngine = (typeof window !== "undefined" && window.MS_RULE_ENGINE) ? window.MS_RULE_ENGINE : null;
      const ruleEval = ruleEngine ? ruleEngine.evaluateRules(v, threatType) : null;
      const triggeredRules = (ruleInsights && ruleInsights.triggeredRules && ruleInsights.triggeredRules.length)
        ? ruleInsights.triggeredRules
        : (ruleEval ? ruleEval.triggeredRules : (v.reasons || []));
      const explainability = (ruleInsights && ruleInsights.explainability)
        ? ruleInsights.explainability
        : (ruleEval ? ruleEval.explainability : (v.explainability || ""));
      const ruleLogic = (ruleInsights && ruleInsights.logic)
        ? ruleInsights.logic
        : (ruleEval ? ruleEval.logic : (triggeredRules[0] || "Route Deviation + Near Border"));
      const ruleScore = (ruleInsights && typeof ruleInsights.ruleScore === "number")
        ? ruleInsights.ruleScore
        : (ruleEval ? ruleEval.ruleScore : score);

      return {
        ...v,
        id: v.vesselId || v.id,
        vesselId: v.vesselId || v.id,
        riskScore: score,
        risk: score,
        level,
        threatType,
        confidence,
        contributingFeatures: [],
        ruleScore,
        reasons: triggeredRules,
        behaviours: triggeredRules,
        ruleLogic,
        explainability,
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
                // NEVER overwrite a vessel that is an active threat, has an active alert, or is assigned
                const hasActiveAlert = (s.alerts || []).some(a => (a.vesselId === v.id || a.vesselId === v.vesselId || a.vesselName === v.name) && a.status !== "False Alarm" && a.status !== "Resolved");
                if (hasActiveAlert || v.level === "HIGH" || (v.riskScore || 0) >= 70 || v.assigned || v.isAssigned) {
                  return v;
                }
                const fused = evaluated[idx] || (fusionService ? fusionService.getCached(v.vesselId || v.id) : null);
                if (!fused) return v;
                const mlPred = fused.mlPrediction;
                const ruleInsights = fused.ruleInsights;
                const score = mlPred ? mlPred.riskScore : v.riskScore;
                const level = mlPred ? mlPred.level : (score >= 70 ? "HIGH" : score >= 35 ? "MEDIUM" : "LOW");
                const threatType = mlPred ? mlPred.threatType : v.threatType;
                const ruleEngine = (typeof window !== "undefined" && window.MS_RULE_ENGINE) ? window.MS_RULE_ENGINE : null;
                const ruleEval = ruleEngine ? ruleEngine.evaluateRules(v, threatType) : null;
                const triggeredRules = (ruleInsights && ruleInsights.triggeredRules && ruleInsights.triggeredRules.length) 
                  ? ruleInsights.triggeredRules 
                  : (ruleEval ? ruleEval.triggeredRules : v.reasons);
                const explainability = (ruleInsights && ruleInsights.explainability)
                  ? ruleInsights.explainability
                  : (ruleEval ? ruleEval.explainability : (v.explainability || ""));
                const ruleLogic = (ruleInsights && ruleInsights.logic)
                  ? ruleInsights.logic
                  : (ruleEval ? ruleEval.logic : (triggeredRules[0] || "Route Deviation + Near Border"));

                return {
                  ...v,
                  riskScore: score,
                  risk: score,
                  level,
                  threatType,
                  confidence: mlPred ? mlPred.confidence : v.confidence,
                  contributingFeatures: [],
                  ruleScore: (ruleInsights && typeof ruleInsights.ruleScore === "number") ? ruleInsights.ruleScore : v.ruleScore,
                  reasons: triggeredRules,
                  behaviours: triggeredRules,
                  ruleLogic,
                  explainability
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
      this.anomalyCycleIndex = 0;
      this.lastThreatGeneratedAt = Date.now();
      this.queueEmptyTimestamp = null;
      this.isGeneratingThreat = false;
      this.ready = this.init();

      if (typeof window !== "undefined") {
        window.addEventListener("storage", (e) => {
          if (e.key === STORAGE_KEY && e.newValue) {
            try {
              const parsed = JSON.parse(e.newValue);
              if (parsed && Array.isArray(parsed.alerts)) {
                this.state = {
                  ...this.state,
                  ...parsed,
                  session: this.state.session || parsed.session
                };
                this.notify();
              }
            } catch (err) {
              console.warn("[MsStore] Cross-tab storage sync error:", err);
            }
          }
        });
      }
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
          { id: "TR-01", name: "Dark Activity / Smuggling", condition: "AIS OFF + Restricted Zone", weight: 35, description: "The vessel has turned off its tracking system while entering a restricted or sensitive maritime area, which is a strong sign of intentional concealment, often linked to smuggling or illegal operations.", status: "active", role: "explanation" },
          { id: "TR-02", name: "Suspicious Loitering", condition: "Loitering + High Risk Area", weight: 25, description: "The vessel is staying idle or moving very slowly near a high-risk zone (such as ports or strategic assets), indicating possible surveillance, waiting activity, or suspicious intent.", status: "active", role: "explanation" },
          { id: "TR-03", name: "Illegal Fishing", condition: "Speed < 5 knots + Restricted Zone", weight: 20, description: "The vessel is moving at very low speed inside a restricted or protected zone, which typically indicates fishing activity where it is not allowed.", status: "active", role: "explanation" },
          { id: "TR-04", name: "Border Intrusion", condition: "Route Deviation + Near Border", weight: 25, description: "The vessel has deviated from its normal route and is heading toward or crossing an international maritime boundary, suggesting unauthorized entry or intrusion.", status: "active", role: "explanation" },
          { id: "TR-05", name: "Anomalous Behavior", condition: "Speed Change > 30 knots + High Risk Area", weight: 20, description: "The vessel shows a sudden and unusual spike or drop in speed while operating near a sensitive area, which may indicate evasive maneuvers, pursuit, or abnormal operational behavior.", status: "active", role: "explanation" }
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
        localStorage.removeItem("marisentinel_state_v18");
        localStorage.removeItem("marisentinel_state_v19");
        localStorage.removeItem("marisentinel_state_v20");
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          const rawVessels = parsed.vessels && parsed.vessels.length ? parsed.vessels : seed.vessels || [];

          const rawAlerts = Array.isArray(parsed.alerts) ? parsed.alerts : (seed.alerts || []);
          const activeAlerts = rawAlerts.filter((a) => !a.id || !a.id.startsWith("AL-100"));
          const activeIncidents = (Array.isArray(parsed.incidents) ? parsed.incidents : (seed.incidents || [])).filter((i) => i && i.id !== "INC-8492" && i.id !== "INC-7104" && i.id !== "INC-1001" && i.id !== "INC-1002");

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

            const hasActiveIncident = (activeIncidents || []).some(i => i.status !== "Closed" && (i.vesselId === (v.vesselId || v.id) || i.vesselName === v.name));
            const hasActiveAlert = (activeAlerts || []).some(a => (a.vesselId === (v.vesselId || v.id) || a.vesselName === v.name) && a.status === "New");
            const isThreat = hasActiveIncident || hasActiveAlert;

            // Real-time calculated score: active threats maintain high risk, remaining vessels are nominal
            const score = isThreat
              ? (typeof v.riskScore === "number" && v.riskScore >= 70 ? v.riskScore : (hasActiveIncident ? 82 : 86))
              : ((typeof v.riskScore === "number" && v.riskScore < 35) ? v.riskScore : (12 + (Math.abs(parseInt(mergedVessel.mmsi || "10", 10)) % 6)));
            const level = isThreat ? "HIGH" : "LOW";
            const threatType = isThreat ? (v.threatType || "High Risk Anomaly") : "Normal Transit";
            const confidence = isThreat ? (typeof v.confidence === "number" ? v.confidence : 92.4) : 96.0;
            const contributingFeatures = isThreat ? (v.contributingFeatures || []) : [];
            const reasons = isThreat ? (v.reasons && v.reasons.length ? v.reasons : (v.behaviours && v.behaviours.length ? v.behaviours : ["Route Deviation + Near Border"])) : [];

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
              behaviours: reasons,
              assigned: hasActiveIncident,
              isAssigned: hasActiveIncident,
              status: hasActiveIncident ? "In Process" : hasActiveAlert ? "Threat" : "Nominal"
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
            notifications: (Array.isArray(parsed.notifications) ? parsed.notifications : (seed.notifications || [])).filter(n => n && !/^NOTIF-(ADM|CMD|FLD)-\d+/i.test(n.id)),
            alerts: activeAlerts,
            incidents: activeIncidents,
            audit: (Array.isArray(parsed.audit) ? parsed.audit : (seed.audit || [])).filter((l) => l && l.action !== "THREAT_ALERT_TRIGGERED"),
            simRunning: true
          };
        }
      } catch (e) {
        console.warn("Using default seed dataset:", e);
      }
      return { ...seed, session: null, simRunning: true, tick: 280, audit: (seed.audit || []).filter((l) => l && l.action !== "THREAT_ALERT_TRIGGERED"), notifications: [], incidents: [], alerts: seed.alerts || [] };
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
    }

    updateUser(userId, fields) {
      this.setState((s) => ({
        ...s,
        users: s.users.map((u) => (u.id === userId ? { ...u, ...fields } : u))
      }));
      const u = this.state.users.find((x) => x.id === userId);
      this.logAudit("User Management", `Updated account details for ${u?.name || userId}`);
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
      this.addNotification(
        "🛡️ Security Zone Created: " + name,
        `New security perimeter ${name} (${classification}, Radius: ${parseFloat(radiusKm) || 25} km) established.`,
        "system",
        "info",
        { targetRoles: ["administrator"] }
      );
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
      this.addNotification(
        "🛡️ Security Zone Updated: " + (z?.name || zoneId),
        `Status changed to ${nextStatus.toUpperCase()}.`,
        "system",
        "info",
        { targetRoles: ["administrator"] }
      );
    }

    updateZoneRadius(zoneId, radiusKm) {
      const r = Math.max(2, Math.min(150, parseFloat(radiusKm) || 25));
      this.setState((s) => ({
        ...s,
        zones: s.zones.map((z) => {
          if (z.id === zoneId) {
            return { ...z, radiusKm: r };
          }
          return z;
        })
      }));
    }

    deleteZone(zoneId) {
      const z = this.state.zones.find((x) => x.id === zoneId);
      this.setState((s) => ({
        ...s,
        zones: s.zones.filter((zone) => zone.id !== zoneId)
      }));
      this.logAudit("Security Zones", `Removed security zone ${z?.name || zoneId}`);
      this.addNotification(
        "🛡️ Security Zone Decommissioned",
        `Zone ${z?.name || zoneId} removed from operational grid.`,
        "system",
        "info",
        { targetRoles: ["administrator"] }
      );
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
      this.addNotification(
        "⚖️ Threat Rule Policy Updated",
        `Rule ${r?.name || ruleId} (${r?.id}) set to ${nextStatus.toUpperCase()}.`,
        "system",
        "info",
        { targetRoles: ["administrator"] }
      );
    }

    updateRuleWeight(ruleId, weight) {
      const w = parseInt(weight, 10);
      this.setState((s) => ({
        ...s,
        threatRules: (s.threatRules || []).map((r) => (r.id === ruleId ? { ...r, weight: w } : r))
      }));
      const r = this.state.threatRules.find((x) => x.id === ruleId);
      this.logAudit("Threat Rules", `Updated weight for ${r?.name || ruleId} to +${w} pts`);
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
    }

    clearNotifications(role) {
      const targetRole = role || (window.location.pathname.includes("admin") ? "administrator" : window.location.pathname.includes("field") ? "field" : "command");
      this.setState((s) => ({
        ...s,
        notifications: (s.notifications || []).filter((n) => {
          const roles = Array.isArray(n.targetRoles) ? n.targetRoles : (n.targetRole ? [n.targetRole] : []);
          if (roles.length > 0) {
            return !roles.includes(targetRole) && !roles.includes("all");
          }
          if (targetRole === "administrator") return !(n.type === "system" || n.type === "audit" || n.type === "operational");
          if (targetRole === "command") return !(n.type === "threat" || n.type === "alert" || (n.type === "mission" && (n.title.includes("Accepted") || n.title.includes("Declined"))));
          if (targetRole === "field") return !(n.type === "field" || (n.type === "mission" && (n.title.includes("Dispatched") || n.title.includes("Assigned"))));
          return true;
        })
      }));
      this.saveState();
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
        alerts: s.alerts.map((a) => (a.id === alertId || (alert.vesselId && (a.vesselId === alert.vesselId || a.id === alert.vesselId)) || (alert.vesselName && a.vesselName === alert.vesselName) ? { ...a, status: "Assigned", assignedTo: assignedOfficerId } : a)),
        vessels: (s.vessels || []).map((v) => ((alert.vesselId && (v.id === alert.vesselId || v.vesselId === alert.vesselId)) || (alert.vesselName && v.name === alert.vesselName) ? { ...v, assigned: true, isAssigned: true, status: "In Process", assignedTo: assignedOfficerId } : v)),
        incidents: [newInc, ...s.incidents],
        users: s.users.map((u) => (u.id === assignedOfficerId ? { ...u, availability: "on-mission" } : u))
      }));
      this.logAudit("Alerts", `Confirmed alert ${alertId} and dispatched ${officer?.name || assignedOfficerId} for ${newInc.id}`);
      this.addNotification(
        "🎯 Mission Dispatched: " + newInc.id,
        `Dispatched to ${officer?.name || 'Field Unit'} for ${alert.vesselName} (${alert.threatType}).`,
        "mission",
        "high",
        { targetRoles: ["field"], incidentId: newInc.id, vesselId: alert.vesselId }
      );
      setTimeout(() => this.checkAndGenerateAutonomousThreat(), 300);
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
            status: "Created & Dispatched",
            note: `Incident opened and assigned to ${officer?.name || "Field Unit"}.`
          }
        ]
      };
      this.setState((s) => ({
        ...s,
        vessels: (s.vessels || []).map((x) =>
          x.name === vesselName || x.id === vesselName || x.vesselId === vesselName
            ? { ...x, assigned: true, isAssigned: true, status: "In Process", assignedTo: assignedOfficerId }
            : x
        ),
        alerts: (s.alerts || []).map((a) =>
          a.vesselName === vesselName || a.vesselId === vesselName
            ? { ...a, status: "Assigned", assignedTo: assignedOfficerId }
            : a
        ),
        incidents: [newInc, ...s.incidents],
        users: s.users.map((u) => (u.id === assignedOfficerId ? { ...u, availability: "on-mission" } : u))
      }));
      this.logAudit("Incidents", `Command created incident ${newInc.id} and dispatched to ${officer?.name || assignedOfficerId}`);
      this.addNotification(
        "🎯 Tactical Incident Created: " + newInc.id,
        `${title} assigned to ${officer?.name || 'Field Unit'}.`,
        "mission",
        risk >= 80 ? "critical" : "high",
        { targetRoles: ["field"], incidentId: newInc.id }
      );
      setTimeout(() => this.checkAndGenerateAutonomousThreat(), 300);
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
        vessels: (s.vessels || []).map((x) =>
          x.id === v.id || x.vesselId === v.vesselId || x.name === v.name
            ? { ...x, assigned: true, isAssigned: true, status: "In Process", assignedTo: assignedOfficerId }
            : x
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
        { targetRoles: ["field"], incidentId: newInc.id, vesselId: v.id }
      );
      setTimeout(() => this.checkAndGenerateAutonomousThreat(), 300);
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
          vessels: (s.vessels || []).map((x) =>
            x.id === v.id || x.vesselId === v.vesselId || x.name === v.name
              ? { ...x, assigned: true, isAssigned: true, status: "In Process", assignedTo: officer?.id || assignedOfficerId }
              : x
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
          { targetRoles: ["field"], incidentId: existingInc.id, vesselId: v.id }
        );
        setTimeout(() => this.checkAndGenerateAutonomousThreat(), 300);
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
    }

    rejectAlert(alertId) {
      const alert = (this.state.alerts || []).find((a) => a.id === alertId);
      this.setState((s) => ({
        ...s,
        alerts: s.alerts.map((a) => (a.id === alertId || (alert && ((alert.vesselId && (a.vesselId === alert.vesselId || a.id === alert.vesselId)) || (alert.vesselName && a.vesselName === alert.vesselName))) ? { ...a, status: "False Alarm" } : a)),
        vessels: (s.vessels || []).map((v) => {
          if (alert && (v.id === alert.vesselId || v.vesselId === alert.vesselId || v.name === alert.vesselName)) {
            return {
              ...v,
              assigned: false,
              isAssigned: false,
              status: "Nominal",
              assignedTo: null,
              riskScore: 14,
              risk: 14,
              level: "LOW",
              threatType: "Normal Transit",
              reasons: [],
              behaviours: []
            };
          }
          return v;
        })
      }));
      this.logAudit("Alerts", `Dismissed alert ${alertId} as false alarm. Contact returned to normal.`);
      setTimeout(() => this.checkAndGenerateAutonomousThreat(), 300);
    }

    updateIncidentStatus(incidentId, status, note) {
      const actor = this.state.session?.name || (window.location.pathname.includes("command") ? "Command Officer" : "Field Officer");
      const currentRole = this.state.session?.role || (window.location.pathname.includes("command") ? "command" : "field");
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

      // Directed routing: actions taken by Field go to Command; actions taken by Command go to Field!
      const targetRoles = currentRole === "field" ? ["command"] : ["field"];
      let notifTitle = `⚡ Status: ${status} (${incidentId})`;
      let notifMsg = `${actor}: ${note || 'Updated tactical execution stage.'}`;

      if (status === "Accepted") {
        notifTitle = `⚡ Mission Accepted: ${incidentId}`;
        notifMsg = `Officer ${actor} accepted mission orders for ${incidentId}. Tactical deployment underway.`;
      }

      this.addNotification(
        notifTitle,
        notifMsg,
        "mission",
        status === "Request Interception" ? "critical" : "high",
        { targetRoles, incidentId }
      );
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
    }

    addIncidentEvidence(incidentId, evidenceObj) {
      const actor = this.state.session?.name || (window.location.pathname.includes("command") ? "Command Officer" : "Field Officer");
      const currentRole = this.state.session?.role || (window.location.pathname.includes("command") ? "command" : "field");
      const targetRoles = currentRole === "field" ? ["command"] : ["field"];

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
                    actor,
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
        `${actor} attached ${evidenceObj.name} (${evidenceObj.type}) to ${incidentId}.`,
        "mission",
        "info",
        { targetRoles, incidentId }
      );
    }

    rejectIncident(incidentId, reason = "Operational conflict / vessel out of intercept range.") {
      const actor = this.state.session?.name || "Field Officer";
      const inc = this.state.incidents.find((i) => i.id === incidentId);
      this.setState((s) => ({
        ...s,
        vessels: (s.vessels || []).map((v) =>
          v.id === inc?.vesselId || v.vesselId === inc?.vesselId || v.name === inc?.vesselName
            ? { ...v, assigned: false, status: "New", assignedTo: null }
            : v
        ),
        alerts: (s.alerts || []).map((a) =>
          a.vesselId === inc?.vesselId || a.vesselName === inc?.vesselName
            ? { ...a, status: "New", assignedTo: null }
            : a
        ),
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
        { targetRoles: ["command"], incidentId }
      );
    }

    simulateOfficerMovement(officerId = "usr-field-1", targetIncidentId) {
      const inc = this.state.incidents.find((i) =>
        targetIncidentId ? i.id === targetIncidentId : i.status !== "Closed" && i.assignedTo === officerId
      );
      if (!inc) {
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
    }

    closeIncident(incidentId, findings = "Mission completed successfully.") {
      const actor = this.state.session?.name || "Command Officer";
      const inc = this.state.incidents.find((i) => i.id === incidentId);
      this.setState((s) => ({
        ...s,
        vessels: (s.vessels || []).map((v) => {
          if (inc && (v.id === inc.vesselId || v.vesselId === inc.vesselId || v.name === inc.vesselName)) {
            return {
              ...v,
              assigned: false,
              isAssigned: false,
              status: "Nominal",
              assignedTo: null,
              riskScore: 14,
              risk: 14,
              level: "LOW",
              threatType: "Normal Transit",
              reasons: [],
              behaviours: []
            };
          }
          return v;
        }),
        alerts: (s.alerts || []).map((a) => {
          if (inc && (
            (inc.vesselId && (a.vesselId === inc.vesselId || a.id === inc.vesselId)) ||
            (inc.vesselName && a.vesselName === inc.vesselName) ||
            a.incidentId === incidentId
          )) {
            return { ...a, status: "Resolved" };
          }
          return a;
        }),
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
    }

    getIncidentStats() {
      const incs = this.state.incidents || [];
      const total = incs.length;
      const active = incs.filter((i) => i.status !== "Closed").length;
      const resolved = incs.filter((i) => i.status === "Closed").length;
      const resolutionRatePct = total > 0 ? Math.round((resolved / total) * 100) : 100;
      return { total, active, resolved, resolutionRatePct, avgResponseMins: 38 };
    }

    getIncidentHistory(roleFilter = "all", statusFilter = "all", riskFilter = "all", searchKeyword = "") {
      let incs = [...(this.state.incidents || [])];
      
      if (statusFilter === "active") {
        incs = incs.filter((i) => i.status !== "Closed");
      } else if (statusFilter === "closed" || statusFilter === "resolved") {
        incs = incs.filter((i) => i.status === "Closed");
      }

      if (riskFilter !== "all") {
        incs = incs.filter((i) => (i.riskLevel || "").toLowerCase() === riskFilter.toLowerCase());
      }

      if (roleFilter && roleFilter !== "all" && roleFilter !== "administrator" && roleFilter !== "command") {
        incs = incs.filter((i) => i.assignedTo === roleFilter);
      }

      if (searchKeyword && searchKeyword.trim()) {
        const kw = searchKeyword.trim().toLowerCase();
        incs = incs.filter(
          (i) =>
            i.id.toLowerCase().includes(kw) ||
            (i.title && i.title.toLowerCase().includes(kw)) ||
            (i.vesselName && i.vesselName.toLowerCase().includes(kw)) ||
            (i.category && i.category.toLowerCase().includes(kw))
        );
      }

      return incs;
    }

    /* ---------------- Autonomous Anomaly Scenarios (Background ML Rotation) ---------------- */
    getAutonomousScenarios() {
      return [
        {
          type: "Illegal Fishing",
          telemetry: {
            speed: 2.3,
            heading: 190,
            speedChange: 4.0,
            speed_variance: 1.8,
            time_in_zone: 95.0,
            inRestrictedZone: true,
            aisOff: false,
            nearHighRiskArea: false,
            routeDeviation: false,
            loitering: false,
            nearBorder: false
          },
          zoneName: "Kakinada Shoals Marine Sanctuary (16.72°N, 82.56°E)",
          lat: 16.72,
          lng: 82.56
        },
        {
          type: "Border Intrusion",
          telemetry: {
            speed: 15.2,
            heading: 45,
            speedChange: 14.0,
            speed_variance: 4.2,
            time_in_zone: 20.0,
            nearBorder: true,
            routeDeviation: true,
            inRestrictedZone: false,
            aisOff: false,
            nearHighRiskArea: true,
            loitering: false
          },
          zoneName: "IMBL Sector 4 (20.98°N, 89.22°E)",
          lat: 20.98,
          lng: 89.22
        },
        {
          type: "Suspicious Loitering",
          telemetry: {
            speed: 1.4,
            heading: 165,
            speedChange: 3.0,
            speed_variance: 1.0,
            time_in_zone: 130.0,
            loitering: true,
            nearHighRiskArea: true,
            inRestrictedZone: false,
            aisOff: false,
            routeDeviation: false,
            nearBorder: false
          },
          zoneName: "Gopalpur Defence Perimeter (19.15°N, 85.28°E)",
          lat: 19.15,
          lng: 85.28
        },
        {
          type: "Dark Activity / Smuggling",
          telemetry: {
            speed: 25.4,
            heading: 305,
            speedChange: 34.0,
            speed_variance: 14.5,
            time_in_zone: 110.0,
            aisOff: true,
            inRestrictedZone: true,
            nearHighRiskArea: true,
            routeDeviation: true,
            loitering: false,
            nearBorder: false
          },
          zoneName: "Point Calimere Sector (9.80°N, 79.92°E)",
          lat: 9.80,
          lng: 79.92
        }
      ];
    }

    /* ---------------- Live Simulation Heartbeat ---------------- */
    startSimulation() {
      if (typeof window !== "undefined" && window.location && window.location.pathname.includes("login.html")) {
        return; // Skip simulation engine on login screen
      }
      if (this.timer) clearInterval(this.timer);
      setTimeout(() => this.checkAndGenerateAutonomousThreat(), 600);
      this.timer = setInterval(() => {
        if (!this.state.simRunning) return;
        this.tick();
      }, 3500);
    }

    toggleSimulation() {
      this.setState((s) => ({ ...s, simRunning: !s.simRunning }));
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

          const hasActiveIncident = (s.incidents || []).some(i => (i.vesselId === (v.vesselId || v.id) || i.vesselName === v.name) && i.status !== "Closed");
          const hasActiveAlert = (s.alerts || []).some(a => (a.vesselId === (v.vesselId || v.id) || a.vesselName === v.name) && a.status === "New");
          const isThreat = hasActiveIncident || hasActiveAlert;

          // Real-time calculated score: active threats maintain high risk, remaining vessels are nominal
          let mlScore = isThreat
            ? (typeof v.riskScore === "number" && v.riskScore >= 70 ? v.riskScore : (hasActiveIncident ? 82 : 86))
            : ((typeof v.riskScore === "number" && v.riskScore < 35) ? v.riskScore : (12 + (Math.abs(parseInt(v.mmsi || "10", 10)) % 6)));
          const level = isThreat ? "HIGH" : "LOW";
          const threatType = isThreat ? (v.threatType && v.threatType !== "Normal Transit" ? v.threatType : "High Risk Anomaly") : "Normal Transit";
          const confidence = isThreat ? (typeof v.confidence === "number" ? v.confidence : 92.4) : 96.0;

          // Heuristic rule explanation evaluation correlated to AI threat
          const ruleEval = ruleEngine ? ruleEngine.evaluateRules(candidate, threatType) : { triggeredRules: [], ruleScore: 0, explainability: "" };
          const triggeredRules = isThreat ? (ruleEval.triggeredRules && ruleEval.triggeredRules.length ? ruleEval.triggeredRules : (v.reasons && v.reasons.length ? v.reasons : ["Route Deviation + Near Border"])) : [];
          const ruleScore = isThreat ? (ruleEval.ruleScore || mlScore) : 0;
          const explainability = isThreat ? (ruleEval.explainability || "") : "";
          const ruleLogic = isThreat ? (ruleEval.logic || (triggeredRules[0] || "Anomaly Detected")) : "Nominal Navigation";

          const status = hasActiveIncident ? "In Process" : hasActiveAlert ? "Threat" : "Nominal";
          const isVesselAssigned = hasActiveIncident;

          if (level === "HIGH" && !isVesselAssigned) {
            const existingAlertIndex = (s.alerts || []).findIndex(a => (a.vesselId === (v.vesselId || v.id) || a.vesselName === v.name) && a.status === "New");
            const severity = mlScore >= 85 ? "Critical" : "High";
            const zoneText = activeZoneName !== "Open water" ? activeZoneName : `${v.destination || 'Bay of Bengal'} (${Math.round(nextLat * 100) / 100}°N, ${Math.round(nextLng * 100) / 100}°E)`;

            if (existingAlertIndex === -1) {
              const newAlert = {
                id: "AL-" + Date.now().toString().slice(-6) + "-" + Math.floor(Math.random() * 900 + 100),
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
                behaviours: triggeredRules,
                ruleLogic,
                explainability
              };
              newAlerts.push(newAlert);
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
            contributingFeatures: [],
            reasons: triggeredRules,
            behaviours: triggeredRules,
            ruleLogic,
            explainability,
            trail,
            assigned: hasActiveIncident,
            isAssigned: hasActiveIncident,
            status,
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
              { targetRoles: ["command"], vesselId: a.vesselId }
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
          .filter(a => a.status === "New" || a.status === "Assigned" || !!a.assignedTo || (a.risk >= 35 && a.severity !== "Low"));

        const alerts = [...newAlerts, ...updatedAlerts];

        return {
          ...s,
          tick: nextTick,
          vessels: updatedVessels,
          alerts,
          weather
        };
      });

      // Autonomous background threat injection check
      this.checkAndGenerateAutonomousThreat();
    }

    async checkAndGenerateAutonomousThreat() {
      if (this.isGeneratingThreat) return;
      const s = this.state;
      if (!s || !s.simRunning) return;

      // Track all currently assigned vessels across incidents, alerts, and vessel models
      const assignedVesselKeys = new Set();
      (s.incidents || []).forEach(i => {
        if (i.status !== "Closed") {
          if (i.vesselId) assignedVesselKeys.add(String(i.vesselId).trim());
          if (i.vesselName) assignedVesselKeys.add(String(i.vesselName).trim());
        }
      });
      (s.alerts || []).forEach(a => {
        if (a.status === "Assigned" || a.assignedTo) {
          if (a.vesselId) assignedVesselKeys.add(String(a.vesselId).trim());
          if (a.vesselName) assignedVesselKeys.add(String(a.vesselName).trim());
        }
      });
      (s.vessels || []).forEach(v => {
        if (v.assigned || v.isAssigned || v.status === "Assigned" || v.status === "In Process") {
          if (v.id) assignedVesselKeys.add(String(v.id).trim());
          if (v.vesselId) assignedVesselKeys.add(String(v.vesselId).trim());
          if (v.name) assignedVesselKeys.add(String(v.name).trim());
        }
      });

      // Count unassigned active high/critical threats
      const unassignedActiveAlerts = (s.alerts || []).filter(a => {
        if (a.status === "Assigned" || a.assignedTo || a.status === "Resolved" || a.status === "False Alarm") return false;
        if (a.vesselId && assignedVesselKeys.has(String(a.vesselId).trim())) return false;
        if (a.vesselName && assignedVesselKeys.has(String(a.vesselName).trim())) return false;
        return (a.risk || 0) >= 70 || a.severity === "Critical" || a.severity === "High";
      });

      // STRICT GLOBAL RULE:
      // If there are ALREADY active unassigned critical threats (> 0):
      // DO NOT generate new threats! Once generated, they remain globally visible across all tabs and will NOT re-generate on 2nd open / refresh.
      if (unassignedActiveAlerts.length > 0) {
        return;
      }

      // ACTIVE THREATS ARE ZERO: Immediately generate a batch of 3 to 4 threats!
      this.isGeneratingThreat = true;

      // Filter available unassigned candidate vessels from the fleet
      const candidates = (s.vessels || []).filter(v => {
        const vId = String(v.vesselId || v.id || "").trim();
        const vName = String(v.name || "").trim();
        if (assignedVesselKeys.has(vId) || assignedVesselKeys.has(vName)) return false;
        if (v.assigned || v.isAssigned || v.status === "Assigned" || v.status === "In Process") return false;
        if (vName.startsWith("CG ") || (v.type && v.type.toLowerCase().includes("patrol"))) return false;
        return true;
      });

      if (!candidates.length) {
        this.isGeneratingThreat = false;
        return;
      }

      // Pick 3 to 4 distinct candidate vessels
      const shuffled = [...candidates].sort(() => 0.5 - Math.random());
      const batchCount = Math.min(4, Math.max(3, shuffled.length));
      const selectedVessels = shuffled.slice(0, batchCount);

      const scenarios = this.getAutonomousScenarios();
      const fusionService = (typeof window !== "undefined" && window.MS_FUSION) ? window.MS_FUSION : null;

      try {
        const batchPromises = selectedVessels.map(async (targetVessel, idx) => {
          const scenario = scenarios[(this.anomalyCycleIndex + idx) % scenarios.length];
          const candidatePayload = {
            ...targetVessel,
            ...scenario.telemetry,
            lat: scenario.lat,
            lng: scenario.lng,
            destination: scenario.zoneName
          };

          let fusedResult = null;
          if (fusionService && fusionService.evaluateVessel) {
            try {
              fusedResult = await fusionService.evaluateVessel(candidatePayload);
            } catch (err) {
              console.warn("[Autonomous ML] evaluateVessel fallback for", targetVessel.name, err);
            }
          }

          const ml = (fusedResult && fusedResult.mlPrediction) ? fusedResult.mlPrediction : {
            riskScore: scenario.type.includes("Smuggling") ? 88 : scenario.type.includes("Border") ? 86 : scenario.type.includes("Fishing") ? 82 : 78,
            level: "HIGH",
            threatType: scenario.type,
            confidence: 94.5
          };
          const rules = (fusedResult && fusedResult.ruleInsights) ? fusedResult.ruleInsights : {};
          const riskScore = ml.riskScore || 80;
          const threatType = ml.threatType || scenario.type;
          const severity = riskScore >= 80 ? "Critical" : "High";

          const newAlert = {
            id: "AL-" + Date.now().toString().slice(-6) + "-" + Math.floor(Math.random() * 900 + 100),
            ts: new Date(Date.now() - (batchCount - idx - 1) * 30000).toISOString(),
            vesselId: targetVessel.vesselId || targetVessel.id,
            vesselName: targetVessel.name,
            vesselType: targetVessel.type,
            threatType,
            risk: riskScore,
            level: ml.level || "HIGH",
            severity,
            confidence: ml.confidence || 94.5,
            zoneName: scenario.zoneName,
            status: "New",
            lat: scenario.lat,
            lng: scenario.lng,
            behaviours: (rules.triggeredRules && rules.triggeredRules.length) ? rules.triggeredRules : [rules.logic || "Anomaly Detected"],
            ruleLogic: rules.logic || "Autonomous ML Threat Detection",
            explainability: rules.explainability || ""
          };

          return { targetVessel, scenario, newAlert, riskScore, threatType, ml };
        });

        this.anomalyCycleIndex = (this.anomalyCycleIndex + batchCount) % scenarios.length;
        const batchResults = await Promise.all(batchPromises);

        this.setState(state => {
          const targetIds = new Set(batchResults.map(r => String(r.targetVessel.vesselId || r.targetVessel.id)));
          const resultMap = new Map(batchResults.map(r => [String(r.targetVessel.vesselId || r.targetVessel.id), r]));

          const nextVessels = (state.vessels || []).map(v => {
            const vid = String(v.vesselId || v.id);
            if (targetIds.has(vid)) {
              const r = resultMap.get(vid);
              return {
                ...v,
                ...r.scenario.telemetry,
                lat: r.scenario.lat,
                lng: r.scenario.lng,
                riskScore: r.riskScore,
                risk: r.riskScore,
                level: r.ml.level || "HIGH",
                threatType: r.threatType,
                confidence: r.ml.confidence,
                reasons: r.newAlert.behaviours,
                behaviours: r.newAlert.behaviours,
                ruleLogic: r.newAlert.ruleLogic,
                explainability: r.newAlert.explainability,
                status: "Threat",
                assigned: false,
                isAssigned: false,
                lastUpdate: new Date().toISOString()
              };
            }
            return v;
          });

          // Prevent collision: purge any stale duplicate alert for these specific vessels
          const cleanCurrentAlerts = (state.alerts || []).filter(a => {
            const vid = String(a.vesselId || "");
            const vname = String(a.vesselName || "");
            return !targetIds.has(vid) && !batchResults.some(r => r.targetVessel.name === vname);
          });
          const generatedAlerts = batchResults.map(r => r.newAlert);

          return {
            ...state,
            vessels: nextVessels,
            alerts: [...generatedAlerts, ...cleanCurrentAlerts].slice(0, 50)
          };
        });

        batchResults.forEach(r => {
          this.addNotification(
            `🚨 Threat Alert: ${r.targetVessel.name}`,
            `${r.threatType} detected near ${r.scenario.zoneName} (Threat Score: ${r.riskScore}/100).`,
            "threat",
            r.newAlert.severity === "Critical" ? "critical" : "high",
            { targetRoles: ["command"], vesselId: r.targetVessel.vesselId || r.targetVessel.id }
          );
        });

        console.log(`[Autonomous ML Engine] Immediately regenerated ${batchResults.length} threats into active tactical queue.`);
      } catch (err) {
        console.warn("[Autonomous ML Engine] Error generating batch threats:", err);
      } finally {
        this.isGeneratingThreat = false;
      }
    }
  }

  window.msStore = new MsStore();
})();
