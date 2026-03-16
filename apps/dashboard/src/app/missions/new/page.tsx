"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function NewMissionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: 5,
    createdBy: "admin",
    budgetLimit: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/v1/missions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          priority: form.priority,
          createdBy: form.createdBy,
          budgetLimit: form.budgetLimit ? Number(form.budgetLimit) : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to create mission");
      }

      const mission = await res.json();
      router.push(`/missions`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="main-content" style={{ maxWidth: 800 }}>
      <div className="page-header">
        <h1 className="page-title">Deploy New Mission</h1>
      </div>

      <div className="agent-status-banner">
        <div className="pulse"></div>
        <span><strong>Orchestrator:</strong> Awaiting parameters to initialize a new multi-agent sequence...</span>
      </div>

      <div className="isometric-card">
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {error && (
            <div style={{ background: "rgba(255, 51, 102, 0.1)", border: "1px solid var(--red)", borderRadius: 4, padding: "12px 16px", color: "var(--red)", fontSize: 13, textTransform: "uppercase" }}>
              [ERROR] {error}
            </div>
          )}

          <div className="form-group">
            <label className="data-label" style={{ marginBottom: "8px", display: "block" }}>MISSION TITLE / DIRECTIVE *</label>
            <input
              className="form-input"
              style={{ background: "rgba(15, 23, 42, 0.6)", border: "1px solid var(--border)", color: "#fff", padding: "12px", width: "100%", borderRadius: "2px", fontFamily: "var(--font)" }}
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g., Analyze competitor pricing and generate report"
            />
          </div>

          <div className="form-group">
            <label className="data-label" style={{ marginBottom: "8px", display: "block" }}>CONTEXT & PARAMETERS *</label>
            <textarea
              className="form-textarea"
              style={{ background: "rgba(15, 23, 42, 0.6)", border: "1px solid var(--border)", color: "#fff", padding: "12px", width: "100%", minHeight: "120px", borderRadius: "2px", fontFamily: "var(--font)" }}
              required
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Provide full context, data sources, and constraints for the agents..."
            />
          </div>

          <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
            <div className="form-group">
              <label className="data-label" style={{ marginBottom: "8px", display: "block", color: "var(--accent)" }}>PRIORITY LEVEL: {form.priority}</label>
              <input
                type="range"
                min={1}
                max={10}
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))}
                style={{ width: "100%", accentColor: "var(--accent)" }}
              />
            </div>

            <div className="form-group">
              <label className="data-label" style={{ marginBottom: "8px", display: "block" }}>MAX BUDGET (USD)</label>
              <input
                className="form-input"
                style={{ background: "rgba(15, 23, 42, 0.6)", border: "1px solid var(--border)", color: "#fff", padding: "12px", width: "100%", borderRadius: "2px", fontFamily: "var(--font)" }}
                type="number"
                step="0.01"
                min="0"
                value={form.budgetLimit}
                onChange={(e) => setForm((f) => ({ ...f, budgetLimit: e.target.value }))}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="form-group" style={{ display: "none" }}>
            <input
              value={form.createdBy}
              onChange={(e) => setForm((f) => ({ ...f, createdBy: e.target.value }))}
            />
          </div>

          <div style={{ display: "flex", gap: 16, marginTop: 20, paddingTop: 20, borderTop: "1px dashed var(--border)" }}>
            <button type="submit" className="btn" disabled={loading} style={{ background: "rgba(0, 240, 255, 0.1)", borderColor: "var(--accent)", color: "var(--accent)" }}>
              {loading ? "INITIALIZING SEQUENCE..." : "DEPLOY MISSION"}
            </button>
            <Link href="/missions" className="btn" style={{ borderColor: "var(--text2)", color: "var(--text2)" }}>
              ABORT
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
