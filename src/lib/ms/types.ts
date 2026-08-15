export type Role = "administrator" | "command" | "field";

export type UserStatus = "active" | "disabled";

export interface User {
  id: string;
  name: string;
  username: string;
  password: string;
  role: Role;
  region: string;
  status: UserStatus;
  lastLogin: string | null;
  /** field officers only */
  lat?: number;
  lng?: number;
  availability?: "available" | "on-mission" | "off-duty";
  currentAssignment?: string | null;
}

export type ZoneClass = "Normal" | "Monitoring" | "Restricted" | "High Risk" | "Critical";

export interface Zone {
  id: string;
  name: string;
  classification: ZoneClass;
  priority: "Low" | "Medium" | "High";
  status: "active" | "inactive";
  lat: number;
  lng: number;
  radiusKm: number;
  notes?: string;
}

export type VesselBehaviour =
  | "Restricted zone entry"
  | "AIS interruption"
  | "Speed anomaly"
  | "Sudden course change"
  | "Loitering"
  | "Route deviation"
  | "Suspicious proximity"
  | "Extended presence in sensitive area";

export interface Vessel {
  id: string;
  name: string;
  mmsi: string;
  imo: string;
  type: string;
  flag: string;
  speed: number;
  course: number;
  lat: number;
  lng: number;
  ais: "active" | "lost";
  risk: number;
  behaviours: VesselBehaviour[];
  trail: Array<[number, number]>;
  zoneId: string | null;
  lastUpdate: string;
  destination: string;
}

export type Severity = "Low" | "Medium" | "High" | "Critical";
export type AlertStatus = "New" | "Investigating" | "Confirmed" | "False Alarm" | "Resolved";

export interface Alert {
  id: string;
  ts: string;
  vesselId: string;
  vesselName: string;
  lat: number;
  lng: number;
  zoneName: string;
  threatType: string;
  risk: number;
  severity: Severity;
  status: AlertStatus;
  behaviours: string[];
}

export type IncidentStatus =
  | "Open"
  | "Investigating"
  | "Assigned"
  | "In Progress"
  | "Awaiting Review"
  | "Closed";

export interface TimelineEntry {
  ts: string;
  actor: string;
  status: string;
  note: string;
}

export interface Incident {
  id: string;
  title: string;
  vesselId: string;
  vesselName: string;
  alertId: string | null;
  lat: number;
  lng: number;
  category: string;
  riskLevel: Severity;
  risk: number;
  description: string;
  detectedAt: string;
  assignedTo: string | null;
  assignedAt: string | null;
  deadline: string | null;
  status: IncidentStatus;
  missionStatus:
    | "Assigned"
    | "Accepted"
    | "En Route"
    | "On Scene"
    | "Investigating"
    | "Evidence Submitted"
    | "Completed"
    | null;
  timeline: TimelineEntry[];
  report: {
    finalStatus: string;
    findings: string;
    actionTaken: string;
    notes: string;
    completedAt: string;
  } | null;
  closedAt: string | null;
}

export type EvidenceType = "Photograph" | "Video" | "Document" | "Observation" | "Sensor Data";

export interface Evidence {
  id: string;
  incidentId: string;
  type: EvidenceType;
  description: string;
  ts: string;
  lat: number;
  lng: number;
  notes: string;
  fileName: string | null;
  submittedBy: string;
}

export interface DataSource {
  id: string;
  name: string;
  kind: "AIS" | "Satellite" | "Weather";
  status: "connected" | "disconnected" | "degraded";
  lastSync: string;
  meta: Record<string, string | number>;
}

export interface ThreatRule {
  id: string;
  name: string;
  description: string;
  severity: Severity;
  enabled: boolean;
  threshold: string;
  lastTriggered: string | null;
}

export interface AuditLog {
  id: string;
  ts: string;
  user: string;
  role: Role | "system";
  action: string;
  module: string;
  ip: string;
  status: "success" | "failed";
}

export interface Notification {
  id: string;
  ts: string;
  title: string;
  body: string;
  audience: Role | "all";
  severity: Severity | "Info";
  read: boolean;
  link?: string;
}

export interface Weather {
  updatedAt: string;
  windKts: number;
  windDir: string;
  waveM: number;
  visibilityKm: number;
  seaState: string;
  advisory: string;
}

export interface Session {
  userId: string;
  name: string;
  role: Role;
  loginAt: string;
}

export interface MsState {
  users: User[];
  zones: Zone[];
  vessels: Vessel[];
  alerts: Alert[];
  incidents: Incident[];
  evidence: Evidence[];
  sources: DataSource[];
  rules: ThreatRule[];
  audit: AuditLog[];
  notifications: Notification[];
  weather: Weather;
  session: Session | null;
  simRunning: boolean;
  hydrated: boolean;
  tick: number;
}
