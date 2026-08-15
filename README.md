# MARISENTINEL — Autonomous Maritime Intelligence & Coastal Security Platform

A maritime digital twin that fuses vessel traffic, satellite tasking and marine weather, detects suspicious behaviour with a transparent rule-based engine, and drives the full response chain from alert to field closure — across administrator, command and field consoles.

## Features

- **Live Maritime Map**: Leaflet + OpenStreetMap chart of the Bay of Bengal with vessel markers, trails, and layered security zones.
- **Threat Risk Scoring**: Rule-based detection engine scoring vessels (0–100) based on zone entry, AIS loss, loitering, speed, and route anomalies.
- **Incident Lifecycle Management**: Alert → investigation → incident → field assignment → evidence → review → closure, with a complete audit trail.
- **Digital Twin & Forecasting**: Layered environment twin with weather, satellite footprints, and predictive threat analytics.
- **Three Operational Roles**:
  - **Administrator**: Users, zones, data sources, threat rules, system health, audit logs (`admin` / `admin123`)
  - **Command Officer**: Live monitoring, alerts, threat analysis, incidents, assignments, evidence (`command` / `command123`)
  - **Field Officer**: Assigned missions, mission map, status updates, evidence, final reports (`field` / `field123`)

## Development

```sh
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Tech Stack

- TanStack Start / React Router
- React 19
- TypeScript
- Tailwind CSS
- Vite
- Leaflet / Recharts / Lucide Icons
