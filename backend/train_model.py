"""
MARISENTINEL — Random Forest Model Training Script
Trains a dual Random Forest Regressor & Classifier on maritime operational telemetry.
Outputs: backend/model/risk_model.pkl
"""

import os
import joblib
import numpy as np
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, accuracy_score

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
    "speed": "Vessel Speed (kts)",
    "heading": "Vessel Course (°)",
    "speedChange": "Abrupt Speed Change (kts)",
    "speed_variance": "Speed Variance Metric",
    "time_in_zone": "Dwell Time in Restricted Grid (min)",
    "aisOff": "AIS Transponder Signal Blackout",
    "inRestrictedZone": "Restricted Maritime Perimeter Intrusion",
    "nearHighRiskArea": "Proximity to Designated High-Risk Area",
    "routeDeviation": "Corridor Course Deviation",
    "loitering": "Prolonged Stationary Loitering",
    "nearBorder": "Proximity to International Maritime Boundary (IMBL)"
}

def generate_synthetic_dataset(n_samples=4000, random_state=42):
    rng = np.random.RandomState(random_state)
    
    X = []
    y_scores = []
    y_levels = []
    y_types = []

    for _ in range(n_samples):
        scenario = rng.choice([
            "normal", "dark_smuggling", "loitering", 
            "illegal_fishing", "border_intrusion", 
            "anomalous_behavior", "high_risk_transit"
        ], p=[0.40, 0.12, 0.12, 0.10, 0.08, 0.10, 0.08])

        if scenario == "normal":
            speed = rng.uniform(8.0, 22.0)
            heading = rng.uniform(0.0, 360.0)
            speedChange = rng.uniform(0.0, 12.0)
            speed_variance = rng.uniform(0.1, 2.5)
            time_in_zone = 0.0
            aisOff = 0
            inRestrictedZone = 0
            nearHighRiskArea = 0
            routeDeviation = 0
            loitering = 0
            nearBorder = 0
            
            score = rng.uniform(2.0, 24.0)
            level = "LOW"
            threat_type = "Normal Transit"

        elif scenario == "dark_smuggling":
            speed = rng.uniform(4.0, 24.0)
            heading = rng.uniform(0.0, 360.0)
            speedChange = rng.uniform(15.0, 45.0)
            speed_variance = rng.uniform(5.0, 16.0)
            time_in_zone = rng.uniform(20.0, 180.0)
            aisOff = 1
            inRestrictedZone = 1 if rng.rand() > 0.3 else 0
            nearHighRiskArea = 1 if rng.rand() > 0.4 else 0
            routeDeviation = 1 if rng.rand() > 0.4 else 0
            loitering = 1 if rng.rand() > 0.6 else 0
            nearBorder = 1 if rng.rand() > 0.5 else 0

            score = rng.uniform(78.0, 98.0)
            level = "HIGH"
            threat_type = "Dark Activity / Smuggling"

        elif scenario == "loitering":
            speed = rng.uniform(0.2, 3.8)
            heading = rng.uniform(0.0, 360.0)
            speedChange = rng.uniform(1.0, 15.0)
            speed_variance = rng.uniform(0.2, 4.0)
            time_in_zone = rng.uniform(45.0, 240.0)
            aisOff = 1 if rng.rand() > 0.7 else 0
            inRestrictedZone = 1 if rng.rand() > 0.5 else 0
            nearHighRiskArea = 1
            routeDeviation = 1 if rng.rand() > 0.6 else 0
            loitering = 1
            nearBorder = 1 if rng.rand() > 0.7 else 0

            score = rng.uniform(62.0, 88.0)
            level = "HIGH" if score >= 70.0 else "MEDIUM"
            threat_type = "Suspicious Loitering"

        elif scenario == "illegal_fishing":
            speed = rng.uniform(1.0, 4.8)
            heading = rng.uniform(0.0, 360.0)
            speedChange = rng.uniform(2.0, 18.0)
            speed_variance = rng.uniform(1.0, 5.0)
            time_in_zone = rng.uniform(30.0, 200.0)
            aisOff = 1 if rng.rand() > 0.6 else 0
            inRestrictedZone = 1
            nearHighRiskArea = 1 if rng.rand() > 0.5 else 0
            routeDeviation = 1 if rng.rand() > 0.5 else 0
            loitering = 0
            nearBorder = 1 if rng.rand() > 0.6 else 0

            score = rng.uniform(72.0, 94.0)
            level = "HIGH"
            threat_type = "Illegal Fishing"

        elif scenario == "border_intrusion":
            speed = rng.uniform(6.0, 26.0)
            heading = rng.uniform(0.0, 360.0)
            speedChange = rng.uniform(8.0, 28.0)
            speed_variance = rng.uniform(2.0, 8.0)
            time_in_zone = rng.uniform(10.0, 90.0)
            aisOff = 1 if rng.rand() > 0.5 else 0
            inRestrictedZone = 1 if rng.rand() > 0.5 else 0
            nearHighRiskArea = 1 if rng.rand() > 0.4 else 0
            routeDeviation = 1
            loitering = 0
            nearBorder = 1

            score = rng.uniform(74.0, 96.0)
            level = "HIGH"
            threat_type = "Border Intrusion"

        elif scenario == "anomalous_behavior":
            speed = rng.uniform(8.0, 28.0)
            heading = rng.uniform(0.0, 360.0)
            speedChange = rng.uniform(31.0, 60.0)
            speed_variance = rng.uniform(6.0, 20.0)
            time_in_zone = rng.uniform(0.0, 60.0)
            aisOff = 1 if rng.rand() > 0.8 else 0
            inRestrictedZone = 0
            nearHighRiskArea = 1 if rng.rand() > 0.6 else 0
            routeDeviation = 1 if rng.rand() > 0.4 else 0
            loitering = 0
            nearBorder = 0

            score = rng.uniform(42.0, 69.0)
            level = "MEDIUM"
            threat_type = "Anomalous Behavior"

        else: # high_risk_transit
            speed = rng.uniform(9.0, 18.0)
            heading = rng.uniform(0.0, 360.0)
            speedChange = rng.uniform(2.0, 16.0)
            speed_variance = rng.uniform(0.5, 3.5)
            time_in_zone = rng.uniform(0.0, 45.0)
            aisOff = 0
            inRestrictedZone = 0
            nearHighRiskArea = 1
            routeDeviation = 1 if rng.rand() > 0.7 else 0
            loitering = 0
            nearBorder = 0

            score = rng.uniform(34.0, 58.0)
            level = "MEDIUM"
            threat_type = "High Risk Transit"

        row = [
            round(speed, 2),
            round(heading, 1),
            round(speedChange, 2),
            round(speed_variance, 2),
            round(time_in_zone, 1),
            int(aisOff),
            int(inRestrictedZone),
            int(nearHighRiskArea),
            int(routeDeviation),
            int(loitering),
            int(nearBorder)
        ]
        X.append(row)
        y_scores.append(round(score, 1))
        y_levels.append(level)
        y_types.append(threat_type)

    return np.array(X), np.array(y_scores), np.array(y_levels), np.array(y_types)

