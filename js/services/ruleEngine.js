/**
 * MARISENTINEL — Rule Engine (Explanation & Heuristics Only)
 * 
 * HYBRID AI ARCHITECTURE RULE:
 * This rule engine NEVER assigns final risk scores or overrides ML decisions.
 * It is used EXCLUSIVELY for:
 * 1. Generating human-understandable explanation triggers ("Why this alert?")
 * 2. Correlating the ML model's predicted threat classification with its canonical detection logic & behavior context
 * 3. Providing focused, single-threat explainability without conflicting rule spam.
 * 
 * Canonical Rule Matrix:
 * - TR-01: Dark Activity / Smuggling -> "AIS OFF + Restricted Zone"
 * - TR-02: Suspicious Loitering      -> "Loitering + High Risk Area"
 * - TR-03: Illegal Fishing           -> "Low Speed (<5 kts) + Restricted Zone"
 * - TR-04: Border Intrusion          -> "Route Deviation + Near Border"
 * - TR-05: Unauthorized Entry        -> "Geofence Breach"
 * - TR-06: Anomalous Behavior        -> "Speed Change > 30 knots + High Risk Area"
 */

(function () {
  const CANONICAL_THREAT_RULES = {
    "Border Intrusion": {
      ruleId: "TR-04",
      category: "Border Intrusion",
      logic: "Route Deviation + Near Border",
      explainability: "The vessel has deviated from its normal route and is heading toward or crossing an international maritime boundary, suggesting unauthorized entry or intrusion.",
      score: 85
    },
    "Dark Activity / Smuggling": {
      ruleId: "TR-01",
      category: "Dark Activity / Smuggling",
      logic: "AIS OFF + Restricted Zone",
      explainability: "The vessel has turned off its tracking system while entering a restricted or sensitive maritime area, which is a strong sign of intentional concealment, often linked to smuggling or illegal operations.",
      score: 90
    },
    "Suspicious Loitering": {
      ruleId: "TR-02",
      category: "Suspicious Loitering",
      logic: "Loitering + High Risk Area",
      explainability: "The vessel is staying idle or moving very slowly near a high-risk zone (such as ports or strategic assets), indicating possible surveillance, waiting activity, or suspicious intent.",
      score: 75
    },
    "Illegal Fishing": {
      ruleId: "TR-03",
      category: "Illegal Fishing",
      logic: "Low Speed (<5 kts) + Restricted Zone",
      explainability: "The vessel is operating at low speeds within an environmentally protected or restricted fishing zone, which is a strong indicator of unauthorized trawling or commercial fishing activities.",
      score: 70
    },
    "Unauthorized Entry": {
      ruleId: "TR-05",
      category: "Unauthorized Entry",
      logic: "Geofence Breach",
      explainability: "The vessel has entered a legally marked restricted zone without clearance or authorization, posing a potential security threat to coastal or naval operations.",
      score: 80
    },
    "Anomalous Behavior": {
      ruleId: "TR-06",
      category: "Anomalous Behavior",
      logic: "Speed Change > 30 knots + High Risk Area",
      explainability: "The vessel shows a sudden and unusual spike or drop in speed while operating near a sensitive area, which may indicate evasive maneuvers, pursuit, or abnormal operational behavior.",
      score: 65
    }
  };

  function getCanonicalRule(threatType, vessel) {
    const raw = (threatType || (vessel && vessel.threatType) || "").toLowerCase().trim();

    if (raw.includes("border") || raw.includes("intrusion")) {
      return CANONICAL_THREAT_RULES["Border Intrusion"];
    }
    if (raw.includes("dark") || raw.includes("smuggl")) {
      return CANONICAL_THREAT_RULES["Dark Activity / Smuggling"];
    }
    if (raw.includes("loiter")) {
      return CANONICAL_THREAT_RULES["Suspicious Loitering"];
    }
    if (raw.includes("fish")) {
      return CANONICAL_THREAT_RULES["Illegal Fishing"];
    }
    if (raw.includes("geofence") || raw.includes("unauthorized")) {
      return CANONICAL_THREAT_RULES["Unauthorized Entry"];
    }
    if (raw.includes("anomal") || raw.includes("speed change")) {
      return CANONICAL_THREAT_RULES["Anomalous Behavior"];
    }

    // Heuristic indicator mapping if threatType is not explicitly provided
    if (vessel) {
      const speed = parseFloat(vessel.speed || 0);
      const speedChange = parseFloat(vessel.speedChange || 0);
      const aisOff = Boolean(vessel.aisOff || vessel.ais === "lost" || vessel.ais === "off");
      const inRestrictedZone = Boolean(vessel.inRestrictedZone);
      const nearHighRiskArea = Boolean(vessel.nearHighRiskArea);
      const routeDeviation = Boolean(vessel.routeDeviation);
      const loitering = Boolean(vessel.loitering);
      const nearBorder = Boolean(vessel.nearBorder);

      if (routeDeviation && nearBorder) {
        return CANONICAL_THREAT_RULES["Border Intrusion"];
      }
      if (aisOff && inRestrictedZone) {
        return CANONICAL_THREAT_RULES["Dark Activity / Smuggling"];
      }
      if (loitering && nearHighRiskArea) {
        return CANONICAL_THREAT_RULES["Suspicious Loitering"];
      }
      if (speed < 5.0 && inRestrictedZone) {
        return CANONICAL_THREAT_RULES["Illegal Fishing"];
      }
      if (inRestrictedZone) {
        return CANONICAL_THREAT_RULES["Unauthorized Entry"];
      }
      if (speedChange > 30.0 && nearHighRiskArea) {
        return CANONICAL_THREAT_RULES["Anomalous Behavior"];
      }
      if (nearBorder) {
        return CANONICAL_THREAT_RULES["Border Intrusion"];
      }
      if (aisOff) {
        return CANONICAL_THREAT_RULES["Dark Activity / Smuggling"];
      }
      if (loitering) {
        return CANONICAL_THREAT_RULES["Suspicious Loitering"];
      }
    }

    return {
      ruleId: "TR-00",
      category: "Normal Transit",
      logic: "Standard Navigation Corridor",
      explainability: "The vessel is operating under normal navigational parameters along authorized transit routes.",
      score: 10
    };
  }

  /**
   * Evaluates vessel indicators against explanation rules.
   * Aligns explainability directly with the detected threat category.
   */
  function evaluateRules(vessel, customRulesOrThreatType) {
    if (!vessel) {
      return {
        ruleId: "TR-00",
        category: "Normal Transit",
        logic: "Standard Navigation Corridor",
        triggeredRules: [],
        explainability: "The vessel is operating under normal navigational parameters along authorized transit routes.",
        ruleScore: 0
      };
    }

    const threatType = (typeof customRulesOrThreatType === "string" && customRulesOrThreatType)
      ? customRulesOrThreatType
      : (vessel.threatType || (vessel.level === "HIGH" ? "Dark Activity / Smuggling" : vessel.level === "MEDIUM" ? "Suspicious Loitering" : "Normal Transit"));

    const isLow = vessel.level === "LOW" && (!threatType || threatType === "Normal Transit");
    const rule = isLow
      ? {
          ruleId: "TR-00",
          category: "Normal Transit",
          logic: "Standard Navigation Corridor",
          explainability: "The vessel is operating under normal navigational parameters along authorized transit routes.",
          score: 10
        }
      : getCanonicalRule(threatType, vessel);

    const triggeredRules = isLow ? [] : [rule.logic];

    return {
      ruleId: rule.ruleId,
      category: rule.category,
      logic: rule.logic,
      triggeredRules,
      explainability: rule.explainability,
      ruleScore: isLow ? 10 : rule.score
    };
  }

  // Export to global scope
  const MS_RULE_ENGINE = {
    evaluateRules,
    CANONICAL_THREAT_RULES
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
