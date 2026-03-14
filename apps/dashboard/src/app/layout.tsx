import type { Metadata } from "next";
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
          <div className="navbar-brand">WM Agent OS</div>
          <div className="navbar-links">
            <a href="/missions">Missions</a>
            <a href="/approvals">Approvals</a>
          </div>
        </nav>
        <main className="main-content">{children}</main>
      </body>
    </html>
  );
}
