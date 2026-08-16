/**
 * MARISENTINEL — Initial Seed Dataset (Bay of Bengal Region)
 */

window.MS_SEED = {
  vessels: [
    {
      id: "VS-001",
      name: "MV Sagar Samrat",
      flag: "India",
      mmsi: "419000123",
      type: "Offshore Support",
      lat: 17.652,
      lng: 83.324,
      speed: 12.4,
      course: 45,
      risk: 84,
      ais: "intermittent",
      behaviours: ["Restricted zone entry", "Speed anomaly"],
      zoneId: "ZN-001",
      trail: [[17.61, 83.28], [17.63, 83.30], [17.652, 83.324]],
      lastUpdate: new Date().toISOString()
    },
    {
      id: "VS-002",
      name: "MT Ocean Pearl",
      flag: "Panama",
      mmsi: "354112000",
      type: "Crude Oil Tanker",
      lat: 19.82,
      lng: 86.15,
      speed: 0.4,
      course: 110,
      risk: 76,
      ais: "active",
      behaviours: ["Loitering", "Unusual anchorage"],
      zoneId: "ZN-003",
      trail: [[19.85, 86.10], [19.83, 86.13], [19.82, 86.15]],
      lastUpdate: new Date().toISOString()
    },
    {
      id: "VS-003",
      name: "FV Matsya Kanya",
      flag: "India",
      mmsi: "419887321",
      type: "Trawler",
      lat: 20.45,
      lng: 87.20,
      speed: 4.8,
      course: 190,
      risk: 32,
      ais: "active",
      behaviours: [],
      zoneId: "ZN-004",
      trail: [[20.50, 87.18], [20.47, 87.19], [20.45, 87.20]],
      lastUpdate: new Date().toISOString()
    },
    {
      id: "VS-004",
      name: "MV Bengal Pioneer",
      flag: "Bangladesh",
      mmsi: "405000456",
      type: "General Cargo",
      lat: 21.15,
      lng: 89.20,
      speed: 14.1,
      course: 135,
      risk: 24,
      ais: "active",
      behaviours: [],
      zoneId: "ZN-006",
      trail: [[21.20, 89.15], [21.17, 89.18], [21.15, 89.20]],
      lastUpdate: new Date().toISOString()
    },
    {
      id: "VS-005",
      name: "SS Eastern Star",
      flag: "Liberia",
      mmsi: "636015789",
      type: "Bulk Carrier",
      lat: 15.92,
      lng: 81.85,
      speed: 11.2,
      course: 60,
      risk: 68,
      ais: "lost",
      behaviours: ["AIS transponder blackout", "Course zigzag"],
      zoneId: "ZN-002",
      trail: [[15.85, 81.75], [15.89, 81.80], [15.92, 81.85]],
      lastUpdate: new Date().toISOString()
    },
    {
      id: "VS-006",
      name: "CG Baruna",
      flag: "India",
      mmsi: "419000999",
      type: "Patrol Vessel",
      lat: 17.70,
      lng: 83.45,
      speed: 22.0,
      course: 220,
      risk: 10,
      ais: "active",
      behaviours: [],
      zoneId: "ZN-001",
      trail: [[17.75, 83.50], [17.72, 83.47], [17.70, 83.45]],
      lastUpdate: new Date().toISOString()
    },
    {
      id: "VS-007",
      name: "MT Golden Horizon",
      flag: "Marshall Islands",
      mmsi: "538004123",
      type: "Chemical Tanker",
      lat: 16.45,
      lng: 82.35,
      speed: 13.5,
      course: 310,
      risk: 18,
      ais: "active",
      behaviours: [],
      zoneId: null,
      trail: [[16.38, 82.42], [16.42, 82.38], [16.45, 82.35]],
      lastUpdate: new Date().toISOString()
    },
    {
      id: "VS-008",
      name: "FV Jal Deep",
      flag: "India",
      mmsi: "419772111",
      type: "Fishing Boat",
      lat: 18.25,
      lng: 84.15,
      speed: 3.2,
      course: 85,
      risk: 54,
      ais: "intermittent",
      behaviours: ["Nighttime dark vessel"],
      zoneId: null,
      trail: [[18.22, 84.10], [18.24, 84.12], [18.25, 84.15]],
      lastUpdate: new Date().toISOString()
    },
    {
      id: "VS-009",
      name: "MV Andaman Express",
      flag: "India",
      mmsi: "419000555",
      type: "Passenger Ferry",
      lat: 12.15,
      lng: 92.75,
      speed: 16.8,
      course: 15,
      risk: 12,
      ais: "active",
      behaviours: [],
      zoneId: "ZN-008",
      trail: [[12.05, 92.70], [12.10, 92.72], [12.15, 92.75]],
      lastUpdate: new Date().toISOString()
    },
    {
      id: "VS-010",
      name: "MT Southern Breeze",
      flag: "Singapore",
      mmsi: "563001888",
      type: "LPG Tanker",
      lat: 14.50,
      lng: 80.85,
      speed: 14.2,
      course: 25,
      risk: 42,
      ais: "active",
      behaviours: ["Speed anomaly"],
      zoneId: null,
      trail: [[14.40, 80.80], [14.45, 80.82], [14.50, 80.85]],
      lastUpdate: new Date().toISOString()
    }
  ],

  zones: [
    {
      id: "ZN-001",
      name: "Visakhapatnam Naval Anchorage",
      classification: "Critical",
      lat: 17.68,
      lng: 83.35,
      radiusKm: 28,
      status: "active",
      description: "Eastern Naval Command core operational anchorage."
    },
    {
      id: "ZN-002",
      name: "Kakinada Offshore Energy Hub",
      classification: "High Risk",
      lat: 16.95,
      lng: 82.40,
      radiusKm: 32,
      status: "active",
      description: "Natural gas extraction platforms and deepwater drilling rigs."
    },
    {
      id: "ZN-003",
      name: "Paradip Strategic Approach",
      classification: "Restricted",
      lat: 20.25,
      lng: 86.70,
      radiusKm: 35,
      status: "active",
      description: "Commercial deepwater port and strategic crude terminal."
    },
    {
      id: "ZN-004",
      name: "Dhamra River Delta Sanctuary",
      classification: "Monitoring",
      lat: 20.80,
      lng: 87.05,
      radiusKm: 24,
      status: "active",
      description: "Ecological reserve & monitored coastal passage."
    },
    {
      id: "ZN-005",
      name: "Chennai Outer Roadstead",
      classification: "Restricted",
      lat: 13.15,
      lng: 80.35,
      radiusKm: 22,
      status: "active",
      description: "Major container corridor and naval vessel escort route."
    },
    {
      id: "ZN-006",
      name: "Sundarbans Maritime Border",
      classification: "Critical",
      lat: 21.65,
      lng: 89.15,
      radiusKm: 40,
      status: "active",
      description: "Transboundary international maritime boundary line."
    },
    {
      id: "ZN-007",
      name: "Gopalpur Defence Test Range",
      classification: "Critical",
      lat: 19.25,
      lng: 84.95,
      radiusKm: 30,
      status: "active",
      description: "Surface-to-air missile testing corridor."
    },
    {
      id: "ZN-008",
      name: "Port Blair Security Corridor",
      classification: "High Risk",
      lat: 11.68,
      lng: 92.75,
      radiusKm: 36,
      status: "active",
      description: "Andaman & Nicobar tri-service command sector."
    }
  ],

  alerts: [
    {
      id: "AL-1001",
      ts: new Date(Date.now() - 15 * 60000).toISOString(),
      vesselId: "VS-001",
      vesselName: "MV Sagar Samrat",
      threatType: "Restricted Zone Entry",
      risk: 84,
      severity: "Critical",
      zoneName: "Visakhapatnam Naval Anchorage",
      status: "New",
      lat: 17.652,
      lng: 83.324,
      behaviours: ["Restricted zone entry", "Speed anomaly"]
    },
    {
      id: "AL-1002",
      ts: new Date(Date.now() - 45 * 60000).toISOString(),
      vesselId: "VS-002",
      vesselName: "MT Ocean Pearl",
      threatType: "Prolonged Loitering",
      risk: 76,
      severity: "High",
      zoneName: "Paradip Strategic Approach",
      status: "Investigating",
      lat: 19.82,
      lng: 86.15,
      behaviours: ["Loitering", "Unusual anchorage"]
    },
    {
      id: "AL-1003",
      ts: new Date(Date.now() - 120 * 60000).toISOString(),
      vesselId: "VS-005",
      vesselName: "SS Eastern Star",
      threatType: "AIS Transponder Blackout",
      risk: 68,
      severity: "High",
      zoneName: "Kakinada Offshore Energy Hub",
      status: "Investigating",
      lat: 15.92,
      lng: 81.85,
      behaviours: ["AIS transponder blackout", "Course zigzag"]
    },
    {
      id: "AL-1004",
      ts: new Date(Date.now() - 240 * 60000).toISOString(),
      vesselId: "VS-008",
      vesselName: "FV Jal Deep",
      threatType: "Nighttime Dark Vessel",
      risk: 54,
      severity: "Medium",
      zoneName: "Open water",
      status: "Resolved",
      lat: 18.25,
      lng: 84.15,
      behaviours: ["Nighttime dark vessel"]
    }
  ],

  incidents: [
    {
      id: "INC-1001",
      title: "Unauthorized naval anchorage breach",
      category: "Security Intrusion",
      riskLevel: "Critical",
      risk: 84,
      status: "In Progress",
      vesselName: "MV Sagar Samrat",
      vesselId: "VS-001",
      detectedAt: new Date(Date.now() - 35 * 60000).toISOString(),
      assignedTo: "usr-field-1",
      deadline: new Date(Date.now() + 45 * 60000).toISOString(),
      lat: 17.652,
      lng: 83.324,
      description: "Support vessel entered the submarine transit channel without valid clearance.",
      missionStatus: "On-Mission",
      timeline: [
        { ts: new Date(Date.now() - 35 * 60000).toISOString(), actor: "Command System", status: "Alert Raised", note: "Rule violation triggered automatically." },
        { ts: new Date(Date.now() - 25 * 60000).toISOString(), actor: "Cdr. R. Menon", status: "Confirmed", note: "Confirmed incident and initiated interception." },
        { ts: new Date(Date.now() - 15 * 60000).toISOString(), actor: "Lt. M. Barua", status: "Dispatched", note: "Fast Interceptor Craft IC-114 underway." }
      ]
    },
    {
      id: "INC-1002",
      title: "Dark tanker loitering near refinery SPM",
      category: "Smuggling / Illegal STS",
      riskLevel: "High",
      risk: 76,
      status: "Investigating",
      vesselName: "MT Ocean Pearl",
      vesselId: "VS-002",
      detectedAt: new Date(Date.now() - 90 * 60000).toISOString(),
      assignedTo: "usr-field-2",
      deadline: new Date(Date.now() + 120 * 60000).toISOString(),
      lat: 19.82,
      lng: 86.15,
      description: "Crude tanker observed drifting without scheduled berth booking.",
      missionStatus: "On-Mission",
      timeline: [
        { ts: new Date(Date.now() - 90 * 60000).toISOString(), actor: "Radar Sentinel", status: "Detected", note: "Radar track established with no AIS correlation." },
        { ts: new Date(Date.now() - 60 * 60000).toISOString(), actor: "Cdr. R. Menon", status: "Assigned", note: "Assigned to Field Officer K. Das." }
      ]
    }
  ],

  users: [
    { id: "usr-admin-1", username: "admin", password: "admin123", name: "Dr. Arvind Rao", role: "administrator", status: "active", region: "Visakhapatnam HQ" },
    { id: "usr-cmd-1", username: "command", password: "command123", name: "Cdr. Rajesh Menon", role: "command", status: "active", region: "Eastern Naval Command" },
    { id: "usr-field-1", username: "field", password: "field123", name: "Lt. Manoj Barua", role: "field", status: "active", region: "Visakhapatnam Squadron", availability: "on-mission", lat: 17.68, lng: 83.38 },
    { id: "usr-field-2", username: "kdas", password: "field123", name: "Officer K. Das", role: "field", status: "active", region: "Paradip Station", availability: "on-mission", lat: 19.85, lng: 86.20 },
    { id: "usr-field-3", username: "sneha", password: "field123", name: "Lt. Sneha Roy", role: "field", status: "active", region: "Chennai Base", availability: "available", lat: 13.10, lng: 80.30 }
  ],

  sources: [
    { id: "SRC-01", name: "National Coastal AIS Grid", kind: "AIS Feed", status: "connected", lastSync: new Date().toISOString() },
    { id: "SRC-02", name: "Chain of Static Coastal Radars (CSCR)", kind: "Radar Feed", status: "connected", lastSync: new Date().toISOString() },
    { id: "SRC-03", name: "Sentinel-2 SAR Tasking Pipeline", kind: "Satellite Imagery", status: "connected", lastSync: new Date().toISOString() },
    { id: "SRC-04", name: "INCOIS High-Resolution Marine Weather", kind: "Weather Telemetry", status: "connected", lastSync: new Date().toISOString() }
  ],

  weather: {
    windKts: 18,
    windDir: "NE",
    waveM: 2.1,
    visibilityKm: 8.5,
    seaState: "Moderate (Sea State 4)",
    advisory: "Squall warning active for North-East quadrant. Small craft advisory.",
    updatedAt: new Date().toISOString()
  },

  audit: [
    { id: "AUD-01", ts: new Date(Date.now() - 5 * 60000).toISOString(), user: "admin", module: "Auth", action: "Administrator signed in from secure console", status: "success" },
    { id: "AUD-02", ts: new Date(Date.now() - 18 * 60000).toISOString(), user: "command", module: "Alerts", action: "Confirmed alert AL-1001 for MV Sagar Samrat", status: "success" },
    { id: "AUD-03", ts: new Date(Date.now() - 40 * 60000).toISOString(), user: "admin", module: "Security Zones", action: "Updated perimeter for Visakhapatnam Naval Anchorage", status: "success" }
  ],

  threatRules: [
    { id: "TR-01", name: "Restricted Zone Entry", weight: 35, description: "Vessel inside naval or strategic anchorage without transponder broadcast", status: "active" },
    { id: "TR-02", name: "AIS Transponder Blackout", weight: 30, description: "AIS signal lost for more than 45 minutes in coastal corridor", status: "active" },
    { id: "TR-03", name: "Prolonged Loitering", weight: 20, description: "Speed < 1.5 kts near critical infrastructure or single-point mooring", status: "active" },
    { id: "TR-04", name: "Erratic Zigzag Route", weight: 15, description: "Course deviations exceeding 45 degrees in designated shipping lane", status: "active" }
  ]
};
