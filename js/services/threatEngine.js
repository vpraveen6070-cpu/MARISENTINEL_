/**
 * MARISENTINEL — Threat Classification Engine
 * Predicts tactical threat category based on risk score and behavioral indicators.
 */

function classifyThreat(vessel, riskScore) {
  if (riskScore > 70) {
    if (vessel.aisOff && vessel.inRestrictedZone) {
      return "Dark Activity / Smuggling";
    }

    if (vessel.inRestrictedZone && vessel.speed < 5) {
      return "Illegal Fishing";
    }

    if (vessel.routeDeviation && vessel.nearBorder) {
      return "Border Intrusion";
    }

    if (vessel.loitering) {
      return "Suspicious Loitering";
    }

    // Default high-risk categorization
    return "High Threat Intrusion";
  }

  if (riskScore > 30) {
    if (vessel.speedChange > 40) {
      return "Anomalous Behavior";
    }
    if (vessel.nearHighRiskArea) {
      return "High Risk Transit";
    }
    if (vessel.aisOff) {
      return "AIS Blackout";
    }
    return "Elevated Caution";
  }

  return "Normal";
}

// Attach to window for standard browser script execution
if (typeof window !== "undefined") {
  window.classifyThreat = classifyThreat;
  window.MS_THREAT = { classifyThreat };
}
