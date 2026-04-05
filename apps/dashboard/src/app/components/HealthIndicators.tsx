"use client";

import { useEffect, useState } from "react";
import { resolveBrowserApiUrl } from "../lib/api-url";

export function HealthIndicators() {
  const [health, setHealth] = useState<{ status: string; db: string; redis: string }>({
    status: "loading",
    db: "loading",
    redis: "loading",
  });

  useEffect(() => {
    const apiUrl = resolveBrowserApiUrl();

    fetch(`${apiUrl}/api/v1/health`)
      .then((res) => res.json())
      .then((data) => setHealth(data))
      .catch(() => setHealth({ status: "error", db: "error", redis: "error" }));
  }, []);

  const getStatusColor = (status: string) => {
    if (status === "ok") return "var(--green)";
    if (status === "loading") return "var(--yellow)";
    return "var(--red)";
  };

  return (
    <div className="health-nodes">
      <div className="health-node" title={`API: ${health.status}`}>
        <span className="health-dot" style={{ backgroundColor: getStatusColor(health.status), boxShadow: `0 0 10px ${getStatusColor(health.status)}` }}></span>
        <span className="health-label">API</span>
      </div>
      <div className="health-node" title={`PostgreSQL: ${health.db}`}>
        <span className="health-dot" style={{ backgroundColor: getStatusColor(health.db), boxShadow: `0 0 10px ${getStatusColor(health.db)}` }}></span>
        <span className="health-label">DB</span>
      </div>
      <div className="health-node" title={`Redis: ${health.redis}`}>
        <span className="health-dot" style={{ backgroundColor: getStatusColor(health.redis), boxShadow: `0 0 10px ${getStatusColor(health.redis)}` }}></span>
        <span className="health-label">QUEUE</span>
      </div>
    </div>
  );
}
