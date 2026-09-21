"""
MARISENTINEL — Hybrid AI Fusion Service (Backend)
Combines Random Forest ML predictions (sole decision engine)
with rule-based insights (explanation only).
"""

from .mlService import predict_vessel, predict_vessels_batch

CANONICAL_THREAT_RULES = {
    "Border Intrusion": {
        "ruleId": "TR-04",
        "category": "Border Intrusion",
        "logic": "Route Deviation + Near Border",
        "explainability": "The vessel has deviated from its normal route and is heading toward or crossing an international maritime boundary, suggesting unauthorized entry or intrusion.",
        "score": 85
    },
    "Dark Activity / Smuggling": {
        "ruleId": "TR-01",
        "category": "Dark Activity / Smuggling",
        "logic": "AIS OFF + Restricted Zone",
        "explainability": "The vessel has turned off its tracking system while entering a restricted or sensitive maritime area, which is a strong sign of intentional concealment, often linked to smuggling or illegal operations.",
        "score": 90
    },
    "Suspicious Loitering": {
        "ruleId": "TR-02",
        "category": "Suspicious Loitering",
        "logic": "Loitering + High Risk Area",
        "explainability": "The vessel is staying idle or moving very slowly near a high-risk zone (such as ports or strategic assets), indicating possible surveillance, waiting activity, or suspicious intent.",
        "score": 75
    },
    "Illegal Fishing": {
        "ruleId": "TR-03",
        "category": "Illegal Fishing",
        "logic": "Low Speed (<5 kts) + Restricted Zone",
        "explainability": "The vessel is operating at low speeds within an environmentally protected or restricted fishing zone, which is a strong indicator of unauthorized trawling or commercial fishing activities.",
        "score": 70
    },
    "Unauthorized Entry": {
        "ruleId": "TR-05",
        "category": "Unauthorized Entry",
        "logic": "Geofence Breach",
        "explainability": "The vessel has entered a legally marked restricted zone without clearance or authorization, posing a potential security threat to coastal or naval operations.",
        "score": 80
    },
    "Anomalous Behavior": {
        "ruleId": "TR-06",
        "category": "Anomalous Behavior",
        "logic": "Speed Change > 30 knots + High Risk Area",
        "explainability": "The vessel shows a sudden and unusual spike or drop in speed while operating near a sensitive area, which may indicate evasive maneuvers, pursuit, or abnormal operational behavior.",
        "score": 65
    }
}

def get_canonical_rule(threat_type, vessel):
    raw = (threat_type or vessel.get("threatType") or "").lower().strip()
    if "border" in raw or "intrusion" in raw:
        return CANONICAL_THREAT_RULES["Border Intrusion"]
    if "dark" in raw or "smuggl" in raw:
        return CANONICAL_THREAT_RULES["Dark Activity / Smuggling"]
    if "loiter" in raw:
        return CANONICAL_THREAT_RULES["Suspicious Loitering"]
    if "fish" in raw:
        return CANONICAL_THREAT_RULES["Illegal Fishing"]
    if "geofence" in raw or "unauthorized" in raw:
        return CANONICAL_THREAT_RULES["Unauthorized Entry"]
    if "anomal" in raw or "speed change" in raw:
        return CANONICAL_THREAT_RULES["Anomalous Behavior"]

    # Fallback to indicators
    if vessel.get("routeDeviation") and vessel.get("nearBorder"):
        return CANONICAL_THREAT_RULES["Border Intrusion"]
    if vessel.get("aisOff") and vessel.get("inRestrictedZone"):
        return CANONICAL_THREAT_RULES["Dark Activity / Smuggling"]
    if vessel.get("loitering") and vessel.get("nearHighRiskArea"):
        return CANONICAL_THREAT_RULES["Suspicious Loitering"]

    return {
        "ruleId": "TR-00",
        "category": "Normal Transit",
        "logic": "Standard Navigation Corridor",
        "explainability": "The vessel is operating under normal navigational parameters along authorized transit routes.",
        "score": 10
    }

def evaluate_rules(vessel, threat_type=None):
    """
    Evaluates rule heuristics strictly for explainability and baseline comparison.
    Correlates with the predicted threat type to avoid conflicting multi-rule spam.
    """
    t_type = threat_type or vessel.get("threatType")
    is_low = vessel.get("level") == "LOW" and (not t_type or t_type == "Normal Transit")
    
    if is_low:
        return {
            "ruleId": "TR-00",
            "category": "Normal Transit",
            "logic": "Standard Navigation Corridor",
            "triggeredRules": [],
            "explainability": "The vessel is operating under normal navigational parameters along authorized transit routes.",
            "ruleScore": 10
        }

    rule = get_canonical_rule(t_type, vessel)
    return {
        "ruleId": rule["ruleId"],
        "category": rule["category"],
        "logic": rule["logic"],
        "triggeredRules": [rule["logic"]],
        "explainability": rule["explainability"],
        "ruleScore": rule["score"]
    }

def fuse_vessel_telemetry(vessel_data):
    """
    Fuses ML decision output with rule insights.
    ML output ALWAYS decides finalDecision.
    Rules NEVER override ML.
    """
    vessel_id = vessel_data.get("vesselId") or vessel_data.get("id") or "UNKNOWN"
    
    # 1. Primary AI Decision via Random Forest
    ml_output = predict_vessel(vessel_data)

    # 2. Rule-based explanation insights correlated to predicted threat
    rule_output = evaluate_rules(vessel_data, ml_output["threatType"])

    return {
        "vesselId": vessel_id,
        "mlPrediction": {
            "riskScore": ml_output["riskScore"],
            "level": ml_output["level"],
            "threatType": ml_output["threatType"],
            "confidence": ml_output["confidence"],
            "contributingFeatures": []
        },
        "ruleInsights": {
            "ruleId": rule_output["ruleId"],
            "category": rule_output["category"],
            "logic": rule_output["logic"],
            "triggeredRules": rule_output["triggeredRules"],
            "explainability": rule_output["explainability"],
            "ruleScore": rule_output["ruleScore"]
        },
        "finalDecision": ml_output["level"],
        "explainability": True
    }

def fuse_vessels_batch(vessels_list):
    """
    Fuses a batch of vessels using vectorized ML inference for high throughput.
    """
    if not vessels_list:
        return []

    ml_outputs = predict_vessels_batch(vessels_list)
    results = []
    for i, v in enumerate(vessels_list):
        vessel_id = v.get("vesselId") or v.get("id") or "UNKNOWN"
        ml_out = ml_outputs[i]
        rule_out = evaluate_rules(v, ml_out["threatType"])
        results.append({
            "vesselId": vessel_id,
            "mlPrediction": {
                "riskScore": ml_out["riskScore"],
                "level": ml_out["level"],
                "threatType": ml_out["threatType"],
                "confidence": ml_out["confidence"],
                "contributingFeatures": ml_out.get("contributingFeatures", [])
            },
            "ruleInsights": {
                "ruleId": rule_out["ruleId"],
                "category": rule_out["category"],
                "logic": rule_out["logic"],
                "triggeredRules": rule_out["triggeredRules"],
                "explainability": rule_out["explainability"],
                "ruleScore": rule_out["ruleScore"]
            },
            "finalDecision": ml_out["level"],
            "explainability": True
        })
    return results
