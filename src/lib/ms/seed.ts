import type {
  Alert,
  AuditLog,
  DataSource,
  Evidence,
  Incident,
  MsState,
  Notification,
  ThreatRule,
  User,
  Vessel,
  VesselBehaviour,
  Zone,
} from "./types";
import { computeRisk, severityFromScore, threatTypeFor, zoneOf } from "./threat";

/** Deterministic PRNG so demo data is stable across reloads. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const iso = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60000).toISOString();

export const ZONES: Zone[] = [
  { id: "ZN-01", name: "Chennai Approach Corridor", classification: "Monitoring", priority: "Medium", status: "active", lat: 13.05, lng: 80.6, radiusKm: 60 },
  { id: "ZN-02", name: "Visakhapatnam Naval Restricted", classification: "Restricted", priority: "High", status: "active", lat: 17.68, lng: 83.45, radiusKm: 48 },
  { id: "ZN-03", name: "Paradip Offshore Watch", classification: "Normal", priority: "Low", status: "active", lat: 20.2, lng: 86.9, radiusKm: 55 },
  { id: "ZN-04", name: "Sundarban Border Zone", classification: "High Risk", priority: "High", status: "active", lat: 21.3, lng: 89.2, radiusKm: 70 },
  { id: "ZN-05", name: "Andaman Strategic Zone", classification: "Critical", priority: "High", status: "active", lat: 11.9, lng: 92.6, radiusKm: 95 },
  { id: "ZN-06", name: "Sri Lanka Gap Transit", classification: "Monitoring", priority: "Medium", status: "active", lat: 8.9, lng: 82.6, radiusKm: 85 },
  { id: "ZN-07", name: "Central Bay Deep Water", classification: "Normal", priority: "Low", status: "active", lat: 15.5, lng: 88.4, radiusKm: 130 },
  { id: "ZN-08", name: "Kakinada Energy Field", classification: "Restricted", priority: "High", status: "active", lat: 16.5, lng: 82.7, radiusKm: 40 },
];

const VESSEL_SPECS: Array<[string, string, string]> = [
  ["MV Ocean Star", "Panama", "Cargo"],
  ["MV Bengal Trader", "India", "Bulk Carrier"],
  ["FV Sea Pearl", "Sri Lanka", "Fishing"],
  ["MT Coral Dawn", "Singapore", "Tanker"],
  ["MV Andaman Breeze", "India", "Container"],
  ["FV Blue Horizon", "Bangladesh", "Fishing"],
  ["MT Delta Spirit", "Liberia", "Tanker"],
  ["MV Padma Express", "Bangladesh", "Cargo"],
  ["MV Silver Wake", "Marshall Islands", "Container"],
  ["FV Nishan", "India", "Fishing"],
  ["MV Cyclone Runner", "Malta", "Bulk Carrier"],
  ["MT Orient Flame", "Panama", "Tanker"],
  ["MV Coromandel", "India", "Cargo"],
  ["FV Tamil Wave", "India", "Fishing"],
  ["MV Yangon Pride", "Myanmar", "Cargo"],
  ["MV Nicobar Link", "India", "Ferry"],
  ["MT Gulf Meridian", "UAE", "Tanker"],
  ["MV Chittagong Star", "Bangladesh", "Container"],
  ["FV Deep Catch", "Thailand", "Fishing"],
  ["MV Survey Aditi", "India", "Research"],
  ["MV Kolkata Voyager", "India", "Cargo"],
  ["FV Ranong Light", "Thailand", "Fishing"],
];

const PORTS = ["Chennai", "Visakhapatnam", "Kolkata", "Port Blair", "Colombo", "Chittagong", "Yangon", "Paradip"];

function makeVessels(): Vessel[] {
  const rand = rng(20260815);
  const vessels: Vessel[] = VESSEL_SPECS.map(([name, flag, type], i) => {
    const lat = 6.5 + rand() * 14.5;
    const lng = 80.5 + rand() * 12.5;
    const speed = Math.round((1 + rand() * 19) * 10) / 10;
    const course = Math.round(rand() * 359);
    const behaviours: VesselBehaviour[] = [];
    const roll = rand();
    if (roll > 0.82) behaviours.push("Loitering");
    if (roll > 0.9) behaviours.push("Speed anomaly");
    if (roll > 0.72 && roll < 0.8) behaviours.push("Route deviation");
    const trail: Array<[number, number]> = Array.from({ length: 6 }, (_, k) => [
      lat - (6 - k) * 0.09 * (rand() > 0.5 ? 1 : -1),
      lng - (6 - k) * 0.11,
    ]);
    const zone = zoneOf({ lat, lng }, ZONES);
    if (zone && (zone.classification === "Restricted" || zone.classification === "Critical") && roll > 0.55) {
      behaviours.push("Restricted zone entry");
    }
    return {
      id: `VS-${String(i + 1).padStart(3, "0")}`,
      name,
      mmsi: `41${String(1000000 + Math.floor(rand() * 8999999)).slice(0, 7)}`,
      imo: `9${String(100000 + Math.floor(rand() * 899999)).slice(0, 6)}`,
      type,
      flag,
      speed,
      course,
      lat: Math.round(lat * 1000) / 1000,
      lng: Math.round(lng * 1000) / 1000,
      ais: rand() > 0.92 ? "lost" : "active",
      risk: 0,
      behaviours,
      trail,
      zoneId: zone?.id ?? null,
      lastUpdate: iso(Math.floor(rand() * 9)),
      destination: PORTS[Math.floor(rand() * PORTS.length)]!,
    };
  });

  // Preloaded demonstration scenario — MV Ocean Star, critical threat.
  const star = vessels[0]!;
  star.lat = 11.72;
  star.lng = 92.48;
  star.speed = 0.6;
  star.course = 118;
  star.ais = "lost";
  star.zoneId = "ZN-05";
  star.destination = "Unknown";
  star.behaviours = [
    "Restricted zone entry",
    "AIS interruption",
    "Speed anomaly",
    "Route deviation",
    "Extended presence in sensitive area",
  ];
  star.trail = [
    [12.6, 93.6],
    [12.35, 93.25],
    [12.1, 92.98],
    [11.95, 92.74],
    [11.82, 92.58],
    [11.72, 92.48],
  ];

  for (const v of vessels) {
    const zone = ZONES.find((z) => z.id === v.zoneId) ?? null;
    v.risk = v.id === "VS-001" ? 87 : computeRisk(v.behaviours, zone, v.speed);
  }
  return vessels;
}

const USERS: User[] = [
  { id: "USR-001", name: "R. Menon", username: "admin", password: "admin123", role: "administrator", region: "National HQ", status: "active", lastLogin: iso(35) },
  { id: "USR-002", name: "Cmdr A. Rao", username: "command", password: "command123", role: "command", region: "Bay of Bengal — East", status: "active", lastLogin: iso(12) },
  { id: "USR-003", name: "Cmdr S. Iyer", username: "command2", password: "command123", role: "command", region: "Bay of Bengal — West", status: "active", lastLogin: iso(180) },
  { id: "USR-004", name: "Officer K. Das", username: "field", password: "field123", role: "field", region: "Port Blair", status: "active", lastLogin: iso(8), lat: 11.62, lng: 92.72, availability: "available", currentAssignment: null },
  { id: "USR-005", name: "Officer P. Nair", username: "field2", password: "field123", role: "field", region: "Chennai", status: "active", lastLogin: iso(65), lat: 13.08, lng: 80.29, availability: "available", currentAssignment: null },
  { id: "USR-006", name: "Officer M. Barua", username: "field3", password: "field123", role: "field", region: "Visakhapatnam", status: "active", lastLogin: iso(240), lat: 17.7, lng: 83.3, availability: "on-mission", currentAssignment: "INC-1002" },
  { id: "USR-007", name: "Officer J. Roy", username: "field4", password: "field123", role: "field", region: "Kolkata", status: "active", lastLogin: iso(600), lat: 21.65, lng: 88.3, availability: "available", currentAssignment: null },
  { id: "USR-008", name: "Officer T. Sen", username: "field5", password: "field123", role: "field", region: "Paradip", status: "disabled", lastLogin: iso(4300), lat: 20.26, lng: 86.68, availability: "off-duty", currentAssignment: null },
];

const SOURCES: DataSource[] = [
  { id: "SRC-AIS", name: "Coastal AIS Feed (terrestrial + satellite)", kind: "AIS", status: "connected", lastSync: iso(1), meta: { vessels: 22, apiStatus: "200 OK", latencyMs: 340, endpoint: "https://ais.example.gov/v1/stream" } },
  { id: "SRC-SAT", name: "EO Satellite Imagery Grid", kind: "Satellite", status: "connected", lastSync: iso(26), meta: { imagery: "Available", resolution: "3 m", nextPass: "42 min", endpoint: "https://sat.example.gov/v2/scenes" } },
  { id: "SRC-WX", name: "Marine Weather & Wave Model", kind: "Weather", status: "connected", lastSync: iso(6), meta: { wind: "18 kt SW", wave: "2.1 m", visibility: "9 km", endpoint: "https://wx.example.gov/marine" } },
];

const RULES: ThreatRule[] = [
  { id: "RL-01", name: "Unauthorized zone entry", description: "Vessel enters a restricted or critical security zone without clearance.", severity: "Critical", enabled: true, threshold: "Any entry", lastTriggered: iso(14) },
  { id: "RL-02", name: "Sudden course change", description: "Heading change beyond threshold within a short window.", severity: "Medium", enabled: true, threshold: "> 45° / 10 min", lastTriggered: iso(88) },
  { id: "RL-03", name: "Vessel loitering", description: "Vessel remains near-stationary inside a monitored area.", severity: "High", enabled: true, threshold: "< 1.5 kt for 40 min", lastTriggered: iso(21) },
  { id: "RL-04", name: "Speed anomaly", description: "Speed deviates strongly from the vessel-class profile.", severity: "Medium", enabled: true, threshold: "± 60% of profile", lastTriggered: iso(52) },
  { id: "RL-05", name: "AIS disabled", description: "AIS transponder stops reporting while under surveillance.", severity: "Critical", enabled: true, threshold: "No signal > 12 min", lastTriggered: iso(9) },
  { id: "RL-06", name: "Repeated route deviation", description: "Track repeatedly departs the declared voyage plan.", severity: "High", enabled: true, threshold: "> 3 deviations / 24 h", lastTriggered: iso(310) },
  { id: "RL-07", name: "Suspicious proximity", description: "Two vessels rendezvous outside a designated anchorage.", severity: "High", enabled: true, threshold: "< 300 m for 15 min", lastTriggered: iso(420) },
  { id: "RL-08", name: "Restricted-area movement", description: "Movement pattern inside a restricted area outside permitted hours.", severity: "High", enabled: false, threshold: "Any track 22:00–05:00", lastTriggered: null },
];

function makeAlerts(vessels: Vessel[]): Alert[] {
  const star = vessels[0]!;
  const base: Alert[] = [
    {
      id: "AL-1001",
      ts: iso(11),
      vesselId: star.id,
      vesselName: star.name,
      lat: star.lat,
      lng: star.lng,
      zoneName: "Andaman Strategic Zone",
      threatType: "Unauthorized zone entry",
      risk: 87,
      severity: "Critical",
      status: "New",
      behaviours: star.behaviours,
    },
  ];
  const candidates = vessels.filter((v) => v.risk > 34 && v.id !== "VS-001").slice(0, 7);
  candidates.forEach((v, i) => {
    const zone = ZONES.find((z) => z.id === v.zoneId);
    base.push({
      id: `AL-${1002 + i}`,
      ts: iso(25 + i * 37),
      vesselId: v.id,
      vesselName: v.name,
      lat: v.lat,
      lng: v.lng,
      zoneName: zone?.name ?? "Open water",
      threatType: threatTypeFor(v.behaviours),
      risk: v.risk,
      severity: severityFromScore(v.risk),
      status: (["New", "Investigating", "Resolved", "False Alarm", "Confirmed"] as const)[i % 5]!,
      behaviours: v.behaviours.length ? v.behaviours : ["Behavioural anomaly"],
    });
  });
  return base;
}

function makeIncidents(vessels: Vessel[]): Incident[] {
  const v2 = vessels[3]!;
  const v3 = vessels[6]!;
  return [
    {
      id: "INC-1002",
      title: "Loitering tanker near Visakhapatnam restricted waters",
      vesselId: v2.id,
      vesselName: v2.name,
      alertId: null,
      lat: 17.61,
      lng: 83.52,
      category: "Vessel loitering",
      riskLevel: "High",
      risk: 68,
      description:
        "Tanker observed near-stationary for 3 hours inside the naval restricted perimeter. Boarding team dispatched.",
      detectedAt: iso(320),
      assignedTo: "USR-006",
      assignedAt: iso(300),
      deadline: iso(-120),
      status: "In Progress",
      missionStatus: "On Scene",
      timeline: [
        { ts: iso(320), actor: "System", status: "Detected", note: "Rule RL-03 triggered — loitering inside ZN-02." },
        { ts: iso(310), actor: "Cmdr A. Rao", status: "Investigating", note: "Alert confirmed, incident opened." },
        { ts: iso(300), actor: "Cmdr A. Rao", status: "Assigned", note: "Assigned to Officer M. Barua." },
        { ts: iso(280), actor: "Officer M. Barua", status: "Accepted", note: "Assignment accepted." },
        { ts: iso(210), actor: "Officer M. Barua", status: "En Route", note: "Patrol craft departed Vizag jetty." },
        { ts: iso(140), actor: "Officer M. Barua", status: "On Scene", note: "Visual contact established with target vessel." },
      ],
      report: null,
      closedAt: null,
    },
    {
      id: "INC-1001",
      title: "AIS blackout during night transit off Sundarban",
      vesselId: v3.id,
      vesselName: v3.name,
      alertId: null,
      lat: 21.15,
      lng: 89.05,
      category: "AIS blackout",
      riskLevel: "Critical",
      risk: 84,
      description: "Transponder silence for 46 minutes inside the high-risk border zone.",
      detectedAt: iso(2600),
      assignedTo: "USR-007",
      assignedAt: iso(2580),
      deadline: iso(2200),
      status: "Closed",
      missionStatus: "Completed",
      timeline: [
        { ts: iso(2600), actor: "System", status: "Detected", note: "Rule RL-05 triggered." },
        { ts: iso(2580), actor: "Cmdr S. Iyer", status: "Assigned", note: "Assigned to Officer J. Roy." },
        { ts: iso(2500), actor: "Officer J. Roy", status: "On Scene", note: "Intercepted vessel, documents verified." },
        { ts: iso(2440), actor: "Officer J. Roy", status: "Completed", note: "Transponder fault confirmed, warning issued." },
        { ts: iso(2400), actor: "Cmdr S. Iyer", status: "Closed", note: "Reviewed and closed. No further action." },
      ],
      report: {
        finalStatus: "Resolved — equipment fault",
        findings: "AIS transponder power failure. Crew and cargo manifest verified as declared.",
        actionTaken: "Written warning issued, vessel escorted to declared route.",
        notes: "Recommend follow-up inspection at next port call.",
        completedAt: iso(2440),
      },
      closedAt: iso(2400),
    },
  ];
}

const EVIDENCE: Evidence[] = [
  { id: "EV-2001", incidentId: "INC-1002", type: "Photograph", description: "Starboard hull and registration markings", ts: iso(135), lat: 17.61, lng: 83.52, notes: "Name partially painted over.", fileName: "hull-marking.jpg", submittedBy: "Officer M. Barua" },
  { id: "EV-2002", incidentId: "INC-1002", type: "Observation", description: "Crew activity on deck", ts: iso(120), lat: 17.61, lng: 83.52, notes: "Four crew observed moving unmarked containers.", fileName: null, submittedBy: "Officer M. Barua" },
  { id: "EV-1901", incidentId: "INC-1001", type: "Document", description: "Cargo manifest scan", ts: iso(2470), lat: 21.15, lng: 89.05, notes: "Matches declared cargo.", fileName: "manifest.pdf", submittedBy: "Officer J. Roy" },
];

const AUDIT: AuditLog[] = [
  { id: "LG-1", ts: iso(4), user: "system", role: "system", action: "Threat engine cycle completed", module: "Detection", ip: "internal", status: "success" },
  { id: "LG-2", ts: iso(11), user: "system", role: "system", action: "Critical alert AL-1001 generated", module: "Alerts", ip: "internal", status: "success" },
  { id: "LG-3", ts: iso(12), user: "command", role: "command", action: "Signed in", module: "Auth", ip: "10.24.6.11 / desktop", status: "success" },
  { id: "LG-4", ts: iso(35), user: "admin", role: "administrator", action: "Signed in", module: "Auth", ip: "10.24.1.4 / desktop", status: "success" },
  { id: "LG-5", ts: iso(60), user: "admin", role: "administrator", action: "Connected data source SRC-SAT", module: "Data Sources", ip: "10.24.1.4 / desktop", status: "success" },
  { id: "LG-6", ts: iso(140), user: "field3", role: "field", action: "Mission status set to On Scene (INC-1002)", module: "Field Ops", ip: "10.61.4.9 / mobile", status: "success" },
  { id: "LG-7", ts: iso(300), user: "command", role: "command", action: "Assigned INC-1002 to USR-006", module: "Assignments", ip: "10.24.6.11 / desktop", status: "success" },
  { id: "LG-8", ts: iso(310), user: "command", role: "command", action: "Confirmed threat and opened INC-1002", module: "Incidents", ip: "10.24.6.11 / desktop", status: "success" },
  { id: "LG-9", ts: iso(900), user: "unknown", role: "system", action: "Failed sign-in attempt (bad password)", module: "Auth", ip: "203.0.113.44 / unknown", status: "failed" },
  { id: "LG-10", ts: iso(2400), user: "command2", role: "command", action: "Closed incident INC-1001", module: "Incidents", ip: "10.24.7.2 / desktop", status: "success" },
  { id: "LG-11", ts: iso(2600), user: "admin", role: "administrator", action: "Created security zone ZN-05", module: "Security Zones", ip: "10.24.1.4 / desktop", status: "success" },
];

const NOTIFICATIONS: Notification[] = [
  { id: "NT-1", ts: iso(11), title: "CRITICAL: MV Ocean Star", body: "Risk 87 — unauthorized entry into Andaman Strategic Zone with AIS interruption.", audience: "command", severity: "Critical", read: false, link: "/command/alerts" },
  { id: "NT-2", ts: iso(28), title: "Suspicious vessel detected", body: "Loitering pattern flagged in Kakinada Energy Field.", audience: "command", severity: "High", read: false, link: "/command/threats" },
  { id: "NT-3", ts: iso(140), title: "Field update received", body: "Officer M. Barua is On Scene for INC-1002.", audience: "command", severity: "Info", read: true, link: "/command/incidents" },
  { id: "NT-4", ts: iso(300), title: "New assignment", body: "INC-1002 assigned — Visakhapatnam restricted waters.", audience: "field", severity: "High", read: true, link: "/field/assignments" },
  { id: "NT-5", ts: iso(60), title: "Data source connected", body: "EO Satellite Imagery Grid is streaming again.", audience: "administrator", severity: "Info", read: true, link: "/admin/sources" },
];

export function createSeed(): MsState {
  const vessels = makeVessels();
  return {
    users: USERS,
    zones: ZONES,
    vessels,
    alerts: makeAlerts(vessels),
    incidents: makeIncidents(vessels),
    evidence: EVIDENCE,
    sources: SOURCES,
    rules: RULES,
    audit: AUDIT,
    notifications: NOTIFICATIONS,
    weather: {
      updatedAt: iso(6),
      windKts: 18,
      windDir: "SW",
      waveM: 2.1,
      visibilityKm: 9,
      seaState: "Moderate",
      advisory: "Squall line expected over the eastern bay within 12 hours.",
    },
    session: null,
    simRunning: true,
    hydrated: true,
    tick: 0,
  };
}

export const EMPTY_STATE: MsState = {
  users: [],
  zones: [],
  vessels: [],
  alerts: [],
  incidents: [],
  evidence: [],
  sources: [],
  rules: [],
  audit: [],
  notifications: [],
  weather: { updatedAt: "", windKts: 0, windDir: "", waveM: 0, visibilityKm: 0, seaState: "", advisory: "" },
  session: null,
  simRunning: false,
  hydrated: false,
  tick: 0,
};
