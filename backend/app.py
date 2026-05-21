from flask import Flask, jsonify, request
from flask_cors import CORS
import joblib
import numpy as np
import pandas as pd
import sqlalchemy as db
import json
import os

from feature_engineering import engineer_features, get_risk_explanation

# ─────────────────────────────────────────
# App Setup
# ─────────────────────────────────────────
app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(__file__)

print("Loading model...")
model  = joblib.load(os.path.join(BASE_DIR, "models/isolation_forest.pkl"))
scaler = joblib.load(os.path.join(BASE_DIR, "models/scaler.pkl"))
print("Model loaded.")

with open(os.path.join(BASE_DIR, "models/metrics.json")) as f:
    MODEL_METRICS = json.load(f)

DB_PATH = f"sqlite:///{os.path.join(BASE_DIR, 'fraud_detection.db')}"
engine  = db.create_engine(DB_PATH)


# ─────────────────────────────────────────
# Routes
# ─────────────────────────────────────────

@app.route("/")
def health():
    return jsonify({"status": "ok", "message": "Fraud Detection API is running"})


@app.route("/api/metrics", methods=["GET"])
def get_metrics():
    with engine.connect() as conn:
        summary = conn.execute(db.text("SELECT * FROM fraud_summary")).fetchone()
        summary_dict = dict(summary._mapping) if summary else {}
    return jsonify({**MODEL_METRICS, **summary_dict})


@app.route("/api/stats/overview", methods=["GET"])
def stats_overview():
    with engine.connect() as conn:
        total            = conn.execute(db.text("SELECT COUNT(*) FROM transactions")).scalar()
        fraud            = conn.execute(db.text("SELECT COUNT(*) FROM transactions WHERE prediction=1")).scalar()
        avg_amount       = conn.execute(db.text("SELECT AVG(Amount) FROM transactions")).scalar()
        avg_fraud_amount = conn.execute(db.text("SELECT AVG(Amount) FROM transactions WHERE prediction=1")).scalar()

    return jsonify({
        "total_transactions":      total,
        "fraud_detected":          fraud,
        "legitimate":              total - fraud,
        "fraud_rate_pct":          round(fraud / total * 100, 4),
        "avg_transaction_amount":  round(avg_amount or 0, 2),
        "avg_fraud_amount":        round(avg_fraud_amount or 0, 2),
    })


@app.route("/api/transactions", methods=["GET"])
def get_transactions():
    page     = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 50, type=int)
    filter_  = request.args.get("filter", "all")

    offset = (page - 1) * per_page
    where  = ""
    if filter_ == "fraud":
        where = "WHERE prediction = 1"
    elif filter_ == "normal":
        where = "WHERE prediction = 0"

    with engine.connect() as conn:
        total = conn.execute(db.text(f"SELECT COUNT(*) FROM transactions {where}")).scalar()
        rows  = conn.execute(db.text(f"""
            SELECT id, Time, Amount, prediction, anomaly_score, Class
            FROM transactions {where}
            ORDER BY anomaly_score ASC
            LIMIT :limit OFFSET :offset
        """), {"limit": per_page, "offset": offset}).fetchall()

    return jsonify({
        "transactions": [dict(r._mapping) for r in rows],
        "total":    total,
        "page":     page,
        "per_page": per_page,
        "pages":    (total + per_page - 1) // per_page,
    })


@app.route("/api/chart/amount-distribution", methods=["GET"])
def amount_distribution():
    with engine.connect() as conn:
        rows = conn.execute(db.text(
            "SELECT Amount, prediction FROM transactions WHERE Amount < 2500"
        )).fetchall()

    df     = pd.DataFrame([dict(r._mapping) for r in rows])
    bins   = [0, 50, 100, 250, 500, 1000, 2500]
    labels = ["$0-50", "$50-100", "$100-250", "$250-500", "$500-1K", "$1K-2.5K"]
    df["bin"] = pd.cut(df["Amount"], bins=bins, labels=labels)

    result = []
    for label in labels:
        subset = df[df["bin"] == label]
        result.append({
            "range":  label,
            "normal": int((subset["prediction"] == 0).sum()),
            "fraud":  int((subset["prediction"] == 1).sum()),
        })
    return jsonify(result)


@app.route("/api/chart/fraud-over-time", methods=["GET"])
def fraud_over_time():
    with engine.connect() as conn:
        rows = conn.execute(db.text(
            "SELECT Time, prediction FROM transactions"
        )).fetchall()

    df         = pd.DataFrame([dict(r._mapping) for r in rows])
    df["hour"] = (df["Time"] // 3600).astype(int)
    grouped    = df.groupby(["hour", "prediction"]).size().reset_index(name="count")

    result = []
    for h in sorted(df["hour"].unique().tolist()):
        subset = grouped[grouped["hour"] == h]
        result.append({
            "hour":   h,
            "normal": int(subset[subset["prediction"] == 0]["count"].sum()),
            "fraud":  int(subset[subset["prediction"] == 1]["count"].sum()),
        })
    return jsonify(result)


@app.route("/api/predict", methods=["POST"])
def predict():
    """
    Accepts 12 human-readable credit card transaction fields.
    Returns fraud prediction + risk explanation.

    Expected JSON:
    {
        "amount":                   240.50,
        "merchant_category":        "electronics",
        "transaction_type":         "online",
        "card_present":             false,
        "time_of_day":              "night",
        "day_of_week":              "weekend",
        "country":                  "foreign",
        "velocity":                 3,
        "account_age_months":       6,
        "previously_disputed":      false,
        "device_match":             false,
        "billing_shipping_match":   false
    }
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "No JSON body provided"}), 400

    try:
        # Step 1: Engineer features from human-readable fields
        feature_vector = engineer_features(data)

        # Step 2: Build DataFrame with correct column names
        feature_cols = ["Time"] + [f"V{i}" for i in range(1, 29)] + ["Amount"]
        row = pd.DataFrame([feature_vector], columns=feature_cols)

        # Step 3: Scale Amount and Time (same as training)
        row[["Amount", "Time"]] = scaler.transform(row[["Amount", "Time"]])

        # Step 4: Predict
        prediction    = model.predict(row)[0]           # -1 = anomaly, 1 = normal
        anomaly_score = model.decision_function(row)[0] # lower = more suspicious

        # Threshold tuned based on observed score distribution
        is_fraud     = bool(bool(prediction == -1) or bool(anomaly_score < 0.08))
        risk_level   = _get_risk_level(anomaly_score)
        risk_factors = get_risk_explanation(data)

        return jsonify({
            "is_fraud":      is_fraud,
            "prediction":    "FRAUD" if is_fraud else "LEGITIMATE",
            "risk_level":    risk_level,
            "anomaly_score": round(float(anomaly_score), 6),
            "amount":        data.get("amount", 0),
            "risk_factors":  risk_factors,
            "input_summary": {
                "merchant":     data.get("merchant_category"),
                "type":         data.get("transaction_type"),
                "country":      data.get("country"),
                "time_of_day":  data.get("time_of_day"),
                "card_present": str(data.get("card_present")),
                "velocity":     data.get("velocity"),
                "account_age":  data.get("account_age_months"),
            }
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


def _get_risk_level(anomaly_score: float) -> str:
    if anomaly_score < 0.08:
        return "HIGH"
    elif anomaly_score < 0.12:
        return "MEDIUM"
    else:
        return "LOW"


# ─────────────────────────────────────────
# Run
# ─────────────────────────────────────────
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)