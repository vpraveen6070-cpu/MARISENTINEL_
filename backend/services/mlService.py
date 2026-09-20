"""
MARISENTINEL — ML Prediction Service
Primary AI Decision Engine powered by Random Forest.
Loads 'risk_model.pkl' once at startup and computes riskScore, level,
threatType, confidence, and instance-level top-3 contributing features.
"""

import os
import joblib
import numpy as np

MODEL_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "model", "risk_model.pkl")

# Global singleton model storage
_MODEL_BUNDLE = None

def get_model():
    global _MODEL_BUNDLE
    if _MODEL_BUNDLE is None:
        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(f"Trained model not found at {MODEL_PATH}. Run train_model.py first.")
        print(f"[*] Loading Random Forest risk model from {MODEL_PATH}...")
        _MODEL_BUNDLE = joblib.load(MODEL_PATH)
        print("[✓] Random Forest model loaded successfully into memory.")
    return _MODEL_BUNDLE

# Feature definitions & metadata
FEATURE_NAMES = [
    "speed",
    "heading",
    "speedChange",
    "speed_variance",
    "time_in_zone",
    "aisOff",
    "inRestrictedZone",
    "nearHighRiskArea",
    "routeDeviation",
    "loitering",
    "nearBorder"
]

FEATURE_LABELS = {
    "speed": "Low/Anomalous Vessel Speed",
    "heading": "Vessel Course Trajectory",
    "speedChange": "Abrupt Velocity Change",
    "speed_variance": "Speed Volatility Variance",
    "time_in_zone": "Extended Dwell in Security Zone",
    "aisOff": "AIS Transponder Blackout",
    "inRestrictedZone": "Restricted Zone Intrusion",
    "nearHighRiskArea": "Proximity to High-Risk Corridor",
    "routeDeviation": "Standard Lane Route Deviation",
    "loitering": "Prolonged Stationary Loitering",
    "nearBorder": "Maritime Boundary (IMBL) Proximity"
}

def extract_features(data):
    """
    Extracts, normalizes, and validates telemetry features from raw dictionary.
    Handles defaults and type conversions gracefully.
    """
    speed = float(data.get("speed", 0.0) or 0.0)
    heading = float(data.get("heading", data.get("course", 0.0)) or 0.0)
    speedChange = float(data.get("speedChange", 0.0) or 0.0)
    # Boolean / flag conversions
    ais_raw = data.get("aisOff", False)
    if isinstance(ais_raw, str):
        aisOff = 1 if ais_raw.lower() in ("true", "1", "lost", "off") else 0
    else:
        aisOff = 1 if bool(ais_raw) else 0

    inRestrictedZone = 1 if bool(data.get("inRestrictedZone", False)) else 0
    nearHighRiskArea = 1 if bool(data.get("nearHighRiskArea", False)) else 0
    routeDeviation = 1 if bool(data.get("routeDeviation", False)) else 0
    loitering = 1 if bool(data.get("loitering", False)) else 0
    nearBorder = 1 if bool(data.get("nearBorder", False)) else 0

    speed_variance = float(data.get("speed_variance") or (speedChange * 0.25 if speedChange else 1.2))
    time_in_zone = float(data.get("time_in_zone") or (45.0 if inRestrictedZone else 0.0))

    return [
        speed,
        heading,
        speedChange,
        speed_variance,
        time_in_zone,
        aisOff,
        inRestrictedZone,
        nearHighRiskArea,
        routeDeviation,
        loitering,
        nearBorder
    ]

def calculate_instance_contributions(features, model_bundle):
    """
    Computes instance-level feature contributions for explainability.
    Combines Random Forest global Gini importance with normalized telemetry activations.
    Returns the top 3 contributing features.
    """
    feature_importances = model_bundle.get("feature_importances", {})
    
    # Feature values unpacked
    (
        speed, heading, speedChange, speed_variance, time_in_zone,
        aisOff, inRestrictedZone, nearHighRiskArea, routeDeviation,
        loitering, nearBorder
    ) = features

    # Anomaly activation scores (0.0 to 1.0)
    activations = {
        "aisOff": 1.0 if aisOff else 0.0,
        "inRestrictedZone": 1.0 if inRestrictedZone else 0.0,
        "nearHighRiskArea": 1.0 if nearHighRiskArea else 0.0,
        "routeDeviation": 1.0 if routeDeviation else 0.0,
        "loitering": 1.0 if loitering else 0.0,
        "nearBorder": 1.0 if nearBorder else 0.0,
        "speedChange": min(1.0, max(0.0, speedChange / 45.0)),
        "speed_variance": min(1.0, max(0.0, speed_variance / 15.0)),
        "time_in_zone": min(1.0, max(0.0, time_in_zone / 120.0)),
        "speed": 1.0 if speed < 4.0 else (0.6 if speed > 25.0 else 0.05),
        "heading": 0.05
    }

    raw_contributions = []
    for feat_name, activation in activations.items():
        base_imp = feature_importances.get(feat_name, {}).get("importance", 0.09)
        # Contribution score = global importance weight * local activation
        contrib = base_imp * activation
        raw_contributions.append((feat_name, contrib, activation))

    # Sort descending by contribution
    raw_contributions.sort(key=lambda x: x[1], reverse=True)
    total_active_contrib = sum(c[1] for c in raw_contributions) or 1.0

    top_3 = []
    for feat_name, contrib, act in raw_contributions[:3]:
        pct = int(round((contrib / total_active_contrib) * 100))
        pct = max(5, pct)
        top_3.append({
            "feature": feat_name,
            "label": FEATURE_LABELS.get(feat_name, feat_name),
            "impact": f"+{pct}%",
            "impactValue": pct,
            "active": act > 0.1
        })

    return top_3

def predict_vessel(data):
    """
    Main ML inference method.
    Returns:
    {
      "riskScore": int (0-100),
      "level": "LOW" | "MEDIUM" | "HIGH",
      "threatType": str,
      "confidence": float (percentage, e.g. 94.5),
      "contributingFeatures": list of top 3 features
    }
    """
    bundle = get_model()
    regressor = bundle["regressor"]
    classifier = bundle["classifier"]

    features = extract_features(data)
    X = np.array([features])

    # 1. Regress continuous risk score (0-100)
    raw_score = float(regressor.predict(X)[0])
    risk_score = int(round(np.clip(raw_score, 0, 100)))

    # 2. Classify threat category and calculate prediction confidence
    threat_type = str(classifier.predict(X)[0])
    probs = classifier.predict_proba(X)[0]
    confidence = round(float(np.max(probs)) * 100.0, 1)

    # 3. Categorize ML Level strictly from continuous risk score (>=70 HIGH, 35-69 MEDIUM, <35 LOW)
    if risk_score >= 70:
        level = "HIGH"
    elif risk_score >= 35:
        level = "MEDIUM"
    else:
        level = "LOW"
        # If the risk score is low (<35), it represents safe/nominal transit
        if confidence < 50.0 and threat_type in ("Illegal Fishing", "Border Intrusion", "Dark Activity / Smuggling"):
            threat_type = "Normal Transit"

    # 4. Extract top 3 contributing features
    contributing_features = calculate_instance_contributions(features, bundle)

    return {
        "riskScore": risk_score,
        "level": level,
        "threatType": threat_type,
        "confidence": confidence,
        "contributingFeatures": contributing_features
    }

# Pre-load on import
get_model()
