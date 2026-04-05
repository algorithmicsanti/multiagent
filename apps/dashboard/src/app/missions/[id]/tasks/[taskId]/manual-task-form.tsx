"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resolveBrowserApiUrl } from "../../../../lib/api-url";

export function ManualTaskForm({
  taskId,
  actorName,
}: {
  taskId: string;
  actorName: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState("");
  const [result, setResult] = useState("");
  const [notes, setNotes] = useState("");

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${resolveBrowserApiUrl()}/api/v1/tasks/${taskId}/manual-result`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary,
          result,
          notes: notes || undefined,
        }),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? "Failed to submit manual result");
      }

      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="isometric-card" style={{ marginBottom: 32 }}>
      <h3 className="card-title" style={{ marginBottom: 16, color: "var(--accent)" }}>
        Manual Delivery
      </h3>
      <p className="data-label" style={{ marginBottom: 20 }}>
        This task is currently waiting for {actorName} to submit the final result.
      </p>

      {error && (
        <div style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px solid var(--red)", borderRadius: 12, padding: "12px 16px", color: "var(--red)", marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div className="form-group">
        <label className="data-label" style={{ display: "block", marginBottom: 8 }}>SUMMARY *</label>
        <input
          required
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          className="form-input"
          style={{ background: "var(--bg3)", border: "1px solid var(--border)", color: "var(--text)", padding: 12, width: "100%", borderRadius: "var(--radius-sm)", fontFamily: "inherit" }}
          placeholder="Short outcome summary"
        />
      </div>

      <div className="form-group">
        <label className="data-label" style={{ display: "block", marginBottom: 8 }}>RESULT *</label>
        <textarea
          required
          value={result}
          onChange={(event) => setResult(event.target.value)}
          className="form-textarea"
          style={{ minHeight: 180 }}
          placeholder="Paste the human result, conclusion, checklist or final deliverable."
        />
      </div>

      <div className="form-group">
        <label className="data-label" style={{ display: "block", marginBottom: 8 }}>NOTES</label>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="form-textarea"
          style={{ minHeight: 100 }}
          placeholder="Optional notes for the mission history."
        />
      </div>

      <button type="submit" className="btn btn-primary" disabled={loading}>
        {loading ? "SUBMITTING..." : "SUBMIT MANUAL RESULT"}
      </button>
    </form>
  );
}
