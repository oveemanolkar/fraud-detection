"""
feature_engineering.py

Maps 12 human-readable credit card transaction fields
into the feature vector the Isolation Forest model expects:
[Time, V1-V28, Amount]

V1-V28 were originally PCA components in the dataset.
We simulate realistic feature signals using weighted combinations
of the input fields — each Vi targets a known fraud signal.
"""

import numpy as np


# ─────────────────────────────────────────────────────────────
# Helper mappings
# ─────────────────────────────────────────────────────────────

MERCHANT_RISK = {
    "retail":          0.2,
    "food_dining":     0.1,
    "travel":          0.5,
    "electronics":     0.7,
    "healthcare":      0.1,
    "entertainment":   0.3,
    "atm_cash":        0.8,
    "other":           0.4,
}

TRANSACTION_TYPE_RISK = {
    "online":          0.6,
    "in_store":        0.2,
    "atm_withdrawal":  0.8,
    "international":   0.9,
    "contactless":     0.3,
}

TIME_OF_DAY_MAP = {
    "morning":    8 * 3600,    # 8 AM in seconds
    "afternoon":  13 * 3600,   # 1 PM
    "evening":    19 * 3600,   # 7 PM
    "night":      2 * 3600,    # 2 AM — highest fraud risk
}

TIME_RISK = {
    "morning":   0.1,
    "afternoon": 0.1,
    "evening":   0.3,
    "night":     0.9,
}

DAY_RISK = {
    "weekday": 0.2,
    "weekend": 0.5,
}


# ─────────────────────────────────────────────────────────────
# Main function
# ─────────────────────────────────────────────────────────────

