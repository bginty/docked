"use client";
import { useRef, useState } from "react";
import { boundedFetch } from "@/core/bounded-request";
export function CollectionExport() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const flight = useRef(false);
  async function download() {
    if (flight.current) return;
    flight.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await boundedFetch("/api/fantasy/collection-export", {
        cache: "no-store",
      });
      if (!r.ok) throw Error("Export unavailable. Please try again.");
      const url = URL.createObjectURL(await r.blob()),
        a = document.createElement("a");
      a.href = url;
      a.download = `docked-collection-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export unavailable");
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="collection-export">
      <button
        className="button ghost"
        disabled={busy}
        onClick={() => void download()}
      >
        {busy ? "Preparing collection…" : "Export collection CSV"}
      </button>
      <p className="small-note">
        All your owned cards across every sport and page, regardless of filters.
      </p>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