def train_and_save():
    print("[*] Generating maritime training dataset (4,000 samples)...")
    X, y_scores, y_levels, y_types = generate_synthetic_dataset()

    X_train, X_test, y_score_train, y_score_test, y_type_train, y_type_test = train_test_split(
        X, y_scores, y_types, test_size=0.2, random_state=42
    )

    print("[*] Training RandomForestRegressor for continuous Risk Score (0-100)...")
    regressor = RandomForestRegressor(
        n_estimators=120,
        max_depth=12,
        min_samples_split=4,
        random_state=42,
        n_jobs=-1
    )
    regressor.fit(X_train, y_score_train)
    score_preds = regressor.predict(X_test)
    mae = mean_absolute_error(y_score_test, score_preds)
    print(f"    [+] Regressor MAE: {mae:.2f} pts")

    print("[*] Training RandomForestClassifier for Threat Type & Severity Level...")
    classifier = RandomForestClassifier(
        n_estimators=120,
        max_depth=12,
        min_samples_split=4,
        random_state=42,
        n_jobs=-1
    )
    classifier.fit(X_train, y_type_train)
    type_preds = classifier.predict(X_test)
    acc = accuracy_score(y_type_test, type_preds)
    print(f"    [+] Classifier Threat Type Accuracy: {acc * 100:.2f}%")

    # Calculate global feature importances
    reg_importances = regressor.feature_importances_
    clf_importances = classifier.feature_importances_
    combined_importances = (reg_importances + clf_importances) / 2.0

    feature_importance_dict = {
        name: {
            "importance": round(float(imp), 4),
            "label": FEATURE_LABELS[name]
        }
        for name, imp in zip(FEATURE_NAMES, combined_importances)
    }

    model_bundle = {
        "regressor": regressor,
        "classifier": classifier,
        "feature_names": FEATURE_NAMES,
        "feature_labels": FEATURE_LABELS,
        "feature_importances": feature_importance_dict,
        "classes": list(classifier.classes_),
        "metadata": {
            "model_type": "Dual Random Forest (Regressor + Classifier)",
            "n_estimators": 120,
            "regressor_mae": round(float(mae), 3),
            "classifier_accuracy": round(float(acc), 4),
            "training_samples": len(X_train)
        }
    }

    out_dir = os.path.join(os.path.dirname(__file__), "model")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "risk_model.pkl")
    joblib.dump(model_bundle, out_path)
    print(f"[✓] Model successfully serialized to: {out_path}")

if __name__ == "__main__":
    train_and_save()
