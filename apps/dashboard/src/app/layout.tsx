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
          <a href="/missions" className="navbar-brand" style={{ textDecoration: "none", color: "inherit" }}>
            <span className="brand-icon">⬢</span> Web Mentor Agents
          </a>
          <div className="navbar-links">
          </div>
          <HealthIndicators />
        </nav>
        <main className="main-content">{children}</main>
      </body>
    </html>
  );
}
