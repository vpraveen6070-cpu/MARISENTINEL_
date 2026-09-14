# MARISENTINEL — Autonomous Maritime Intelligence & Coastal Security Platform

A full-spectrum maritime digital twin and coastal security platform that fuses live vessel telemetry, satellite tasking, and marine weather, detects suspicious behaviour with a transparent AI rule-based scoring engine, and coordinates the entire tactical response chain from threat alert to field unit dispatch and mission closure.

## 🎯 Key Capabilities & Role Portals

### 🔑 1. Administrator Console (`admin.html`)
- **Operator User Management**: Add, edit, enable/disable accounts with role-based access control (Administrator, Command Officer, Field Officer).
- **Geofenced Security Zones**: Create and manage operational perimeters (Normal, Monitoring, Restricted, High-Risk, Critical) across the Bay of Bengal.
- **Data Feeds & Integrations**: Live telemetry connectors for AIS Vessel Tracking, Coastal Radar, Satellite SAR, and Marine Weather API.
- **Threat Rule Configuration**: Configurable AI heuristic detection rules and penalty weights (Zone Intrusion, Dark Vessel / AIS Blackout, Speed Anomalies, Nighttime Loitering).
- **Security Audit Logs**: Immutable chronological activity trail of all operator actions and system state transitions.

### 📡 2. Command Officer Console (`command.html`)
- **Live Maritime Map**: Leaflet interactive tactical map showing vessels, threat vectors, zones, and field interceptor units.
- **Vessel Intelligence Profile**: Click-to-inspect vessel telemetry, MMSI, heading, course speed, AIS transponder status, and detected violations.
- **Threat Scoring Engine**: 0–100 Risk Score calculation with real-time classification (Green = Safe, Amber = Elevated, Red = Critical).
- **Alert Dispatch Flow**: Review real-time threat alerts, dismiss false alarms, or confirm and deploy field interceptors.
- **Incident Response Management**: Convert alerts to tactical incident dossiers, monitor live operational timelines, and close archived cases.
- **Analytics & Threat Forecast**: Response time metrics, coastal area coverage, category donuts, and threat distribution charts.

### 👨‍✈️ 3. Field Officer Console (`field.html`)
- **Tactical Mission Assignments**: Real-time dispatch queue with Accept and Decline actions.
- **Mission Map & Live Movement**: High-resolution sector map with intercept route vectors and real-time boat movement simulation.
- **6-Stage Status Workflow**: `Assigned` &rarr; `Accepted` &rarr; `En Route` &rarr; `On Scene` &rarr; `Investigating` &rarr; `Completed`.
- **Field Observation Log**: On-scene instant note posting synchronized directly to Command Center timelines.
- **Evidence Vault**: Multi-asset evidence logging (Optical photos, FLIR thermal video, AIS frequency logs, Cargo manifests).
- **Final Closure Report**: Submit inspection findings and actions taken to Command for automated case closure.

---

## 🎨 Design System & Color Grading
- **Primary**: Deep Navy Slate `#0F172A`
- **Secondary (Safe / Normal)**: Tactical Emerald `#22C55E`
- **Tertiary (Threat / Critical)**: Alert Crimson `#EF4444`
- **Neutral**: Crisp Off-White `#F8FAFC`
- **Typography**: Google Fonts `Inter`

---

## 🚀 Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm run dev

# 3. Open in Browser
# http://localhost:5173/ or http://localhost:5174/
```

---

## 📁 Centralized Data Architecture (`/data/`)

All mock, seed, and operational datasets are organized into domain-specific JSON files in `/data/`:

- `vessels.json`: Active vessel telemetry, MMSI, coordinates, heading, and risk scores.
- `anomalies.json` / `threat-rules.json`: Configurable AI detection rules and penalty weights.
- `zones.json`: Geofenced security perimeters in the Bay of Bengal & Andaman Sea.
- `weather.json`: Sea state, wind speed, wave height, and coastal advisories.
- `alerts.json`: Active threat alerts and breach dossiers.
- `incidents.json`: Tactical incident dossiers and operational event logs.
- `users.json`: Role-based operator accounts (Administrator, Command, Field).
- `sources.json`: External radar, AIS, SAR, and weather telemetry connectors.
- `audit.json`: Immutable audit activity trail.
- `notifications.json`: Real-time system notifications.
- `radar-stations.json`: Coastal radar station coordinates and range radii.
- `maritime-boundaries.json`: EEZ and 12 NM territorial water coordinates.

### Dynamic Loading Usage:
```javascript
// Dynamic loader helper
const vessels = await loadData('vessels.json');

// Or via MS_DATA service
const zones = await window.MS_DATA.loadZones();
const allDatasets = await window.MS_DATA.loadAll();
```

