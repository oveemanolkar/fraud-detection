"use client";
import { useState } from "react";
import { Shield, AlertTriangle, CheckCircle, ChevronRight, RotateCcw, Info } from "lucide-react";

const API = "http://localhost:5000";

const INITIAL = {
  amount:                 "",
  merchant_category:      "retail",
  transaction_type:       "in_store",
  card_present:           true,
  time_of_day:            "afternoon",
  day_of_week:            "weekday",
  country:                "domestic",
  velocity:               "0",
  account_age_months:     "24",
  previously_disputed:    false,
  device_match:           true,
  billing_shipping_match: true,
};

const FIELD_INFO: Record<string, string> = {
  amount:                 "The total dollar value of this transaction.",
  merchant_category:      "The type of business where the transaction occurred.",
  transaction_type:       "How the transaction was made — in person, online, at an ATM, etc.",
  time_of_day:            "The time of day the transaction took place. Late-night transactions carry higher risk.",
  day_of_week:            "Whether the transaction occurred on a weekday or weekend.",
  country:                "Whether the transaction occurred in the cardholder's home country or abroad.",
  velocity:               "How many transactions have been made with this card in the last hour. High velocity is a red flag.",
  account_age_months:     "How old the credit card account is in months. Newer accounts are higher risk.",
  card_present:           "Was the physical card used? Card-not-present (online/phone) transactions are riskier.",
  previously_disputed:    "Has this account previously disputed a charge? Prior disputes increase fraud likelihood.",
  device_match:           "Is the transaction coming from a recognized device? Unknown devices are suspicious.",
  billing_shipping_match: "For online orders: does the billing address match the shipping address? Mismatches are a fraud signal.",
};

interface Result {
  is_fraud:      boolean;
  prediction:    string;
  risk_level:    string;
  anomaly_score: number;
  amount:        number;
  risk_factors:  string[];
  input_summary: Record<string, any>;
}

function Tooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", marginLeft: 6 }}>
      <Info
        size={13}
        color="var(--muted)"
        style={{ cursor: "pointer" }}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      />
      {show && (
        <span style={{
          position: "absolute", bottom: "calc(100% + 6px)", left: "50%",
          transform: "translateX(-50%)",
          background: "var(--surface2)", border: "1px solid var(--border)",
          borderRadius: 6, padding: "0.5rem 0.75rem",
          fontSize: "0.72rem", color: "var(--text)",
          width: 220, zIndex: 999, lineHeight: 1.5,
          boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          pointerEvents: "none",
        }}>
          {text}
        </span>
      )}
    </span>
  );
}

