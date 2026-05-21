"use client";
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from "recharts";
import { Shield, AlertTriangle, CheckCircle, Activity, TrendingUp, Database } from "lucide-react";
import Link from "next/link";

const API = "http://localhost:5000";

interface Overview {
  total_transactions: number;
  fraud_detected: number;
  legitimate: number;
  fraud_rate_pct: number;
  avg_transaction_amount: number;
  avg_fraud_amount: number;
}

interface Metrics {
  precision: number;
  recall: number;
  f1_score: number;
  n_estimators: number;
  contamination: number;
}

export default function Dashboard() {
  const [overview, setOverview]   = useState<Overview | null>(null);
  const [metrics, setMetrics]     = useState<Metrics | null>(null);
  const [amountData, setAmountData] = useState([]);
  const [timeData, setTimeData]   = useState([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/stats/overview`).then(r => r.json()),
      fetch(`${API}/api/metrics`).then(r => r.json()),
      fetch(`${API}/api/chart/amount-distribution`).then(r => r.json()),
      fetch(`${API}/api/chart/fraud-over-time`).then(r => r.json()),
    ]).then(([ov, met, amt, time]) => {
      setOverview(ov);
      setMetrics(met);
      setAmountData(amt);
      // Sample every 4 hours for readability
      setTimeData(time.filter((_: any, i: number) => i % 4 === 0));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const fmt = (n: number) => n?.toLocaleString() ?? "—";
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: "0.75rem 1rem" }}>
        <p style={{ fontFamily: "Space Mono", fontSize: "0.75rem", color: "var(--muted)", marginBottom: 4 }}>{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ fontFamily: "Space Mono", fontSize: "0.8rem", color: p.color }}>
            {p.name}: {p.value?.toLocaleString()}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div style={{ padding: "2rem", maxWidth: 1300, margin: "0 auto" }}>

      {/* Header */}
      <div className="animate-fade-in" style={{ marginBottom: "2rem" }}>
        <p style={{ fontFamily: "Space Mono", fontSize: "0.7rem", color: "var(--accent)", letterSpacing: "0.15em", marginBottom: "0.5rem" }}>
          REAL-TIME MONITORING
        </p>
        <h1 style={{ fontSize: "2.2rem", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
          Fraud Detection <span style={{ color: "var(--accent)" }}>Dashboard</span>
        </h1>
        <p style={{ color: "var(--muted)", marginTop: "0.5rem", fontSize: "0.9rem" }}>
          Isolation Forest model trained on 284,807 transactions
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "4rem", color: "var(--muted)", fontFamily: "Space Mono", fontSize: "0.8rem" }}>
          LOADING DATA...
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
            {[
              {
                icon: <Database size={20} />, label: "Total Transactions",
                value: fmt(overview?.total_transactions ?? 0),
                color: "var(--accent)", delay: "animate-fade-in",
              },
              {
                icon: <AlertTriangle size={20} />, label: "Fraud Detected",
                value: fmt(overview?.fraud_detected ?? 0),
                color: "var(--fraud)", delay: "animate-fade-in-2",
              },
              {
                icon: <CheckCircle size={20} />, label: "Legitimate",
                value: fmt(overview?.legitimate ?? 0),
                color: "var(--legit)", delay: "animate-fade-in-3",
              },
              {
                icon: <Activity size={20} />, label: "Fraud Rate",
                value: `${overview?.fraud_rate_pct?.toFixed(4)}%`,
                color: "var(--warn)", delay: "animate-fade-in-4",
              },
              {
                icon: <TrendingUp size={20} />, label: "Avg Fraud Amount",
                value: `$${overview?.avg_fraud_amount?.toFixed(2)}`,
                color: "var(--fraud)", delay: "animate-fade-in-4",
              },
              {
                icon: <Shield size={20} />, label: "Avg Transaction",
                value: `$${overview?.avg_transaction_amount?.toFixed(2)}`,
                color: "var(--accent)", delay: "animate-fade-in-4",
              },
            ].map(({ icon, label, value, color, delay }) => (
              <div key={label} className={`card ${delay}`} style={{ padding: "1.25rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                  <span style={{ color }}>{icon}</span>
                  <span className="label" style={{ margin: 0 }}>{label}</span>
                </div>
                <p style={{ fontFamily: "Space Mono", fontSize: "1.4rem", fontWeight: 700, color }}>
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* Model Metrics */}
          <div className="card animate-fade-in-2" style={{ padding: "1.5rem", marginBottom: "2rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <p style={{ fontFamily: "Space Mono", fontSize: "0.7rem", color: "var(--accent)", letterSpacing: "0.12em", marginBottom: 4 }}>ML MODEL</p>
                <h2 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Isolation Forest Performance</h2>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <span className="badge badge-legit">Unsupervised</span>
                <span className="badge" style={{ background: "rgba(0,229,255,0.1)", color: "var(--accent)", border: "1px solid rgba(0,229,255,0.3)" }}>
                  {metrics?.n_estimators} Trees
                </span>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
              {[
                { label: "Precision", value: pct(metrics?.precision ?? 0), color: "var(--accent)" },
                { label: "Recall",    value: pct(metrics?.recall ?? 0),    color: "var(--warn)" },
                { label: "F1 Score",  value: pct(metrics?.f1_score ?? 0),  color: "var(--legit)" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ textAlign: "center", padding: "1rem", background: "var(--surface2)", borderRadius: 8 }}>
                  <p style={{ fontFamily: "Space Mono", fontSize: "1.5rem", fontWeight: 700, color }}>{value}</p>
                  <p className="label" style={{ marginTop: 4 }}>{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Charts */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "2rem" }}>

            {/* Amount Distribution */}
            <div className="card animate-fade-in-3" style={{ padding: "1.5rem" }}>
              <p style={{ fontFamily: "Space Mono", fontSize: "0.7rem", color: "var(--accent)", letterSpacing: "0.12em", marginBottom: 4 }}>CHART</p>
              <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "1.25rem" }}>Transaction Amount Distribution</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={amountData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="range" tick={{ fontFamily: "Space Mono", fontSize: 10, fill: "var(--muted)" }} />
                  <YAxis tick={{ fontFamily: "Space Mono", fontSize: 10, fill: "var(--muted)" }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="normal" name="Legitimate" fill="var(--legit)" radius={[4,4,0,0]} opacity={0.8} />
                  <Bar dataKey="fraud"  name="Fraud"      fill="var(--fraud)" radius={[4,4,0,0]} opacity={0.9} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Fraud Over Time */}
            <div className="card animate-fade-in-4" style={{ padding: "1.5rem" }}>
              <p style={{ fontFamily: "Space Mono", fontSize: "0.7rem", color: "var(--accent)", letterSpacing: "0.12em", marginBottom: 4 }}>CHART</p>
              <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "1.25rem" }}>Fraud Events Over Time (hrs)</h2>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={timeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="hour" tick={{ fontFamily: "Space Mono", fontSize: 10, fill: "var(--muted)" }} label={{ value: "Hour", position: "insideBottom", offset: -2, fill: "var(--muted)", fontSize: 10 }} />
                  <YAxis tick={{ fontFamily: "Space Mono", fontSize: 10, fill: "var(--muted)" }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontFamily: "Space Mono", fontSize: "0.7rem" }} />
                  <Line type="monotone" dataKey="fraud"  name="Fraud"      stroke="var(--fraud)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="normal" name="Legitimate" stroke="var(--legit)" strokeWidth={1.5} dot={false} opacity={0.5} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* CTA */}
          <div className="card animate-fade-in-4" style={{
            padding: "2rem", textAlign: "center",
            background: "linear-gradient(135deg, rgba(0,229,255,0.05), rgba(0,119,255,0.05))",
          }}>
            <Shield size={32} color="var(--accent)" style={{ margin: "0 auto 1rem" }} />
            <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "0.5rem" }}>Analyze a Transaction</h2>
            <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
              Enter real credit card transaction details and get an instant fraud prediction.
            </p>
            <Link href="/predict">
              <button className="btn-primary">Run Fraud Analysis →</button>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}