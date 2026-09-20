/**
 * MARISENTINEL — Risk Engine (Explanation & Heuristics)
 * Refactored for Hybrid AI Architecture.
 * 
 * NOTE: The Machine Learning model (Random Forest) is the ONLY primary decision-making engine.
 * This module computes rule explanation insights and baseline rule comparisons.
 */

function calculateRisk(vessel, customRules) {
  if (typeof window !== "undefined" && window.MS_RULE_ENGINE) {
    const res = window.MS_RULE_ENGINE.evaluateRules(vessel, customRules);
    return {
      score: res.ruleScore,
      reasons: res.triggeredRules,
      triggeredRules: res.triggeredRules,
      ruleScore: res.ruleScore
    };
  }

  // Fallback inline evaluation if ruleEngine not loaded first
  let score = 0;
  const reasons = [];

  const aisOff = Boolean(vessel.aisOff || vessel.ais === "lost" || vessel.ais === "off");
  const inRestrictedZone = Boolean(vessel.inRestrictedZone);
  const nearHighRiskArea = Boolean(vessel.nearHighRiskArea);
  const loitering = Boolean(vessel.loitering);
  const routeDeviation = Boolean(vessel.routeDeviation);
  const speed = parseFloat(vessel.speed || 0);
  const speedChange = parseFloat(vessel.speedChange || 0);
  const nearBorder = Boolean(vessel.nearBorder);

  if (aisOff && inRestrictedZone) {
    score += 35;
    reasons.push("AIS OFF + Restricted Zone → Dark Activity / Smuggling");
  } else if (aisOff) {
    score += 20;
    reasons.push("AIS Transponder Blackout");
  }

  if (inRestrictedZone && !(aisOff && inRestrictedZone)) {
    score += 25;
    reasons.push("Restricted Security Perimeter Entry");
  }

  if (loitering && nearHighRiskArea) {
    score += 25;
    reasons.push("Loitering + High Risk Area → Suspicious Loitering");
  } else if (loitering) {
    score += 15;
    reasons.push("Prolonged Stationary Loitering");
  }

  if (speed < 5 && inRestrictedZone) {
    score += 20;
    reasons.push("Low Speed (<5 kts) + Restricted Zone → Illegal Fishing");
  }

  if (routeDeviation && nearBorder) {
    score += 25;
    reasons.push("Route Deviation + Border → Border Intrusion");
  }

  if (speedChange > 30 && nearHighRiskArea) {
    score += 20;
    reasons.push("Speed Change > 30 kts + High Risk Area → Anomalous Behavior");
  }

  return {
    score: Math.min(score, 100),
    reasons,
    triggeredRules: reasons,
    ruleScore: Math.min(score, 100)
  };
}

// Attach to window for standard browser script execution
if (typeof window !== "undefined") {
  window.calculateRisk = calculateRisk;
  window.MS_RISK = { calculateRisk };
}
