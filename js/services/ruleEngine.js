/**
 * MARISENTINEL — Rule Engine (Explanation & Heuristics Only)
 * 
 * HYBRID AI ARCHITECTURE RULE:
 * This rule engine NEVER assigns final risk scores or overrides ML decisions.
 * It is used EXCLUSIVELY for:
 * 1. Generating human-understandable explanation triggers ("Why this alert?")
 * 2. Baseline comparison (Rule Score vs ML Score)
 * (Backup/fallback for ML model has been removed; predictions strictly require ML backend)
 * 
 * Target Rules:
 * - AIS OFF + Restricted Zone → "Dark Activity"
 * - Loitering + High Risk Area → "Suspicious Loitering"
 * - Low Speed + Restricted Zone → "Illegal Fishing"
 * - Route Deviation + Border → "Border Intrusion"
 * - Speed Change > threshold → "Anomalous Behavior"
 */

(function () {
  /**
   * Evaluates vessel indicators against explanation rules.
   * OUTPUT FORMAT:
   * {
   *   triggeredRules: [...],
   *   ruleScore: number (optional, for comparison only)
   * }
   */
  function evaluateRules(vessel, customRules) {
    if (!vessel) return { triggeredRules: [], ruleScore: 0 };

    const triggeredRules = [];
    let ruleScore = 0;

    const speed = parseFloat(vessel.speed || 0);
    const speedChange = parseFloat(vessel.speedChange || 0);
    const aisOff = Boolean(vessel.aisOff || vessel.ais === "lost" || vessel.ais === "off");
    const inRestrictedZone = Boolean(vessel.inRestrictedZone);
    const nearHighRiskArea = Boolean(vessel.nearHighRiskArea);
    const routeDeviation = Boolean(vessel.routeDeviation);
    const loitering = Boolean(vessel.loitering);
    const nearBorder = Boolean(vessel.nearBorder);

    // Rule 1: AIS OFF + Restricted Zone → "Dark Activity"
    if (aisOff && inRestrictedZone) {
      triggeredRules.push("AIS OFF + Restricted Zone → Dark Activity / Smuggling");
      ruleScore += 35;
    } else if (aisOff) {
      triggeredRules.push("AIS Transponder Blackout");
      ruleScore += 20;
    }

    if (inRestrictedZone && !(aisOff && inRestrictedZone)) {
      triggeredRules.push("Restricted Security Perimeter Entry");
      ruleScore += 25;
    }

    // Rule 2: Loitering + High Risk Area → "Suspicious Loitering"
    if (loitering && nearHighRiskArea) {
      triggeredRules.push("Loitering + High Risk Area → Suspicious Loitering");
      ruleScore += 25;
    } else if (loitering) {
      triggeredRules.push("Prolonged Stationary Loitering");
      ruleScore += 15;
    }

    if (nearHighRiskArea && !(loitering && nearHighRiskArea)) {
      triggeredRules.push("High-Risk Maritime Area Proximity");
      ruleScore += 15;
    }

    // Rule 3: Low Speed + Restricted Zone → "Illegal Fishing"
    if (speed < 5.0 && inRestrictedZone) {
      triggeredRules.push("Low Speed (<5 kts) + Restricted Zone → Illegal Fishing");
      ruleScore += 20;
    } else if (speed < 5.0 && !inRestrictedZone) {
      triggeredRules.push("Low Speed Detected (<5 kts)");
      ruleScore += 5;
    }

    // Rule 4: Route Deviation + Border → "Border Intrusion"
    if (routeDeviation && nearBorder) {
      triggeredRules.push("Route Deviation + Border → Border Intrusion");
      ruleScore += 25;
    } else if (routeDeviation) {
      triggeredRules.push("Course Deviation from Shipping Corridor");
      ruleScore += 10;
    }

    if (nearBorder && !(routeDeviation && nearBorder)) {
      triggeredRules.push("Proximity to Maritime Border (IMBL)");
      ruleScore += 10;
    }

    // Rule 5: speedChange > 30 AND nearHighRiskArea → "Anomalous Behavior"
    if (speedChange > 30.0 && nearHighRiskArea) {
      triggeredRules.push("Speed Change > 30 kts + High Risk Area → Anomalous Behavior");
      ruleScore += 20;
    }

    return {
      triggeredRules,
      ruleScore: Math.min(ruleScore, 100)
    };
  }

  // Export to global scope
  const MS_RULE_ENGINE = {
    evaluateRules
  };

  if (typeof window !== "undefined") {
    window.MS_RULE_ENGINE = MS_RULE_ENGINE;
    window.evaluateRules = evaluateRules;
  }
  if (typeof globalThis !== "undefined") {
    globalThis.MS_RULE_ENGINE = MS_RULE_ENGINE;
    globalThis.evaluateRules = evaluateRules;
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = MS_RULE_ENGINE;
  }
})();
