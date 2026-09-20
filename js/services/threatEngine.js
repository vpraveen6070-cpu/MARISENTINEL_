/**
 * MARISENTINEL — Threat Classification Helper (Explanation & Fallback)
 * 
 * HYBRID AI ARCHITECTURE RULE:
 * The primary threat type is classified by the Machine Learning (Random Forest) model.
 * This helper provides fallback classification and heuristic tag resolution when ML
 * is offline or during client-side hydration.
 */

function classifyThreat(vessel, riskScore) {
  // If vessel already has an authoritative ML prediction, preserve it
  if (vessel && vessel.mlPrediction && vessel.mlPrediction.threatType) {
    return vessel.mlPrediction.threatType;
  }
  if (vessel && vessel.threatType && vessel.threatType !== "Normal" && vessel.threatType !== "Normal Transit") {
    return vessel.threatType;
  }

  // Fallback heuristic explanation logic
  const v = vessel || {};
  const score = typeof riskScore === "number" ? riskScore : (v.riskScore ?? v.risk ?? 0);

  if (v.aisOff && v.inRestrictedZone) {
    return "Dark Activity / Smuggling";
  }
  if (v.loitering && v.nearHighRiskArea) {
    return "Suspicious Loitering";
  }
  if (v.inRestrictedZone && (v.speed < 5 || v.speed === 0)) {
    return "Illegal Fishing";
  }
  if (v.routeDeviation && v.nearBorder) {
    return "Border Intrusion";
  }
  if (v.speedChange > 30) {
    return "Anomalous Behavior";
  }
  if (v.nearHighRiskArea) {
    return "High Risk Transit";
  }
  if (v.aisOff || v.ais === "lost") {
    return "AIS Blackout";
  }
  if (score > 70) {
    return "Elevated Threat Intrusion";
  }
  if (score > 30) {
    return "Elevated Caution";
  }

  return "Normal Transit";
}

// Attach to window for standard browser script execution
if (typeof window !== "undefined") {
  window.classifyThreat = classifyThreat;
  window.MS_THREAT = { classifyThreat };
}
