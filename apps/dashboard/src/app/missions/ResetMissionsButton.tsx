"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_URL) {
  throw new Error("Missing NEXT_PUBLIC_API_URL for dashboard client requests.");
}

export function ResetMissionsButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const onReset = async () => {
    const accepted = window.confirm("This will delete ALL missions, tasks, approvals, artifacts and events. Continue?");
    if (!accepted) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/missions`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to reset missions");
      }

      router.refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Unknown error while resetting missions");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button type="button" className="btn btn-danger" onClick={onReset} disabled={loading}>
      {loading ? "RESETTING..." : "RESET MISSIONS"}
    </button>
  );
}
