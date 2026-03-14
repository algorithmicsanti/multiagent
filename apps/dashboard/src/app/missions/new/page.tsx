"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

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
      router.push(`/missions/${mission.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 600 }}>
      <div className="page-header">
        <h1 className="page-title">New Mission</h1>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{ background: "#3a1a1a", border: "1px solid #f87171", borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: "#f87171", fontSize: 13 }}>
              {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Title *</label>
            <input
              className="form-input"
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g., Improve checkout flow performance"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description *</label>
            <textarea
              className="form-textarea"
              required
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Describe what needs to be done and why..."
            />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Priority (1-10): {form.priority}</label>
              <input
                type="range"
                min={1}
                max={10}
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))}
                style={{ width: "100%" }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Budget Limit (USD)</label>
              <input
                className="form-input"
                type="number"
                step="0.01"
                min="0"
                value={form.budgetLimit}
                onChange={(e) => setForm((f) => ({ ...f, budgetLimit: e.target.value }))}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Created By</label>
            <input
              className="form-input"
              value={form.createdBy}
              onChange={(e) => setForm((f) => ({ ...f, createdBy: e.target.value }))}
            />
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Creating..." : "Create Mission"}
            </button>
            <a href="/missions" className="btn btn-ghost">Cancel</a>
          </div>
        </form>
      </div>
    </div>
  );
}
