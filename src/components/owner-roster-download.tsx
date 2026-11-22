"use client";

import { useRef, useState } from "react";
import { boundedFetch } from "@/core/bounded-request";

export function rosterExportQuery(query: string) {
  const params = new URLSearchParams(query);
  params.delete("page");
  params.delete("offset");
  params.set("format", "csv");
  return params.toString();
}

/** Downloads every matching player, independently of the visible report page. */
export function OwnerRosterDownload({
  query,
  ownerId,
}: {
  query: string;
  ownerId: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  async function download() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await boundedFetch(
        `/api/admin/rosters?${rosterExportQuery(query)}`,
        {
          cache: "no-store",
          headers: { "x-docked-owner": ownerId },
        },
      );
      if (
        !response.ok ||
        !response.headers.get("content-type")?.startsWith("text/csv")
      )
        throw Error(
          "Roster export is unavailable. Check your Owner access and try again.",
        );
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `docked-player-roster-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      setError(
        "Roster export is unavailable. Check your Owner access and try again.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <div>
      <button
        type="button"
        className="button"
        disabled={busy}
        onClick={() => void download()}
      >
        {busy ? "Preparing roster…" : "Export matching roster CSV"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
