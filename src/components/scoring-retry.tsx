"use client";
import { useRef, useState } from "react";
import { boundedFetch } from "@/core/bounded-request";
export function ScoringRetry({ competition }: { competition: string }) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const flight = useRef(false);
  return (
    <div>
      <button
        disabled={busy}
        onClick={async () => {
          if (flight.current) return;
          flight.current = true;
          setBusy(true);
          try {
            const r = await boundedFetch("/api/admin/scoring-retry", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ competition }),
            });
            const v = await r.json();
            setMessage(r.ok ? v.message : v.error);
          } catch {
            setMessage(
              "Retry could not be confirmed. You can safely try again.",
            );
          } finally {
            flight.current = false;
            setBusy(false);
          }
        }}
      >
        {busy ? "Queuing…" : "Retry reconciliation"}
      </button>
      <p role="status">{message}</p>
    </div>
  );
}
