import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, confusion_matrix
import joblib
import sqlalchemy as db
import os
import json

# ─────────────────────────────────────────
# 1. Load Dataset
# ─────────────────────────────────────────
print("Loading dataset...")
DATA_PATH = os.path.join(os.path.dirname(__file__), "../data/creditcard.csv")
df = pd.read_csv(DATA_PATH)
print(f"Dataset loaded: {df.shape[0]:,} transactions, {df.shape[1]} features")
print(f"Fraud rate: {df['Class'].mean()*100:.4f}%")

# ─────────────────────────────────────────
# 2. Preprocess
# ─────────────────────────────────────────
print("\nPreprocessing...")
# Separate features
features = [col for col in df.columns if col != "Class"]
X = df[features].copy()
y = df["Class"]

# Scale Amount and Time (V1-V28 are already PCA-transformed)
scaler = StandardScaler()
X[["Amount", "Time"]] = scaler.fit_transform(X[["Amount", "Time"]])

# ─────────────────────────────────────────
# 3. Train Isolation Forest
# ─────────────────────────────────────────
print("\nTraining Isolation Forest model...")
# contamination = actual fraud rate in dataset
fraud_rate = df["Class"].mean()

model = IsolationForest(
    n_estimators=100,
    contamination=fraud_rate,
    max_samples="auto",
    random_state=42,
    n_jobs=-1,       # use all CPU cores
    verbose=1
)
model.fit(X)
print("Model training complete.")

# ─────────────────────────────────────────
# 4. Evaluate
# ─────────────────────────────────────────
print("\nEvaluating model...")
# Isolation Forest returns -1 for anomaly, 1 for normal
# Map to 1 (fraud) and 0 (normal) to match dataset labels
raw_preds = model.predict(X)
y_pred = np.where(raw_preds == -1, 1, 0)

print("\nClassification Report:")
print(classification_report(y, y_pred, target_names=["Normal", "Fraud"]))

cm = confusion_matrix(y, y_pred)
print(f"Confusion Matrix:\n{cm}")

tn, fp, fn, tp = cm.ravel()
precision = tp / (tp + fp) if (tp + fp) > 0 else 0
recall    = tp / (tp + fn) if (tp + fn) > 0 else 0
f1        = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0

print(f"\nFraud Detection Metrics:")
print(f"  True Positives  (caught fraud):    {tp}")
print(f"  False Positives (false alarms):    {fp}")
print(f"  False Negatives (missed fraud):    {fn}")
print(f"  Precision: {precision:.4f}")
print(f"  Recall:    {recall:.4f}")
print(f"  F1 Score:  {f1:.4f}")

# ─────────────────────────────────────────
# 5. Save model + scaler + metrics
# ─────────────────────────────────────────
os.makedirs("models", exist_ok=True)

joblib.dump(model, "models/isolation_forest.pkl")
joblib.dump(scaler, "models/scaler.pkl")

metrics = {
    "total_transactions": int(df.shape[0]),
    "total_fraud": int(y.sum()),
    "fraud_rate_pct": round(float(fraud_rate * 100), 4),
    "true_positives": int(tp),
    "false_positives": int(fp),
    "false_negatives": int(fn),
    "true_negatives": int(tn),
    "precision": round(float(precision), 4),
    "recall": round(float(recall), 4),
    "f1_score": round(float(f1), 4),
    "n_estimators": 100,
    "contamination": round(float(fraud_rate), 6),
}

with open("models/metrics.json", "w") as f:
    json.dump(metrics, f, indent=2)

print("\nSaved:")
print("  models/isolation_forest.pkl")
print("  models/scaler.pkl")
print("  models/metrics.json")

# ─────────────────────────────────────────
# 6. SQL Pipeline — store transactions in SQLite
# ─────────────────────────────────────────
print("\nBuilding SQL pipeline...")
DB_PATH = "sqlite:///fraud_detection.db"
engine = db.create_engine(DB_PATH)

# Add prediction and anomaly score columns to DataFrame
df["prediction"] = y_pred          # 1 = fraud, 0 = normal
df["anomaly_score"] = model.decision_function(X)  # lower = more anomalous
df["anomaly_score"] = df["anomaly_score"].round(6)

# Store to SQLite (use chunks for 280K rows)
print("Writing transactions to SQLite (this may take a moment)...")
df.to_sql("transactions", engine, if_exists="replace", index=True, index_label="id", chunksize=5000)

# Create a summary view / aggregation table
summary = pd.DataFrame([{
    "total_transactions": int(df.shape[0]),
    "total_fraud_detected": int(y_pred.sum()),
    "total_legitimate": int((y_pred == 0).sum()),
    "fraud_rate_pct": round(float(y_pred.mean() * 100), 4),
    "avg_fraud_amount": round(float(df[df["prediction"] == 1]["Amount"].mean()), 2),
    "avg_normal_amount": round(float(df[df["prediction"] == 0]["Amount"].mean()), 2),
    "max_fraud_amount": round(float(df[df["prediction"] == 1]["Amount"].max()), 2),
}])
summary.to_sql("fraud_summary", engine, if_exists="replace", index=False)

print(f"SQL pipeline complete. Database: fraud_detection.db")
print(f"\n{'='*50}")
print("TRAINING COMPLETE!")
print(f"{'='*50}")
print(f"Total transactions: {df.shape[0]:,}")
print(f"Fraud detected:     {int(y_pred.sum()):,}")
print(f"Model saved to:     backend/models/")
print(f"Database saved to:  backend/fraud_detection.db")