/**
 * MARISENTINEL — Risk Scoring Engine
 * Evaluates vessel telemetry and geofence proximity to calculate
 * an operational risk score (0–100) and structured reasoning list.
 */

function calculateRisk(vessel, customRules) {
  let score = 0;
  let reasons = [];

  const getWeight = (id, defaultWeight) => {
    if (Array.isArray(customRules) && customRules.length) {
      const rule = customRules.find(
        (r) =>
          (r.id && r.id.toUpperCase() === id.toUpperCase()) ||
          (r.name && r.name.toLowerCase().includes(id.toLowerCase()))
      );
      if (rule && rule.status === "active") return parseInt(rule.weight, 10) ?? defaultWeight;
      if (rule && rule.status === "disabled") return 0;
    }
    return defaultWeight;
  };

  const tr01Weight = getWeight("TR-01", 25);
  const tr02Weight = getWeight("TR-02", 20);
  const tr03Weight = getWeight("TR-03", 15);
  const tr04Weight = getWeight("TR-04", 10);
  const tr05Weight = getWeight("TR-05", 10);
  const tr06Weight = getWeight("TR-06", 10);
  const tr07Weight = getWeight("TR-07", 5);

  if (vessel.inRestrictedZone && tr01Weight > 0) {
    score += tr01Weight;
    reasons.push("Entered restricted zone");
  }

  if ((vessel.aisOff || vessel.ais === "lost") && tr02Weight > 0) {
    score += tr02Weight;
    reasons.push("AIS signal turned off");
  }

  if (vessel.speedChange > 30 && tr03Weight > 0) {
    score += tr03Weight;
    reasons.push("Sudden speed variation");
  }

  if (vessel.nearHighRiskArea && tr04Weight > 0) {
    score += tr04Weight;
    reasons.push("Near high-risk zone");
  }

  if (vessel.loitering && tr05Weight > 0) {
    score += tr05Weight;
    reasons.push("Prolonged loitering detected");
  }

  if (vessel.routeDeviation && tr06Weight > 0) {
    score += tr06Weight;
    reasons.push("Course deviation");
  }

  if (vessel.speed < 5 && tr07Weight > 0) {
    score += tr07Weight;
    reasons.push("Low speed detected");
  }

  if (vessel.nearBorder) {
    reasons.push("Proximity to maritime boundary / IMBL");
  }

  return { score: Math.min(score, 100), reasons };
}

// Attach to window for standard browser script execution
if (typeof window !== "undefined") {
  window.calculateRisk = calculateRisk;
  window.MS_RISK = { calculateRisk };
}
