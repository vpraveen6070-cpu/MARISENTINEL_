import { useSyncExternalStore } from "react";
import { EMPTY_STATE, createSeed } from "./seed";
import { computeRisk, severityFromScore, threatTypeFor, zoneOf } from "./threat";
import type {
  Alert,
  AuditLog,
  AlertStatus,
  Evidence,
  EvidenceType,
  Incident,
  MsState,
  Notification,
  Role,
  User,
  Vessel,
  VesselBehaviour,
  Zone,
} from "./types";

const KEY = "marisentinel:state:v1";

let state: MsState = EMPTY_STATE;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function emit() {
  for (const l of listeners) l();
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full or unavailable — demo continues in memory */
  }
}

function set(mutator: (draft: MsState) => void, options: { persist?: boolean } = {}) {
  const draft: MsState = { ...state };
  mutator(draft);
  state = draft;
  if (options.persist !== false) persist();
  emit();
}

const nowIso = () => new Date().toISOString();
const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

export const store = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  get: () => state,
  getServer: () => EMPTY_STATE,

  hydrate() {
    if (state.hydrated) return;
    let next: MsState | null = null;
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) next = { ...EMPTY_STATE, ...(JSON.parse(raw) as MsState), hydrated: true };
    } catch {
      next = null;
    }
    state = next ?? createSeed();
    state.hydrated = true;
    persist();
    emit();
    store.startSim();
  },

  reset() {
    state = createSeed();
    persist();
    emit();
  },

  /* ---------------- audit + notifications ---------------- */
  log(action: string, module: string, status: "success" | "failed" = "success") {
    set((d) => {
      const entry: AuditLog = {
          id: uid("LG"),
          ts: nowIso(),
          user: d.session?.name ?? "system",
          role: d.session?.role ?? "system",
          action,
          module,
          ip: d.session ? "10.24.6.11 / browser" : "internal",
        status,
      };
      d.audit = [entry, ...d.audit].slice(0, 400);
    });
  },

  notify(n: Omit<Notification, "id" | "ts" | "read">) {
    set((d) => {
      d.notifications = [{ ...n, id: uid("NT"), ts: nowIso(), read: false }, ...d.notifications].slice(0, 120);
    });
  },
  markNotificationRead(id: string) {
    set((d) => {
      d.notifications = d.notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    });
  },
  markAllRead(role: Role) {
    set((d) => {
      d.notifications = d.notifications.map((n) =>
        n.audience === role || n.audience === "all" ? { ...n, read: true } : n,
      );
    });
  },
  clearNotifications(role: Role) {
    set((d) => {
      d.notifications = d.notifications.filter((n) => n.audience !== role && n.audience !== "all");
    });
  },

  /* ---------------- auth ---------------- */
  login(username: string, password: string, role: Role | "" ): { ok: boolean; error?: string; role?: Role } {
    const user = state.users.find((u) => u.username === username.trim().toLowerCase());
    if (!user || user.password !== password) {
      store.log(`Failed sign-in attempt for "${username}"`, "Auth", "failed");
      return { ok: false, error: "Invalid credentials. Check the username and password." };
    }
    if (user.status === "disabled") {
      store.log(`Blocked sign-in for disabled account ${user.username}`, "Auth", "failed");
      return { ok: false, error: "This account is disabled. Contact an administrator." };
    }
    if (role && role !== user.role) {
      return { ok: false, error: "Selected role does not match this account." };
    }
    set((d) => {
      d.session = { userId: user.id, name: user.name, role: user.role, loginAt: nowIso() };
      d.users = d.users.map((u) => (u.id === user.id ? { ...u, lastLogin: nowIso() } : u));
    });
    store.log("Signed in", "Auth");
    return { ok: true, role: user.role };
  },
  logout() {
    store.log("Signed out", "Auth");
    set((d) => {
      d.session = null;
    });
  },

  /* ---------------- users ---------------- */
  addUser(input: Omit<User, "id" | "lastLogin">) {
    const id = uid("USR");
    set((d) => {
      d.users = [...d.users, { ...input, id, lastLogin: null }];
    });
    store.log(`Created user ${input.name} (${input.role})`, "User Management");
    return id;
  },
  updateUser(id: string, patch: Partial<User>) {
    set((d) => {
      d.users = d.users.map((u) => (u.id === id ? { ...u, ...patch } : u));
    });
    store.log(`Updated user ${id}`, "User Management");
  },
  deleteUser(id: string) {
    const name = state.users.find((u) => u.id === id)?.name ?? id;
    set((d) => {
      d.users = d.users.filter((u) => u.id !== id);
    });
    store.log(`Deleted user ${name}`, "User Management");
  },

  /* ---------------- zones ---------------- */
  addZone(input: Omit<Zone, "id">) {
    set((d) => {
      d.zones = [...d.zones, { ...input, id: uid("ZN") }];
    });
    store.log(`Created security zone ${input.name}`, "Security Zones");
  },
  updateZone(id: string, patch: Partial<Zone>) {
    set((d) => {
      d.zones = d.zones.map((z) => (z.id === id ? { ...z, ...patch } : z));
    });
    store.log(`Updated security zone ${id}`, "Security Zones");
  },
  deleteZone(id: string) {
    set((d) => {
      d.zones = d.zones.filter((z) => z.id !== id);
    });
    store.log(`Deleted security zone ${id}`, "Security Zones");
  },

  /* ---------------- data sources ---------------- */
  setSourceStatus(id: string, status: "connected" | "disconnected" | "degraded") {
    set((d) => {
      d.sources = d.sources.map((s) => (s.id === id ? { ...s, status, lastSync: nowIso() } : s));
    });
    store.log(`Data source ${id} → ${status}`, "Data Sources");
  },

  /* ---------------- rules ---------------- */
  toggleRule(id: string) {
    set((d) => {
      d.rules = d.rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r));
    });
    store.log(`Toggled threat rule ${id}`, "Threat Rules");
  },
  updateRule(id: string, patch: Partial<MsState["rules"][number]>) {
    set((d) => {
      d.rules = d.rules.map((r) => (r.id === id ? { ...r, ...patch } : r));
    });
    store.log(`Updated threat rule ${id}`, "Threat Rules");
  },

  /* ---------------- alerts ---------------- */
  setAlertStatus(id: string, status: AlertStatus) {
    set((d) => {
      d.alerts = d.alerts.map((a) => (a.id === id ? { ...a, status } : a));
    });
    store.log(`Alert ${id} → ${status}`, "Alerts");
  },

  /* ---------------- incidents ---------------- */
  createIncidentFromAlert(alertId: string): string | null {
    const alert = state.alerts.find((a) => a.id === alertId);
    if (!alert) return null;
    const existing = state.incidents.find((i) => i.alertId === alertId);
    if (existing) return existing.id;
    const id = `INC-${1100 + state.incidents.length}`;
    const incident: Incident = {
      id,
      title: `${alert.threatType} — ${alert.vesselName}`,
      vesselId: alert.vesselId,
      vesselName: alert.vesselName,
      alertId,
      lat: alert.lat,
      lng: alert.lng,
      category: alert.threatType,
      riskLevel: alert.severity,
      risk: alert.risk,
      description: `Confirmed from alert ${alert.id}. Detected behaviours: ${alert.behaviours.join(", ")}. Zone: ${alert.zoneName}.`,
      detectedAt: nowIso(),
      assignedTo: null,
      assignedAt: null,
      deadline: null,
      status: "Open",
      missionStatus: null,
      timeline: [
        { ts: nowIso(), actor: state.session?.name ?? "Command", status: "Open", note: `Threat confirmed from alert ${alert.id}.` },
      ],
      report: null,
      closedAt: null,
    };
    set((d) => {
      d.incidents = [incident, ...d.incidents];
      d.alerts = d.alerts.map((a) => (a.id === alertId ? { ...a, status: "Confirmed" } : a));
    });
    store.log(`Confirmed threat and opened ${id}`, "Incidents");
    store.notify({
      title: `Incident ${id} created`,
      body: `${incident.title} — risk ${incident.risk}.`,
      audience: "administrator",
      severity: incident.riskLevel,
      link: "/admin/audit",
    });
    return id;
  },

  assignOfficer(incidentId: string, officerId: string, deadlineHours = 6) {
    const officer = state.users.find((u) => u.id === officerId);
    if (!officer) return;
    set((d) => {
      d.incidents = d.incidents.map((i) =>
        i.id === incidentId
          ? {
              ...i,
              assignedTo: officerId,
              assignedAt: nowIso(),
              deadline: new Date(Date.now() + deadlineHours * 3600000).toISOString(),
              status: "Assigned",
              missionStatus: "Assigned",
              timeline: [
                ...i.timeline,
                { ts: nowIso(), actor: d.session?.name ?? "Command", status: "Assigned", note: `Assigned to ${officer.name}.` },
              ],
            }
          : i,
      );
      d.users = d.users.map((u) =>
        u.id === officerId ? { ...u, availability: "on-mission", currentAssignment: incidentId } : u,
      );
    });
    store.log(`Assigned ${incidentId} to ${officer.name}`, "Assignments");
    store.notify({
      title: "New assignment received",
      body: `${incidentId} assigned to you. Respond within ${deadlineHours} h.`,
      audience: "field",
      severity: "High",
      link: "/field/assignments",
    });
  },

  respondToAssignment(incidentId: string, accept: boolean, note = "") {
    const actor = state.session?.name ?? "Field Officer";
    set((d) => {
      d.incidents = d.incidents.map((i) => {
        if (i.id !== incidentId) return i;
        return accept
          ? {
              ...i,
              status: "In Progress",
              missionStatus: "Accepted",
              timeline: [...i.timeline, { ts: nowIso(), actor, status: "Accepted", note: note || "Assignment accepted." }],
            }
          : {
              ...i,
              status: "Open",
              assignedTo: null,
              assignedAt: null,
              missionStatus: null,
              timeline: [...i.timeline, { ts: nowIso(), actor, status: "Rejected", note: note || "Assignment rejected." }],
            };
      });
      if (!accept) {
        const inc = d.incidents.find((i) => i.id === incidentId);
        d.users = d.users.map((u) =>
          u.currentAssignment === incidentId ? { ...u, availability: "available", currentAssignment: null } : u,
        );
        void inc;
      }
    });
    store.log(`${accept ? "Accepted" : "Rejected"} assignment ${incidentId}`, "Field Ops");
    store.notify({
      title: accept ? "Assignment accepted" : "Assignment rejected",
      body: `${actor} ${accept ? "accepted" : "rejected"} ${incidentId}.`,
      audience: "command",
      severity: accept ? "Info" : "High",
      link: "/command/assignments",
    });
  },

  updateMission(incidentId: string, missionStatus: NonNullable<Incident["missionStatus"]>, note: string) {
    const actor = state.session?.name ?? "Field Officer";
    set((d) => {
      d.incidents = d.incidents.map((i) =>
        i.id === incidentId
          ? {
              ...i,
              missionStatus,
              status: missionStatus === "Completed" ? "Awaiting Review" : "In Progress",
              timeline: [...i.timeline, { ts: nowIso(), actor, status: missionStatus, note: note || `Status set to ${missionStatus}.` }],
            }
          : i,
      );
    });
    store.log(`Mission status ${missionStatus} (${incidentId})`, "Field Ops");
    store.notify({
      title: `Field update — ${incidentId}`,
      body: `${actor}: ${missionStatus}. ${note}`.trim(),
      audience: "command",
      severity: "Info",
      link: "/command/incidents",
    });
  },

  addEvidence(input: Omit<Evidence, "id" | "ts" | "submittedBy"> & { type: EvidenceType }) {
    const actor = state.session?.name ?? "Field Officer";
    const id = uid("EV");
    set((d) => {
      d.evidence = [{ ...input, id, ts: nowIso(), submittedBy: actor }, ...d.evidence];
      d.incidents = d.incidents.map((i) =>
        i.id === input.incidentId
          ? {
              ...i,
              missionStatus: i.missionStatus === "Completed" ? i.missionStatus : "Evidence Submitted",
              timeline: [...i.timeline, { ts: nowIso(), actor, status: "Evidence Submitted", note: `${input.type}: ${input.description}` }],
            }
          : i,
      );
    });
    store.log(`Submitted ${input.type.toLowerCase()} evidence for ${input.incidentId}`, "Evidence");
    store.notify({
      title: `Evidence submitted — ${input.incidentId}`,
      body: `${input.type}: ${input.description}`,
      audience: "command",
      severity: "Info",
      link: "/command/evidence",
    });
    return id;
  },

  submitReport(incidentId: string, report: NonNullable<Incident["report"]>) {
    const actor = state.session?.name ?? "Field Officer";
    set((d) => {
      d.incidents = d.incidents.map((i) =>
        i.id === incidentId
          ? {
              ...i,
              report,
              status: "Awaiting Review",
              missionStatus: "Completed",
              timeline: [...i.timeline, { ts: nowIso(), actor, status: "Completed", note: `Final report submitted: ${report.finalStatus}` }],
            }
          : i,
      );
      d.users = d.users.map((u) =>
        u.currentAssignment === incidentId ? { ...u, availability: "available", currentAssignment: null } : u,
      );
    });
    store.log(`Submitted final mission report for ${incidentId}`, "Field Ops");
    store.notify({
      title: `Incident ${incidentId} awaiting review`,
      body: `Final report submitted by ${actor}.`,
      audience: "command",
      severity: "High",
      link: "/command/incidents",
    });
  },

  closeIncident(incidentId: string, note: string) {
    const actor = state.session?.name ?? "Command";
    set((d) => {
      d.incidents = d.incidents.map((i) =>
        i.id === incidentId
          ? {
              ...i,
              status: "Closed",
              closedAt: nowIso(),
              timeline: [...i.timeline, { ts: nowIso(), actor, status: "Closed", note: note || "Reviewed and closed." }],
            }
          : i,
      );
    });
    store.log(`Closed incident ${incidentId}`, "Incidents");
    store.notify({
      title: `Incident ${incidentId} closed`,
      body: note || "Reviewed and approved by command.",
      audience: "administrator",
      severity: "Info",
      link: "/admin/audit",
    });
  },

  reopenIncident(incidentId: string, note: string) {
    const actor = state.session?.name ?? "Command";
    set((d) => {
      d.incidents = d.incidents.map((i) =>
        i.id === incidentId
          ? {
              ...i,
              status: "Investigating",
              missionStatus: "Investigating",
              timeline: [...i.timeline, { ts: nowIso(), actor, status: "Further investigation requested", note }],
            }
          : i,
      );
    });
    store.log(`Requested further investigation on ${incidentId}`, "Incidents");
    store.notify({
      title: `Further investigation requested — ${incidentId}`,
      body: note,
      audience: "field",
      severity: "High",
      link: "/field/assignments",
    });
  },

  moveOfficer(officerId: string, lat: number, lng: number) {
    set((d) => {
      d.users = d.users.map((u) => (u.id === officerId ? { ...u, lat, lng } : u));
    });
  },

  /* ---------------- simulation ---------------- */
  toggleSim() {
    set((d) => {
      d.simRunning = !d.simRunning;
    });
    if (state.simRunning) store.startSim();
  },

  startSim() {
    if (typeof window === "undefined" || timer) return;
    timer = setInterval(() => {
      if (!state.simRunning || !state.hydrated) return;
      store.tick();
    }, 3500);
  },

  tick() {
    const newAlerts: Alert[] = [];
    set(
      (d) => {
        d.tick = d.tick + 1;
        d.vessels = d.vessels.map((v) => {
          const drift = 0.012 + Math.random() * 0.02;
          const rad = (v.course * Math.PI) / 180;
          const lat = Math.min(22, Math.max(5.5, v.lat + Math.cos(rad) * drift * (v.speed / 10)));
          const lng = Math.min(95, Math.max(79.5, v.lng + Math.sin(rad) * drift * (v.speed / 10)));
          const speed = Math.max(0, Math.round((v.speed + (Math.random() - 0.5) * 1.6) * 10) / 10);
          const course = Math.round((v.course + (Math.random() - 0.5) * 12 + 360) % 360);
          const zone = zoneOf({ lat, lng }, d.zones);
          const behaviours: VesselBehaviour[] = [...v.behaviours];
          if (zone && (zone.classification === "Restricted" || zone.classification === "Critical") && !behaviours.includes("Restricted zone entry")) {
            behaviours.push("Restricted zone entry");
          }
          if (speed < 1.2 && !behaviours.includes("Loitering") && Math.random() > 0.75) behaviours.push("Loitering");
          const risk = v.id === "VS-001" ? Math.min(100, Math.max(80, v.risk + Math.round((Math.random() - 0.5) * 3))) : computeRisk(behaviours, zone, speed);
          const next: Vessel = {
            ...v,
            lat: Math.round(lat * 1000) / 1000,
            lng: Math.round(lng * 1000) / 1000,
            speed,
            course,
            risk,
            behaviours,
            zoneId: zone?.id ?? null,
            trail: [...v.trail.slice(-14), [Math.round(lat * 1000) / 1000, Math.round(lng * 1000) / 1000]],
            lastUpdate: nowIso(),
          };
          const wasFlagged = d.alerts.some((a) => a.vesselId === v.id && (a.status === "New" || a.status === "Investigating"));
          if (risk >= 62 && !wasFlagged && Math.random() > 0.55) {
            newAlerts.push({
              id: uid("AL"),
              ts: nowIso(),
              vesselId: v.id,
              vesselName: v.name,
              lat: next.lat,
              lng: next.lng,
              zoneName: zone?.name ?? "Open water",
              threatType: threatTypeFor(behaviours),
              risk,
              severity: severityFromScore(risk),
              status: "New",
              behaviours: behaviours.length ? behaviours : ["Behavioural anomaly"],
            });
          }
          return next;
        });
        if (newAlerts.length) d.alerts = [...newAlerts, ...d.alerts].slice(0, 150);
        d.weather = {
          ...d.weather,
          updatedAt: nowIso(),
          windKts: Math.max(4, Math.round(d.weather.windKts + (Math.random() - 0.5) * 2)),
          waveM: Math.max(0.4, Math.round((d.weather.waveM + (Math.random() - 0.5) * 0.3) * 10) / 10),
          visibilityKm: Math.max(1, Math.round(d.weather.visibilityKm + (Math.random() - 0.5) * 1.5)),
        };
        d.sources = d.sources.map((s) =>
          s.status === "connected" ? { ...s, lastSync: nowIso() } : s,
        );
      },
      { persist: false },
    );
    for (const a of newAlerts) {
      store.notify({
        title: `${a.severity} alert — ${a.vesselName}`,
        body: `${a.threatType} • risk ${a.risk} • ${a.zoneName}`,
        audience: "command",
        severity: a.severity,
        link: "/command/alerts",
      });
    }
    if (state.tick % 8 === 0) persist();
  },
};

export function useMs<T>(selector: (s: MsState) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.get()),
    () => selector(store.getServer()),
  );
}

export function useMsState(): MsState {
  return useSyncExternalStore(store.subscribe, store.get, store.getServer);
}
