import type { Metadata } from "next";
import "./globals.css";
import Navbar from "./Navbar";

export const metadata: Metadata = {
  title: "FraudShield — Credit Card Fraud Detection",
  description: "Real-time credit card fraud detection powered by Isolation Forest ML",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        <main style={{ paddingTop: "60px", position: "relative", zIndex: 1 }}>
          {children}
        </main>
      </body>
    </html>
  );
}