def engineer_features(form_data: dict) -> list:
    """
    Input: dict with 12 transaction fields from the user form
    Output: list of 30 floats [Time, V1..V28, Amount]
    """

    # ── Extract fields ──────────────────────────────────────
    amount              = float(form_data.get("amount", 0))
    merchant_category   = form_data.get("merchant_category", "other").lower()
    transaction_type    = form_data.get("transaction_type", "in_store").lower()
    card_present        = form_data.get("card_present", True)        # bool
    time_of_day         = form_data.get("time_of_day", "afternoon").lower()
    day_of_week         = form_data.get("day_of_week", "weekday").lower()
    country             = form_data.get("country", "domestic").lower()
    velocity            = int(form_data.get("velocity", 0))          # txns in last hour
    account_age_months  = int(form_data.get("account_age_months", 24))
    previously_disputed = form_data.get("previously_disputed", False)
    device_match        = form_data.get("device_match", True)
    billing_ship_match  = form_data.get("billing_shipping_match", True)

    # ── Risk scores (0.0 = low risk, 1.0 = high risk) ───────
    merchant_risk  = MERCHANT_RISK.get(merchant_category, 0.4)
    type_risk      = TRANSACTION_TYPE_RISK.get(transaction_type, 0.4)
    time_risk      = TIME_RISK.get(time_of_day, 0.3)
    day_risk       = DAY_RISK.get(day_of_week, 0.3)
    country_risk   = 0.9 if country == "foreign" else 0.1
    card_risk      = 0.8 if not card_present else 0.1
    velocity_risk  = min(velocity / 10.0, 1.0)                      # normalize 0-1
    age_risk       = max(0.0, 1.0 - account_age_months / 36.0)      # newer = riskier
    dispute_risk   = 0.9 if previously_disputed else 0.05
    device_risk    = 0.8 if not device_match else 0.05
    ship_risk      = 0.7 if not billing_ship_match else 0.05
    amount_risk    = min(amount / 5000.0, 1.0)                       # normalize

    # ── Time feature ─────────────────────────────────────────
    time_seconds = TIME_OF_DAY_MAP.get(time_of_day, 13 * 3600)
    if day_of_week == "weekend":
        time_seconds += 86400  # add 1 day for weekend

    # ── Engineer V1–V28 ──────────────────────────────────────
    # Each Vi is a weighted linear combination targeting a known
    # fraud signal in the original PCA space.
    # Negative values = more anomalous (matching dataset patterns)

    V = [0.0] * 28

    # V1  — card-not-present + online fraud signal
    V[0]  = -2.5 * card_risk - 1.8 * type_risk + 0.5

    # V2  — amount anomaly signal
    V[1]  = -1.8 * amount_risk - 1.2 * merchant_risk + 0.3

    # V3  — velocity / transaction frequency signal
    V[2]  = -4.0 * velocity_risk - 2.5 * time_risk - 2.0 * card_risk + 0.8

    # V4  — merchant category risk
    V[3]  = 1.2 * (1 - merchant_risk) - 0.8 * type_risk

    # V5  — geographic / international signal
    V[4]  = -3.5 * country_risk - 2.0 * type_risk - 1.5 * card_risk + 0.4

    # V6  — time-of-day anomaly
    V[5]  = -1.5 * time_risk - 0.8 * day_risk + 0.6

    # V7  — account age signal (new accounts = riskier)
    V[6]  = -2.0 * age_risk - 0.5 * dispute_risk + 0.3

    # V8  — device fingerprint mismatch
    V[7]  = -2.5 * device_risk - 1.0 * card_risk + 0.2

    # V9  — billing/shipping mismatch (online fraud)
    V[8]  = -2.0 * ship_risk - 1.5 * card_risk + 0.1

    # V10 — dispute history signal
    V[9]  = -3.0 * dispute_risk - 1.0 * velocity_risk + 0.5

    # V11 — combined legit signal (high = more normal)
    V[10] = 1.5 * (1 - type_risk) + 0.8 * (1 - merchant_risk)

    # V12 — high-value transaction anomaly
    V[11] = -2.0 * amount_risk - 1.2 * country_risk + 0.4

    # V13 — weekend + night combined risk
    V[12] = -1.8 * day_risk - 1.5 * time_risk + 0.3

    # V14 — strong fraud composite (most important feature in dataset)
    fraud_signal = (
        3.5 * card_risk +
        3.2 * device_risk +
        3.0 * country_risk +
        2.8 * dispute_risk +
        2.5 * velocity_risk +
        2.0 * amount_risk +
        2.0 * ship_risk +
        1.5 * time_risk +
        1.5 * age_risk
    )
    V[13] = -fraud_signal + 0.3

    # V15 — atm/cash withdrawal signal
    V[14] = -2.0 * (1 if transaction_type == "atm_withdrawal" else 0) \
            - 1.0 * amount_risk + 0.5

    # V16 — cross-border + card-not-present
    V[15] = -1.8 * country_risk - 1.2 * card_risk + 0.3

    # V17 — rapid succession transactions
    V[16] = -2.5 * velocity_risk - 0.8 * time_risk + 0.2

    # V18 — electronics + online = high risk combo
    V[17] = -1.5 * (1 if merchant_category == "electronics" else 0) \
            - 1.2 * (1 if transaction_type == "online" else 0) + 0.4

    # V19 — low-risk normal signal
    V[18] = 0.8 * (1 - merchant_risk) + 0.5 * (1 if card_present else 0)

    # V20 — amount vs merchant category mismatch
    V[19] = -1.0 * amount_risk * merchant_risk + 0.2

    # V21 — account age vs transaction size
    V[20] = -1.5 * age_risk * amount_risk + 0.3

    # V22 — device + billing mismatch combo
    V[21] = -1.2 * device_risk - 1.0 * ship_risk + 0.4

    # V23 — small amount testing pattern (card testing fraud)
    card_test_signal = 1.0 if (amount < 5 and velocity > 3) else 0.0
    V[22] = -3.0 * card_test_signal - 0.5 * velocity_risk + 0.3

    # V24 — weekend international
    V[23] = -1.5 * country_risk * day_risk + 0.2

    # V25 — overall composite risk
    overall_risk = np.mean([
        card_risk, type_risk, time_risk, country_risk,
        velocity_risk, dispute_risk, device_risk
    ])
    V[24] = -2.0 * overall_risk + 0.5

    # V26 — transaction type + time combo
    V[25] = -1.0 * type_risk - 0.8 * time_risk + 0.5

    # V27 — small residual noise (adds realism)
    V[26] = np.random.normal(0, 0.1)

    # V28 — small residual noise
    V[27] = np.random.normal(0, 0.05)

    # ── Final feature vector: [Time, V1..V28, Amount] ────────
    feature_vector = [time_seconds] + V + [amount]

    return feature_vector


def get_risk_explanation(form_data: dict) -> list:
    """
    Returns a list of human-readable risk factors for the UI.
    """
    reasons = []

    if not form_data.get("card_present", True):
        reasons.append("Card not physically present")

    if form_data.get("country", "domestic") == "foreign":
        reasons.append("International transaction")

    if form_data.get("transaction_type", "") == "atm_withdrawal":
        reasons.append("ATM cash withdrawal")

    if form_data.get("time_of_day", "") == "night":
        reasons.append("Transaction at night (2AM-5AM)")

    if int(form_data.get("velocity", 0)) >= 5:
        reasons.append(f"High transaction velocity ({form_data['velocity']} transactions/hour)")

    if form_data.get("previously_disputed", False):
        reasons.append("Account has previous disputes")

    if not form_data.get("device_match", True):
        reasons.append("Unknown device fingerprint")

    if not form_data.get("billing_shipping_match", True):
        reasons.append("Billing and shipping address mismatch")

    if float(form_data.get("amount", 0)) > 1000:
        reasons.append(f"High transaction amount (${form_data['amount']})")

    if int(form_data.get("account_age_months", 24)) < 3:
        reasons.append("Very new account (less than 3 months old)")

    if form_data.get("merchant_category", "") in ["atm_cash", "electronics"]:
        reasons.append(f"High-risk merchant category: {form_data['merchant_category']}")

    return reasons if reasons else ["No significant risk factors detected"]