export default function PredictPage() {
  const [form, setForm]       = useState({ ...INITIAL });
  const [result, setResult]   = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const set = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }));

  const handleSubmit = async () => {
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) {
      setError("Please enter a valid transaction amount greater than $0.");
      return;
    }
    setError("");
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`${API}/api/predict`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          amount:             Number(form.amount),
          velocity:           Number(form.velocity),
          account_age_months: Number(form.account_age_months),
        }),
      });
      const data = await res.json();
      if (data.error) {
        setError(`API Error: ${data.error}`);
      } else {
        setResult(data);
      }
    } catch {
      setError("Could not connect to the API. Make sure the Flask server is running on port 5000.");
    }
    setLoading(false);
  };

  const riskColor = !result ? "var(--accent)"
    : result.risk_level === "HIGH"   ? "var(--fraud)"
    : result.risk_level === "MEDIUM" ? "var(--warn)"
    : "var(--legit)";

  const LabelWithTip = ({ fieldKey, label }: { fieldKey: string; label: string }) => (
    <label className="label" style={{ display: "flex", alignItems: "center" }}>
      {label}
      <Tooltip text={FIELD_INFO[fieldKey] || ""} />
    </label>
  );

  return (
    <div style={{ padding: "2rem", maxWidth: 1100, margin: "0 auto" }}>

      {/* Header */}
      <div className="animate-fade-in" style={{ marginBottom: "2rem" }}>
        <p style={{ fontFamily: "Space Mono", fontSize: "0.7rem", color: "var(--accent)", letterSpacing: "0.15em", marginBottom: "0.5rem" }}>
          TRANSACTION ANALYSIS
        </p>
        <h1 style={{ fontSize: "2.2rem", fontWeight: 800, letterSpacing: "-0.03em" }}>
          Fraud <span style={{ color: "var(--accent)" }}>Analyzer</span>
        </h1>
        <p style={{ color: "var(--muted)", marginTop: "0.5rem", fontSize: "0.9rem" }}>
          Enter credit card transaction details below. Hover the <Info size={12} style={{ display: "inline", verticalAlign: "middle" }} /> icons for field explanations.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: result ? "1fr 1fr" : "1fr", gap: "1.5rem", alignItems: "start" }}>

        {/* ── Form ── */}
        <div className="card animate-fade-in-2" style={{ padding: "1.75rem" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Shield size={18} color="var(--accent)" /> Transaction Details
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>

            {/* Amount */}
            <div style={{ gridColumn: "1 / -1" }}>
              <LabelWithTip fieldKey="amount" label="Transaction Amount (USD)" />
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "var(--accent)", fontFamily: "Space Mono", fontWeight: 700 }}>$</span>
                <input className="input" type="number" placeholder="0.00"
                  value={form.amount} onChange={e => set("amount", e.target.value)}
                  style={{ paddingLeft: "2rem" }} min="0" step="0.01" />
              </div>
            </div>

            {/* Merchant Category */}
            <div>
              <LabelWithTip fieldKey="merchant_category" label="Merchant Category" />
              <select className="input" value={form.merchant_category} onChange={e => set("merchant_category", e.target.value)}>
                <option value="retail">🛒 Retail</option>
                <option value="food_dining">🍔 Food & Dining</option>
                <option value="travel">✈️ Travel</option>
                <option value="electronics">💻 Electronics</option>
                <option value="healthcare">🏥 Healthcare</option>
                <option value="entertainment">🎬 Entertainment</option>
                <option value="atm_cash">🏧 ATM / Cash</option>
                <option value="other">📦 Other</option>
              </select>
            </div>

            {/* Transaction Type */}
            <div>
              <LabelWithTip fieldKey="transaction_type" label="Transaction Type" />
              <select className="input" value={form.transaction_type} onChange={e => set("transaction_type", e.target.value)}>
                <option value="in_store">🏪 In-Store</option>
                <option value="online">🌐 Online</option>
                <option value="atm_withdrawal">🏧 ATM Withdrawal</option>
                <option value="international">🌍 International</option>
                <option value="contactless">📱 Contactless</option>
              </select>
            </div>

            {/* Time of Day */}
            <div>
              <LabelWithTip fieldKey="time_of_day" label="Time of Day" />
              <select className="input" value={form.time_of_day} onChange={e => set("time_of_day", e.target.value)}>
                <option value="morning">🌅 Morning (6AM–12PM)</option>
                <option value="afternoon">☀️ Afternoon (12PM–6PM)</option>
                <option value="evening">🌆 Evening (6PM–11PM)</option>
                <option value="night">🌙 Night (11PM–6AM)</option>
              </select>
            </div>

            {/* Day of Week */}
            <div>
              <LabelWithTip fieldKey="day_of_week" label="Day of Week" />
              <select className="input" value={form.day_of_week} onChange={e => set("day_of_week", e.target.value)}>
                <option value="weekday">📅 Weekday (Mon–Fri)</option>
                <option value="weekend">🗓️ Weekend (Sat–Sun)</option>
              </select>
            </div>

            {/* Country */}
            <div>
              <LabelWithTip fieldKey="country" label="Transaction Country" />
              <select className="input" value={form.country} onChange={e => set("country", e.target.value)}>
                <option value="domestic">🏠 Domestic (Home Country)</option>
                <option value="foreign">🌍 Foreign / International</option>
              </select>
            </div>

            {/* Velocity */}
            <div>
              <LabelWithTip fieldKey="velocity" label="Transactions in Last Hour" />
              <input className="input" type="number" min="0" max="50"
                value={form.velocity} onChange={e => set("velocity", e.target.value)}
                placeholder="e.g. 3" />
            </div>

            {/* Account Age */}
            <div style={{ gridColumn: "1 / -1" }}>
              <LabelWithTip fieldKey="account_age_months" label="Account Age (months)" />
              <input className="input" type="number" min="0" max="600"
                value={form.account_age_months} onChange={e => set("account_age_months", e.target.value)}
                placeholder="e.g. 24 = 2 years old" />
            </div>

            {/* Toggles */}
            <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              {([
                { key: "card_present",            label: "Card Physically Present", safeVal: true  },
                { key: "previously_disputed",      label: "Previously Disputed",     safeVal: false },
                { key: "device_match",             label: "Known Device",            safeVal: true  },
                { key: "billing_shipping_match",   label: "Billing = Shipping Addr", safeVal: true  },
              ] as const).map(({ key, label, safeVal }) => {
                const val = form[key as keyof typeof form] as boolean;
                const isRisky = val !== safeVal;
                return (
                  <div key={key} style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                    <label className="label" style={{ display: "flex", alignItems: "center", margin: 0 }}>
                      {label}
                      <Tooltip text={FIELD_INFO[key] || ""} />
                    </label>
                    <div onClick={() => set(key, !val)} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "0.65rem 1rem", borderRadius: 8, cursor: "pointer",
                      background: isRisky ? "rgba(255,61,113,0.08)" : "var(--surface2)",
                      border: `1px solid ${isRisky ? "rgba(255,61,113,0.3)" : "var(--border)"}`,
                      transition: "all 0.2s",
                    }}>
                      <span style={{ fontSize: "0.8rem", fontWeight: 600, color: isRisky ? "var(--fraud)" : "var(--text)" }}>
                        {val ? "Yes" : "No"}
                      </span>
                      <div style={{
                        width: 36, height: 20, borderRadius: 999,
                        background: val ? "var(--legit)" : "var(--border)",
                        position: "relative", transition: "background 0.2s", flexShrink: 0,
                      }}>
                        <div style={{
                          position: "absolute", top: 3, left: val ? 18 : 3,
                          width: 14, height: 14, borderRadius: "50%", background: "#fff",
                          transition: "left 0.2s",
                        }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {error && (
            <p style={{ fontFamily: "Space Mono", fontSize: "0.75rem", color: "var(--fraud)", marginTop: "1rem", padding: "0.75rem", background: "rgba(255,61,113,0.08)", borderRadius: 6 }}>
              ⚠ {error}
            </p>
          )}

          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
            <button className="btn-primary" onClick={handleSubmit} disabled={loading} style={{ flex: 1 }}>
              {loading ? "ANALYZING..." : "ANALYZE TRANSACTION →"}
            </button>
            <button onClick={() => { setForm({ ...INITIAL }); setResult(null); setError(""); }} style={{
              background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8,
              color: "var(--muted)", cursor: "pointer", padding: "0.75rem 1rem",
              display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem",
            }}>
              <RotateCcw size={14} /> Reset
            </button>
          </div>
        </div>

        {/* ── Result Panel ── */}
        {result && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

            {/* Verdict */}
            <div className="card" style={{
              padding: "2rem", textAlign: "center",
              background: result.is_fraud
                ? "linear-gradient(135deg, rgba(255,61,113,0.12), rgba(255,61,113,0.04))"
                : "linear-gradient(135deg, rgba(0,224,150,0.12), rgba(0,224,150,0.04))",
              border: `1px solid ${result.is_fraud ? "rgba(255,61,113,0.3)" : "rgba(0,224,150,0.3)"}`,
            }}>
              {result.is_fraud
                ? <AlertTriangle size={48} color="var(--fraud)" style={{ margin: "0 auto 1rem" }} />
                : <CheckCircle  size={48} color="var(--legit)" style={{ margin: "0 auto 1rem" }} />
              }
              <h2 style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.02em",
                color: result.is_fraud ? "var(--fraud)" : "var(--legit)" }}>
                {result.prediction}
              </h2>
              <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: "0.5rem" }}>
                Amount: <span style={{ fontFamily: "Space Mono", color: "var(--text)" }}>
                  ${Number(result.amount).toFixed(2)}
                </span>
              </p>
              <div style={{ marginTop: "1rem", display: "flex", justifyContent: "center" }}>
                <span className="badge" style={{
                  background: `rgba(${result.risk_level === "HIGH" ? "255,61,113" : result.risk_level === "MEDIUM" ? "255,170,0" : "0,224,150"}, 0.15)`,
                  color: riskColor, border: `1px solid ${riskColor}44`,
                  fontSize: "0.8rem", padding: "0.4rem 1rem",
                }}>
                  {result.risk_level} RISK
                </span>
              </div>
              <p style={{ fontFamily: "Space Mono", fontSize: "0.7rem", color: "var(--muted)", marginTop: "1rem" }}>
                ANOMALY SCORE: <span style={{ color: riskColor }}>{result.anomaly_score?.toFixed(6)}</span>
              </p>
            </div>

            {/* Risk Factors */}
            <div className="card" style={{ padding: "1.5rem" }}>
              <h3 style={{ fontSize: "0.85rem", fontWeight: 700, marginBottom: "1rem",
                display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <AlertTriangle size={16} color="var(--warn)" /> Risk Factors Detected
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {Array.isArray(result.risk_factors) && result.risk_factors.length > 0
                  ? result.risk_factors.map((factor, i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: "0.75rem",
                      padding: "0.6rem 0.75rem", borderRadius: 6,
                      background: factor.includes("No significant") ? "rgba(0,224,150,0.08)" : "rgba(255,61,113,0.08)",
                      border: `1px solid ${factor.includes("No significant") ? "rgba(0,224,150,0.2)" : "rgba(255,61,113,0.15)"}`,
                    }}>
                      <ChevronRight size={14} color={factor.includes("No significant") ? "var(--legit)" : "var(--fraud)"} />
                      <span style={{ fontSize: "0.8rem", color: "var(--text)" }}>{factor}</span>
                    </div>
                  ))
                  : (
                    <div style={{ padding: "0.6rem 0.75rem", borderRadius: 6, background: "rgba(0,224,150,0.08)", border: "1px solid rgba(0,224,150,0.2)" }}>
                      <span style={{ fontSize: "0.8rem", color: "var(--legit)" }}>✓ No significant risk factors detected</span>
                    </div>
                  )
                }
              </div>
            </div>

            {/* Input Summary */}
            <div className="card" style={{ padding: "1.5rem" }}>
              <h3 style={{ fontSize: "0.85rem", fontWeight: 700, marginBottom: "1rem" }}>Input Summary</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                {result.input_summary && Object.entries(result.input_summary).map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between",
                    padding: "0.4rem 0", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "capitalize" }}>
                      {k.replace(/_/g, " ")}
                    </span>
                    <span style={{ fontFamily: "Space Mono", fontSize: "0.75rem", color: "var(--text)" }}>
                      {String(v)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}