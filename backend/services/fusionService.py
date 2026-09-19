"""
MARISENTINEL — Hybrid AI Fusion Service (Backend)
Combines Random Forest ML predictions (sole decision engine)
with rule-based insights (explanation only).
"""

from .mlService import predict_vessel

def evaluate_rules(vessel):
    """
    Evaluates rule heuristics strictly for explainability and baseline comparison.
    Rules NEVER override ML decisions.
    """
    triggered_rules = []
    rule_score = 0

    speed = float(vessel.get("speed", 0.0) or 0.0)
    speed_change = float(vessel.get("speedChange", 0.0) or 0.0)
    
    ais_raw = vessel.get("aisOff", False)
    if isinstance(ais_raw, str):
        ais_off = ais_raw.lower() in ("true", "1", "lost", "off")
    else:
        ais_off = bool(ais_raw)

    in_restricted = bool(vessel.get("inRestrictedZone", False))
    near_hra = bool(vessel.get("nearHighRiskArea", False))
    route_dev = bool(vessel.get("routeDeviation", False))
    loitering = bool(vessel.get("loitering", False))
    near_border = bool(vessel.get("nearBorder", False))

    # Rule 1: AIS OFF + Restricted Zone
    if ais_off and in_restricted:
        triggered_rules.append("AIS OFF + Restricted Zone → Dark Activity / Smuggling")
        rule_score += 35
    elif ais_off:
        triggered_rules.append("AIS Transponder Blackout Detected")
        rule_score += 20

    if in_restricted and not (ais_off and in_restricted):
        triggered_rules.append("Restricted Maritime Perimeter Intrusion")
        rule_score += 25

    # Rule 2: Loitering + High Risk Area
    if loitering and near_hra:
        triggered_rules.append("Loitering + High Risk Area → Suspicious Loitering")
        rule_score += 25
    elif loitering:
        triggered_rules.append("Prolonged Stationary Loitering in Transit Corridor")
        rule_score += 15

    if near_hra and not (loitering and near_hra):
        triggered_rules.append("Proximity to Designated High-Risk Maritime Area")
        rule_score += 15

    # Rule 3: Low Speed + Restricted Zone
    if speed < 5.0 and in_restricted:
        triggered_rules.append("Low Speed (<5 kts) + Restricted Zone → Illegal Fishing")
        rule_score += 20
    elif speed < 5.0:
        triggered_rules.append("Low Speed (<5 kts) Detected")
        rule_score += 5

    # Rule 4: Route Deviation + Border
    if route_dev and near_border:
        triggered_rules.append("Route Deviation + Maritime Border → Border Intrusion")
        rule_score += 25
    elif route_dev:
        triggered_rules.append("Course Deviation from Established Shipping Lane")
        rule_score += 10

    if near_border and not (route_dev and near_border):
        triggered_rules.append("Proximity to International Maritime Boundary Line (IMBL)")
        rule_score += 10

    # Rule 5: Speed Change > threshold (threshold = 30 kts)
    if speed_change > 30.0:
        triggered_rules.append(f"Speed Change > 30 kts ({speed_change:.1f} kts delta) → Anomalous Behavior")
        rule_score += 20

    return {
        "triggeredRules": triggered_rules,
        "ruleScore": min(100, rule_score)
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

    # 2. Rule-based explanation insights
    rule_output = evaluate_rules(vessel_data)

    return {
        "vesselId": vessel_id,
        "mlPrediction": {
            "riskScore": ml_output["riskScore"],
            "level": ml_output["level"],
            "threatType": ml_output["threatType"],
            "confidence": ml_output["confidence"],
            "contributingFeatures": ml_output.get("contributingFeatures", [])
        },
        "ruleInsights": {
            "triggeredRules": rule_output["triggeredRules"],
            "ruleScore": rule_output["ruleScore"]
        },
        "finalDecision": ml_output["level"],
        "explainability": True
    }
