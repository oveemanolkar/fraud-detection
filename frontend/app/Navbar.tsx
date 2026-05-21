"use client";
import Link from "next/link";
import { Shield } from "lucide-react";

export default function Navbar() {
  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      background: "rgba(8,12,18,0.85)",
      backdropFilter: "blur(12px)",
      borderBottom: "1px solid var(--border)",
      padding: "0 2rem",
      height: "60px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
    }}>
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: "0.6rem", textDecoration: "none" }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: "linear-gradient(135deg, var(--accent), #0077ff)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Shield size={18} color="#080c12" strokeWidth={2.5} />
        </div>
        <span style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: "1.1rem", color: "var(--text)", letterSpacing: "-0.02em" }}>
          Fraud<span style={{ color: "var(--accent)" }}>Shield</span>
        </span>
      </Link>

      <div style={{ display: "flex", gap: "0.25rem" }}>
        {[
          { href: "/",        label: "Dashboard" },
          { href: "/predict", label: "Analyze Transaction" },
        ].map(({ href, label }) => (
          <Link key={href} href={href} style={{
            fontFamily: "Syne, sans-serif", fontWeight: 600,
            fontSize: "0.8rem", letterSpacing: "0.06em", textTransform: "uppercase",
            color: "var(--muted)", textDecoration: "none",
            padding: "0.4rem 1rem", borderRadius: 6,
            transition: "color 0.2s, background 0.2s",
          }}
          onMouseEnter={e => {
            (e.target as HTMLElement).style.color = "var(--accent)";
            (e.target as HTMLElement).style.background = "rgba(0,229,255,0.06)";
          }}
          onMouseLeave={e => {
            (e.target as HTMLElement).style.color = "var(--muted)";
            (e.target as HTMLElement).style.background = "transparent";
          }}>
            {label}
          </Link>
        ))}
      </div>

      <div style={{
        display: "flex", alignItems: "center", gap: "0.5rem",
        padding: "0.3rem 0.9rem", borderRadius: 999,
        background: "rgba(0,224,150,0.1)", border: "1px solid rgba(0,224,150,0.25)",
      }}>
        <div style={{
          width: 7, height: 7, borderRadius: "50%",
          background: "var(--legit)",
          boxShadow: "0 0 8px var(--legit)",
        }} />
        <span style={{ fontFamily: "Space Mono, monospace", fontSize: "0.7rem", color: "var(--legit)", fontWeight: 700 }}>
          API LIVE
        </span>
      </div>
    </nav>
  );
}