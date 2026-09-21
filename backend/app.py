"""
MARISENTINEL — Flask API Server
Port: 5005
Provides endpoints for Random Forest ML prediction, Hybrid AI fusion,
and thesis explainability metrics.
"""

import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from services.mlService import predict_vessel, get_model
from services.fusionService import fuse_vessel_telemetry, evaluate_rules, fuse_vessels_batch

app = Flask(__name__)
# Enable CORS for all domains to support frontend execution
CORS(app, resources={r"/*": {"origins": "*"}})

# Ensure model is preloaded on server startup
try:
    get_model()
    print("[*] Random Forest risk model loaded once at startup.")
except Exception as e:
    print(f"[!] Warning: Model could not be pre-loaded at startup: {e}")

@app.route("/", methods=["GET"])
def root():
    return jsonify({
        "status": "online",
        "service": "MARISENTINEL Hybrid AI Backend",
        "endpoints": {
            "health": "/health",
            "modelInfo": "/model-info",
            "predict": "/predict",
            "fusion": "/fusion",
            "batchPredict": "/batch-predict"
        }
    }), 200

@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({
        "status": "healthy",
        "service": "MARISENTINEL Hybrid AI Backend",
        "port": 5005,
        "engine": "Random Forest (Dual Regressor + Classifier)"
    }), 200

@app.route("/model-info", methods=["GET"])
def model_info():
    try:
        bundle = get_model()
        return jsonify({
            "metadata": bundle.get("metadata", {}),
            "featureNames": bundle.get("feature_names", []),
            "featureImportances": bundle.get("feature_importances", {}),
            "threatClasses": bundle.get("classes", [])
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/predict", methods=["POST"])
def predict():
    """
    Step 1 ML Prediction Endpoint:
    Processes vessel telemetry strictly through the Random Forest model.
    No rule logic is used for this decision.
    """
    try:
        data = request.get_json(force=True, silent=True) or {}
        vessel_id = data.get("vesselId") or data.get("id") or "UNKNOWN"
        
        # Run Random Forest prediction
        ml_res = predict_vessel(data)
        
        response = {
            "vesselId": vessel_id,
            "riskScore": ml_res["riskScore"],
            "level": ml_res["level"],
            "threatType": ml_res["threatType"],
            "confidence": ml_res["confidence"],
            "contributingFeatures": ml_res.get("contributingFeatures", [])
        }
        return jsonify(response), 200
    except Exception as e:
        return jsonify({"error": f"Prediction failed: {str(e)}"}), 400

@app.route("/fusion", methods=["POST"])
def fusion():
    """
    Step 3 Hybrid Fusion Endpoint:
    Combines primary ML decision with explanation-only rule insights.
    """
    try:
        data = request.get_json(force=True, silent=True) or {}
        fused = fuse_vessel_telemetry(data)
        return jsonify(fused), 200
    except Exception as e:
        return jsonify({"error": f"Fusion failed: {str(e)}"}), 400

@app.route("/batch-predict", methods=["POST"])
def batch_predict():
    """
    Batch endpoint to predict & fuse an array of vessels for fast map initialization.
    """
    try:
        body = request.get_json(force=True, silent=True) or {}
        vessels = body.get("vessels", [])
        if not isinstance(vessels, list):
            vessels = [vessels]

        results = fuse_vessels_batch(vessels)
        return jsonify({"results": results}), 200
    except Exception as e:
        return jsonify({"error": f"Batch prediction failed: {str(e)}"}), 400

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5005))
    print(f"[*] Starting MARISENTINEL Flask API on port {port}...")
    app.run(host="0.0.0.0", port=port, debug=False)
