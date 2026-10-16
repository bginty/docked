"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { boundedFetch } from "@/core/bounded-request";
export function OwnerHealthCheck() {
  const router = useRouter(),
    pending = useRef(false),
    key = useRef<string | null>(null);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function check() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setMessage("Checking public API and sign-in page…");
    key.current ??= crypto.randomUUID();
    try {
      const response = await boundedFetch("/api/admin/health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: key.current }),
      });
      if (!response.ok)
        throw Error(
          "Check unavailable. Verify your owner session and retry shortly.",
        );
      const result: unknown = await response.json();
      if (
        !result ||
        typeof result !== "object" ||
        !("recorded" in result) ||
        result.recorded !== true
      )
        throw Error("The check result could not be confirmed. Retry shortly.");
      key.current = null;
      setMessage("Checks recorded. Results expire after five minutes.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Check unavailable.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <div>
      <button
        type="button"
        className="button secondary"
        disabled={busy}
        onClick={check}
      >
        {busy ? "Checking…" : "Check API & web"}
      </button>
      <p role="status">{message}</p>
    </div>
  );
}
