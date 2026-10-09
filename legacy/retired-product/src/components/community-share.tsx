"use client";
import { useState } from "react";
import { NativeShare } from "./native-share";
export function CommunityShare({ id }: { id: string }) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <section className="app-panel">
      <h2>Share the complete record</h2>
      <p>
        The card identifies this as a community opinion, shows the verified
        locked submission benchmark and current outcome, and timestamps its
        status. Check the permanent record for later corrections.
      </p>
      <button
        className="button ghost"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMessage("");
          try {
            const response = await fetch(
              `/api/community-edges/share?id=${encodeURIComponent(id)}`,
              { cache: "no-store" },
            );
            if (!response.ok)
              throw new Error(
                "The share card is unavailable under your current permissions.",
              );
            const url = URL.createObjectURL(await response.blob()),
              anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = `docked-community-${id}.png`;
            anchor.click();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
            setMessage("Card downloaded. Nothing was posted or sent.");
            void fetch("/api/analytics", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ event: "share_clicked" }),
            }).catch(() => {});
          } catch (error) {
            setMessage(
              error instanceof Error ? error.message : "Download unavailable.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        Download community share card
      </button>
      <p role="status">{message}</p>
      <NativeShare
        path={`/community/edges/${id}`}
        title="Docked community record"
      />
    </section>
  );
}
