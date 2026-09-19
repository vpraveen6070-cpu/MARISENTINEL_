/**
 * MARISENTINEL — Hybrid AI Fusion Service (Frontend)
 * 
 * Target Architecture:
 * Input Telemetry → Feature Engineering → ML Model (Random Forest - Primary)
 *                                      → Rule Engine (Explanation Only)
 *                                      → Fusion Layer (Combine Outputs)
 *                                      → Dashboard & Tactical Alerts
 * 
 * CORE RULES:
 * 1. ML output ALWAYS decides finalDecision (level)
 * 2. Rules NEVER override ML
 * 3. Rules only explain WHY (triggeredRules, baseline ruleScore)
 * 4. Automatic Fallback: If ML API fails, gracefully uses rule engine
 */
(function () {
  const customApi = (typeof window !== "undefined" && window.MARISENTINEL_API_BASE) ? window.MARISENTINEL_API_BASE : null;
  const API_CANDIDATES = [
    ...(customApi ? [customApi] : []),
    "https://marisentinel-api.onrender.com",
    "http://127.0.0.1:5005",
    "http://localhost:5005"
  ];
  let activeApiBase = API_CANDIDATES[0];
  const TIMEOUT_MS = 6000;

  // Cache to optimize repeated evaluations
  const predictionCache = new Map();

  function formatTelemetryPayload(vessel) {
    const v = vessel || {};
    return {
      vesselId: v.vesselId || v.id || "UNKNOWN",
      speed: parseFloat(v.speed || 0),
      heading: parseFloat(v.heading ?? v.course ?? 0),
      speedChange: parseFloat(v.speedChange || 0),
      speed_variance: parseFloat(v.speed_variance || (v.speedChange ? v.speedChange * 0.25 : 1.2)),
      time_in_zone: parseFloat(v.time_in_zone || (v.inRestrictedZone ? 45.0 : 0.0)),
      aisOff: Boolean(v.aisOff || v.ais === "lost" || v.ais === "off"),
      inRestrictedZone: Boolean(v.inRestrictedZone),
      nearHighRiskArea: Boolean(v.nearHighRiskArea),
      routeDeviation: Boolean(v.routeDeviation),
      loitering: Boolean(v.loitering),
      nearBorder: Boolean(v.nearBorder)
    };
  }

  async function fetchWithTimeout(url, options = {}, timeoutMs = TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, credentials: "omit", signal: controller.signal });
      clearTimeout(timer);
      return response;
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }

  async function fetchWithFallback(path, options = {}, timeoutMs = TIMEOUT_MS) {
    // 1. Try active API Base
    try {
      const res = await fetchWithTimeout(`${activeApiBase}${path}`, options, timeoutMs);
      if (res.ok) return res;
    } catch (_) {}

    // 2. Try remaining candidates
    for (const base of API_CANDIDATES) {
      if (base === activeApiBase) continue;
      try {
        const res = await fetchWithTimeout(`${base}${path}`, options, timeoutMs);
        if (res.ok) {
          activeApiBase = base;
          return res;
        }
      } catch (_) {}
    }

    throw new Error(`Failed to reach Python Flask ML API at ${path} on port 5005`);
  }

  /**
   * Main Hybrid Fusion Method
   * Combines ML Model Prediction with Rule Engine Explanation.
   */
  async function evaluateVessel(vessel) {
    const payload = formatTelemetryPayload(vessel);
    const vesselId = payload.vesselId;

    // 1. Evaluate Rule Insights (Explanation Only)
    const ruleEngine = (typeof window !== "undefined" && window.MS_RULE_ENGINE)
      ? window.MS_RULE_ENGINE
      : ((typeof globalThis !== "undefined" && globalThis.MS_RULE_ENGINE) ? globalThis.MS_RULE_ENGINE : null);
    
    const ruleOutput = ruleEngine
      ? ruleEngine.evaluateRules(payload)
      : { triggeredRules: [], ruleScore: 0 };

    let mlOutput = null;
    let isFallback = false;

    // 2. Query Primary ML Model via Flask Backend (/predict)
    try {
      const res = await fetchWithFallback("/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error(`ML Service responded with status: ${res.status}`);
      }

      mlOutput = await res.json();
    } catch (err) {
      // Step 6: Fallback Handling if ML API fails
      console.warn(`[MARISENTINEL Fusion] ML backend offline or unreachable. Engaging Rule Engine Fallback for ${vesselId}.`, err.message);
      isFallback = true;

      if (ruleEngine && ruleEngine.generateFallbackAssessment) {
        const fallback = ruleEngine.generateFallbackAssessment(payload);
        mlOutput = {
          riskScore: fallback.riskScore,
          level: fallback.level,
          threatType: fallback.threatType,
          confidence: 50.0,
          contributingFeatures: []
        };
      } else {
        mlOutput = {
          riskScore: ruleOutput.ruleScore || 0,
          level: (ruleOutput.ruleScore >= 70 ? "HIGH" : ruleOutput.ruleScore >= 35 ? "MEDIUM" : "LOW"),
          threatType: "Rule Engine Fallback",
          confidence: 50.0,
          contributingFeatures: []
        };
      }
    }

    // 3. Assemble Final Hybrid Architecture Schema (Step 3)
    const fusedResult = {
      vesselId,
      mlPrediction: {
        riskScore: mlOutput.riskScore,
        level: mlOutput.level,
        threatType: mlOutput.threatType,
        confidence: mlOutput.confidence,
        contributingFeatures: mlOutput.contributingFeatures || []
      },
      ruleInsights: {
        triggeredRules: ruleOutput.triggeredRules,
        ruleScore: ruleOutput.ruleScore
      },
      finalDecision: mlOutput.level, // ML output ALWAYS decides finalDecision
      explainability: true,
      isFallback
    };

    predictionCache.set(vesselId, fusedResult);
    return fusedResult;
  }

  /**
   * Batch evaluate an array of vessels for initialization & tick synchronization.
   */
  async function evaluateVesselsBatch(vessels) {
    if (!Array.isArray(vessels) || !vessels.length) return [];

    try {
      const payloads = vessels.map(formatTelemetryPayload);
      const res = await fetchWithFallback("/batch-predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vessels: payloads })
      }, 7000);

      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.results)) {
          data.results.forEach((r) => {
            if (r.vesselId) predictionCache.set(r.vesselId, r);
          });
          return data.results;
        }
      }
    } catch (err) {
      console.warn("[MARISENTINEL Fusion] Batch predict fallback to individual inference:", err.message);
    }

    return Promise.all(vessels.map(evaluateVessel));
  }

  async function checkBackendHealth() {
    try {
      const res = await fetchWithFallback("/health", {}, 3000);
      if (res.ok) {
        const data = await res.json();
        return { ok: true, endpoint: activeApiBase, ...data };
      }
    } catch (err) {
      return { ok: false, error: err.message, endpoint: activeApiBase };
    }
    return { ok: false, endpoint: activeApiBase };
  }

  const MS_FUSION = {
    evaluateVessel,
    evaluateVesselsBatch,
    checkBackendHealth,
    getActiveEndpoint: () => activeApiBase,
    getCached: (id) => predictionCache.get(id),
    clearCache: () => predictionCache.clear()
  };

  if (typeof window !== "undefined") {
    window.MS_FUSION = MS_FUSION;
  }
  if (typeof globalThis !== "undefined") {
    globalThis.MS_FUSION = MS_FUSION;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = MS_FUSION;
  }
})();
