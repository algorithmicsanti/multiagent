"use client";
import { useState, useEffect } from "react";
import { formatDateTimeCDMX } from "../lib/datetime";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_URL) {
  throw new Error("Missing NEXT_PUBLIC_API_URL for dashboard client requests.");
}

interface Approval {
  id: string;
  actionType: string;
  requestedBy: string;
  notes: string | null;
  createdAt: string;
  expiresAt: string | null;
  mission: { title: string };
}

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const fetchApprovals = async () => {
    const res = await fetch(`${API_URL}/api/v1/approvals`);
    if (res.ok) setApprovals(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchApprovals(); }, []);

  const resolve = async (id: string, action: "approve" | "reject") => {
    setResolving(id);
    await fetch(`${API_URL}/api/v1/approvals/${id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, notes: notes[id] ?? "" }),
    });
    await fetchApprovals();
    setResolving(null);
  };

  if (loading) return <div style={{ color: "var(--text2)", padding: 48 }}>Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Pending Approvals</h1>
      </div>

      {approvals.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-title">No pending approvals</div>
            <p>All actions have been reviewed.</p>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {approvals.map((a) => (
            <div key={a.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{a.actionType}</div>
                  <div style={{ fontSize: 12, color: "var(--text2)" }}>Mission: {a.mission?.title}</div>
                  <div style={{ fontSize: 12, color: "var(--text2)" }}>Requested by: {a.requestedBy}</div>
                </div>
                <div style={{ fontSize: 11, color: "var(--text2)" }}>
                  {formatDateTimeCDMX(a.createdAt)}
                  {a.expiresAt && ` • expires ${formatDateTimeCDMX(a.expiresAt)}`}
                </div>
              </div>

              {a.notes && (
                <div style={{ background: "var(--bg3)", borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "var(--text2)", marginBottom: 12 }}>
                  {a.notes}
                </div>
              )}

              <div className="form-group" style={{ marginBottom: 12 }}>
                <textarea
                  className="form-textarea"
                  placeholder="Add notes (optional)"
                  value={notes[a.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [a.id]: e.target.value }))}
                  style={{ minHeight: 60 }}
                />
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn btn-primary"
                  onClick={() => resolve(a.id, "approve")}
                  disabled={resolving === a.id}
                  style={{ background: "var(--green)" }}
                >
                  {resolving === a.id ? "..." : "Approve"}
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => resolve(a.id, "reject")}
                  disabled={resolving === a.id}
                >
                  {resolving === a.id ? "..." : "Reject"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
