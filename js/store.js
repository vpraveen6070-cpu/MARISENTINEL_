/**
 * MARISENTINEL — Vanilla JS Central State Store & Simulation Engine
 */

(function () {
  const STORAGE_KEY = "marisentinel_state_v2";

  class MsStore {
    constructor() {
      this.listeners = new Set();
      this.state = this.loadState();
      this.timer = null;
      this.startSimulation();
    }

    loadState() {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          return { ...window.MS_SEED, ...parsed };
        }
      } catch (e) {
        console.warn("Using default seed dataset:", e);
      }
      return { ...window.MS_SEED, session: null, simRunning: true, tick: 260 };
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
        try { fn(this.state); } catch (e) { console.error(e); }
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
        lat: role === "field" ? 17.65 : undefined,
        lng: role === "field" ? 83.35 : undefined
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
      this.setState((s) => ({
        ...s,
        users: s.users.map((u) => {
          if (u.id === userId) {
            nextStatus = u.status === "active" ? "disabled" : "active";
            return { ...u, status: nextStatus };
          }
          return u;
        })
      }));
      const u = this.state.users.find((x) => x.id === userId);
      this.logAudit("User Management", `Changed ${u?.name || userId} status to ${nextStatus}`);
      if (window.MS_UI) window.MS_UI.showToast(`User status set to ${nextStatus}.`);
    }

    deleteUser(userId) {
      const u = this.state.users.find((x) => x.id === userId);
      this.setState((s) => ({
        ...s,
        users: s.users.filter((user) => user.id !== userId)
      }));
      this.logAudit("User Management", `Deleted operator account for ${u?.name || userId}`);
      if (window.MS_UI) window.MS_UI.showToast(`User ${u?.name || userId} removed.`);
    }

    addZone(name, classification, lat, lng, radiusKm, description) {
      const newZone = {
        id: "ZN-" + Math.floor(Math.random() * 9000 + 1000),
        name,
        classification,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        radiusKm: parseFloat(radiusKm),
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
            ? { ...src, status: src.status === "connected" ? "disconnected" : "connected", lastSync: new Date().toISOString() }
            : src
        )
      }));
      const updated = this.state.sources.find((x) => x.id === sourceId);
      this.logAudit("Data Sources", `Updated data source ${updated?.name} status to ${updated?.status}`);
      if (window.MS_UI) window.MS_UI.showToast(`Source ${updated?.name} status: ${updated?.status}`);
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
      const officer = this.state.users.find(u => u.id === assignedOfficerId);
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
          { ts: new Date().toISOString(), actor: this.state.session?.name || "Command Officer", status: "Confirmed", note: `Alert confirmed. Dispatched to ${officer?.name || 'Field Unit'}.` }
        ]
      };
      this.setState((s) => ({
        ...s,
        alerts: s.alerts.map((a) => (a.id === alertId ? { ...a, status: "Resolved" } : a)),
        incidents: [newInc, ...s.incidents],
        users: s.users.map(u => u.id === assignedOfficerId ? { ...u, availability: "on-mission" } : u)
      }));
      this.logAudit("Alerts", `Confirmed alert ${alertId} and dispatched ${officer?.name || assignedOfficerId} for ${newInc.id}`);
      if (window.MS_UI) window.MS_UI.showToast(`Alert confirmed. ${newInc.id} dispatched to ${officer?.name || 'field'}.`);
    }

    createIncident(title, category, vesselName, riskLevel, risk, assignedOfficerId, lat, lng, description) {
      const officer = this.state.users.find(u => u.id === assignedOfficerId);
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
        lat: parseFloat(lat) || 17.65,
        lng: parseFloat(lng) || 83.35,
        description: description || "Tactical interception and vessel boarding authorization.",
        missionStatus: "Assigned & Dispatched",
        timeline: [
          { ts: new Date().toISOString(), actor: this.state.session?.name || "Command Officer", status: "Created", note: `Incident created and dispatched to ${officer?.name || 'Field Officer'}.` }
        ]
      };
      this.setState((s) => ({
        ...s,
        incidents: [newInc, ...s.incidents],
        users: s.users.map(u => u.id === assignedOfficerId ? { ...u, availability: "on-mission" } : u)
      }));
      this.logAudit("Incidents", `Command created incident ${newInc.id} and dispatched to ${officer?.name || assignedOfficerId}`);
      if (window.MS_UI) window.MS_UI.showToast(`Incident ${newInc.id} created & assigned.`);
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
                  { ts: new Date().toISOString(), actor: this.state.session?.name || "Field Officer", status: "Evidence Uploaded", note: `Attached: ${evidenceObj.name} (${evidenceObj.type})` }
                ]
              }
            : i
        )
      }));
      this.logAudit("Incidents", `Evidence attached to ${incidentId}: ${evidenceObj.name}`);
      if (window.MS_UI) window.MS_UI.showToast(`Evidence ${evidenceObj.name} saved.`);
    }

    rejectIncident(incidentId, reason = "Operational conflict / vessel out of intercept range.") {
      const actor = this.state.session?.name || "Field Officer";
      const inc = this.state.incidents.find(i => i.id === incidentId);
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
        users: s.users.map(u => u.id === inc?.assignedTo ? { ...u, availability: "available" } : u)
      }));
      this.logAudit("Incidents", `Officer declined assignment for ${incidentId}: ${reason}`);
      if (window.MS_UI) window.MS_UI.showToast(`Mission assignment declined.`);
    }

    simulateOfficerMovement(officerId = "usr-field-1", targetIncidentId) {
      const inc = this.state.incidents.find(i => targetIncidentId ? i.id === targetIncidentId : (i.status !== "Closed" && i.assignedTo === officerId));
      if (!inc) {
        if (window.MS_UI) window.MS_UI.showToast("No active mission target for movement simulation.");
        return;
      }

      this.setState((s) => ({
        ...s,
        users: s.users.map((u) => {
          if (u.id === officerId && u.lat && u.lng) {
            // Move 30% closer to target incident coords
            const newLat = u.lat + (inc.lat - u.lat) * 0.35;
            const newLng = u.lng + (inc.lng - u.lng) * 0.35;
            return { ...u, lat: parseFloat(newLat.toFixed(4)), lng: parseFloat(newLng.toFixed(4)), availability: "on-mission" };
          }
          return u;
        })
      }));
      if (window.MS_UI) window.MS_UI.showToast("Interceptor moving toward target...");
    }

    closeIncident(incidentId, findings = "Mission completed successfully.") {
      const actor = this.state.session?.name || "Command Officer";
      const inc = this.state.incidents.find(i => i.id === incidentId);
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
        users: s.users.map(u => u.id === inc?.assignedTo ? { ...u, availability: "available" } : u)
      }));
      this.logAudit("Incidents", `Closed & archived incident ${incidentId}`);
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
        const nextTick = (s.tick || 260) + 1;
        const newAlerts = [];

        // Drift vessels along their courses
        const updatedVessels = (s.vessels || []).map((v) => {
          const drift = 0.008 + Math.random() * 0.015;
          const rad = (v.course * Math.PI) / 180;
          const lat = Math.min(22.5, Math.max(10.0, v.lat + Math.cos(rad) * drift * (v.speed / 10)));
          const lng = Math.min(94.0, Math.max(80.0, v.lng + Math.sin(rad) * drift * (v.speed / 10)));
          const speed = Math.max(0.2, Math.round((v.speed + (Math.random() - 0.5) * 0.8) * 10) / 10);
          const course = Math.round((v.course + (Math.random() - 0.5) * 8 + 360) % 360);

          // Check if in restricted zone
          let insideRestricted = false;
          let activeZoneName = "Open water";
          for (const z of s.zones || []) {
            const dist = Math.hypot(lat - z.lat, lng - z.lng) * 111;
            if (dist <= z.radiusKm) {
              activeZoneName = z.name;
              if (z.classification === "Critical" || z.classification === "Restricted") {
                insideRestricted = true;
              }
            }
          }

          let risk = v.risk;
          if (insideRestricted) {
            risk = Math.min(100, Math.max(75, risk + Math.floor(Math.random() * 4)));
          } else {
            risk = Math.max(10, Math.min(95, risk + Math.floor((Math.random() - 0.5) * 3)));
          }

          // Random alert generation for high risk vessels
          if (risk >= 75 && Math.random() > 0.85) {
            newAlerts.push({
              id: "AL-" + Math.floor(Math.random() * 9000 + 1000),
              ts: new Date().toISOString(),
              vesselId: v.id,
              vesselName: v.name,
              threatType: insideRestricted ? "Restricted Zone Intrusion" : "Erratic Vessel Trajectory",
              risk,
              severity: risk > 80 ? "Critical" : "High",
              zoneName: activeZoneName,
              status: "New",
              lat: Math.round(lat * 1000) / 1000,
              lng: Math.round(lng * 1000) / 1000,
              behaviours: ["Automated detector trigger"]
            });
          }

          const trail = [...(v.trail || []).slice(-10), [Math.round(lat * 1000) / 1000, Math.round(lng * 1000) / 1000]];

          return {
            ...v,
            lat: Math.round(lat * 1000) / 1000,
            lng: Math.round(lng * 1000) / 1000,
            speed,
            course,
            risk,
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

        const alerts = newAlerts.length ? [...newAlerts, ...(s.alerts || [])].slice(0, 50) : s.alerts;

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
