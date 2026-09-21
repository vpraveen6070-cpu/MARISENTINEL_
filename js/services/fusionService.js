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
 * 4. Strict ML Requirement: Live ML API response required (backup fallback removed)
 */
(function () {
  const isBrowser = typeof window !== "undefined";
  const isHttps = isBrowser && window.location.protocol === "https:";
  const isLocalHost = isBrowser && (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "0.0.0.0" ||
    window.location.hostname.endsWith(".local") ||
    window.location.protocol === "file:"
  );

  const customApi = (isBrowser && window.MARISENTINEL_API_BASE) ? window.MARISENTINEL_API_BASE : null;
  const CLOUD_API = "https://marisentinel-api.onrender.com";

  // Build candidate list based on environment
  // CRITICAL: On HTTPS or deployed links, NEVER attempt insecure http://127.0.0.1 (blocked by mixed content)
  let API_CANDIDATES = [];
  if (customApi) {
    API_CANDIDATES.push(customApi);
  }
  if (isHttps || !isLocalHost) {
    API_CANDIDATES.push(CLOUD_API);
  } else {
    API_CANDIDATES.push("http://127.0.0.1:5005");
    API_CANDIDATES.push("http://localhost:5005");
    API_CANDIDATES.push(CLOUD_API);
  }

  let activeApiBase = API_CANDIDATES[0] || CLOUD_API;
  const TIMEOUT_MS = 15000;

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
    const timeout = timeoutMs || TIMEOUT_MS;

    // 1. Try active API Base
    try {
      const res = await fetchWithTimeout(`${activeApiBase}${path}`, options, timeout);
      if (res.ok) return res;
    } catch (_) { }

    // 2. Try remaining candidates
    for (const base of API_CANDIDATES) {
      if (base === activeApiBase) continue;
      try {
        const res = await fetchWithTimeout(`${base}${path}`, options, timeout);
        if (res.ok) {
          activeApiBase = base;
          return res;
        }
      } catch (_) { }
    }

    // 3. For cloud endpoints on Render, retry once if waking up from cold start
    if (activeApiBase.includes("onrender.com")) {
      try {
        await new Promise(r => setTimeout(r, 1200));
        const res = await fetchWithTimeout(`${activeApiBase}${path}`, options, timeout);
        if (res.ok) return res;
      } catch (_) { }
    }

    throw new Error(`Failed to reach Python Flask ML API at ${path} on ${activeApiBase}`);
  }

  /**
   * Main Hybrid Fusion Method
   * Combines ML Model Prediction with Rule Engine Explanation.
   * NOTE: Backup/fallback removed - strictly requires live ML model inference.
   */
  async function evaluateVessel(vessel) {
    const payload = formatTelemetryPayload(vessel);
    const vesselId = payload.vesselId;

    // 1. Query Primary ML Model via Flask Backend (/predict) - Strict ML requirement, no backup
    const res = await fetchWithFallback("/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`ML Service responded with status: ${res.status}`);
    }

    const mlOutput = await res.json();

    // 2. Evaluate Rule Insights (Explanation Only) matching the AI predicted threat type
    const ruleEngine = (typeof window !== "undefined" && window.MS_RULE_ENGINE)
      ? window.MS_RULE_ENGINE
      : ((typeof globalThis !== "undefined" && globalThis.MS_RULE_ENGINE) ? globalThis.MS_RULE_ENGINE : null);

    const ruleOutput = ruleEngine
      ? ruleEngine.evaluateRules(payload, mlOutput.threatType)
      : { triggeredRules: [], explainability: "", ruleScore: 0 };

    // 3. Assemble Final Hybrid Architecture Schema
    const fusedResult = {
      vesselId,
      mlPrediction: {
        riskScore: mlOutput.riskScore,
        level: mlOutput.level,
        threatType: mlOutput.threatType,
        confidence: mlOutput.confidence,
        contributingFeatures: []
      },
      ruleInsights: {
        ruleId: ruleOutput.ruleId,
        category: ruleOutput.category,
        logic: ruleOutput.logic,
        triggeredRules: ruleOutput.triggeredRules,
        explainability: ruleOutput.explainability,
        ruleScore: ruleOutput.ruleScore
      },
      finalDecision: mlOutput.level, // ML output ALWAYS decides finalDecision
      explainability: true
    };

    predictionCache.set(vesselId, fusedResult);
    return fusedResult;
  }

  /**
   * Batch evaluate an array of vessels for initialization & tick synchronization.
   * NOTE: Backup/fallback removed - strictly queries live ML backend batch endpoint.
   */
  async function evaluateVesselsBatch(vessels) {
    if (!Array.isArray(vessels) || !vessels.length) return [];

    const payloads = vessels.map(formatTelemetryPayload);
    const batchTimeout = (isHttps || !isLocalHost) ? 25000 : 7000;
    const res = await fetchWithFallback("/batch-predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vessels: payloads })
    }, batchTimeout);

    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.results)) {
        data.results.forEach((r) => {
          if (r.vesselId) predictionCache.set(r.vesselId, r);
        });
        return data.results;
      }
    }

    throw new Error("Batch ML prediction returned invalid response from server");
  }

  let healthCheckInFlight = null;
  let lastHealthCheck = null;

  async function checkBackendHealth(options = {}) {
    const now = Date.now();
    if (!options.force && lastHealthCheck && (now - lastHealthCheck.timestamp < 4000)) {
      return lastHealthCheck.result;
    }

    if (healthCheckInFlight) {
      return healthCheckInFlight;
    }

    const timeout = options.timeout || 12000;
    const isCloud = Boolean(activeApiBase && (activeApiBase.includes("onrender.com") || activeApiBase.startsWith("https:")));

    healthCheckInFlight = (async () => {
      try {
        const res = await fetchWithFallback("/health", {}, timeout);
        if (res.ok) {
          const data = await res.json();
          const result = { ok: true, endpoint: activeApiBase, isCloud, ...data };
          lastHealthCheck = { timestamp: Date.now(), result };
          return result;
        }
      } catch (err) {
        const result = { ok: false, error: err.message, endpoint: activeApiBase, isCloud };
        lastHealthCheck = { timestamp: Date.now(), result };
        return result;
      } finally {
        healthCheckInFlight = null;
      }
      const result = { ok: false, endpoint: activeApiBase, isCloud };
      lastHealthCheck = { timestamp: Date.now(), result };
      return result;
    })();

    return healthCheckInFlight;
  }

  // Self-warmup on initial load so cloud container wakes up immediately if idle
  if (isBrowser) {
    setTimeout(() => {
      checkBackendHealth({ timeout: 15000 }).catch(() => {});
    }, 150);
  }

  const MS_FUSION = {
    evaluateVessel,
    evaluateVesselsBatch,
    checkBackendHealth,
    getActiveEndpoint: () => activeApiBase,
    isCloudEndpoint: () => Boolean(activeApiBase && (activeApiBase.includes("onrender.com") || activeApiBase.startsWith("https:"))),
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

