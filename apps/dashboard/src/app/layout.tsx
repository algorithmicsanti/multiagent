import type { Metadata } from "next";
import { HealthIndicators } from "./components/HealthIndicators";
import "./globals.css";

export const metadata: Metadata = {
  title: "Web Mentor Agent OS",
  description: "Mission orchestration dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="navbar">
          <div className="navbar-brand">
            <span className="brand-icon">⬢</span> WM_AGENT_OS
          </div>
          <div className="navbar-links">
            <a href="/missions">MISSIONS</a>
            <a href="/approvals">APPROVALS</a>
          </div>
          <HealthIndicators />
        </nav>
        <main className="main-content">{children}</main>
      </body>
    </html>
  );
}
