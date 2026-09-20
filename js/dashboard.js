/**
 * MARISENTINEL — Dashboard Integration Module
 * Bridges the Leaflet UI, Hybrid AI predictions, and Tactical Alert System.
 */

window.MS_DASHBOARD = (function () {
  function getVesselVerdict(vessel) {
    const mlScore = typeof vessel.riskScore === "number" ? vessel.riskScore : (vessel.risk || 0);
    const level = vessel.level || (mlScore >= 70 ? "HIGH" : mlScore >= 35 ? "MEDIUM" : "LOW");
    const threatType = vessel.threatType || "Normal Transit";
    const confidence = vessel.confidence || 90.0;
    
    return {
      mlScore,
      level,
      threatType,
      confidence,
      color: level === "HIGH" ? "#ef4444" : level === "MEDIUM" ? "#f97316" : "#10b981",
      triggeredRules: vessel.reasons || vessel.behaviours || [],
      contributingFeatures: vessel.contributingFeatures || []
    };
  }

  function triggerHighThreatAlert(vessel) {
    if (!vessel) return;
    const verdict = getVesselVerdict(vessel);
    if (verdict.level === "HIGH") {
      if (window.MS_UI && window.MS_UI.showToast) {
        window.MS_UI.showToast(`🚨 High Threat Alert: ${vessel.name} (${verdict.threatType})`, "error");
      }
    }
  }

  return {
    getVesselVerdict,
    triggerHighThreatAlert
  };
})();
