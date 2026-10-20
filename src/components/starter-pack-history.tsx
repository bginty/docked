"use client";
import { useEffect, useState } from "react";
import { boundedFetch } from "@/core/bounded-request";
import type { AwardedCard, PackReceipt } from "@/core/pack-opening";
import PackOpening from "./pack-opening";
import { CollectibleViewer } from "./collectible-viewer";
/** Read the original allocation receipt; never recreate or award the starter. */
export function StarterPackHistory({ member }: { member: string }) {
  const [receipt, setReceipt] = useState<PackReceipt | null>(null),
    [status, setStatus] = useState("Loading Starter Pack…"),
    [open, setOpen] = useState(false),
    [card, setCard] = useState<AwardedCard | null>(null);
  const [attempt, retry] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setReceipt(null);
    setOpen(false);
    setStatus("Loading Starter Pack…");
    setFailed(false);
    void boundedFetch("/api/fantasy/starter-history", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok || data.member !== member)
          throw Error(data.error || "Starter history could not load.");
        if (!controller.signal.aborted) {
          setReceipt(data.receipt ?? null);
          setStatus(
            data.receipt
              ? "Your original cards · replay anytime"
              : "No original Starter Pack receipt is available for this account. Your existing collection is unchanged.",
          );
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setFailed(true);
          setStatus(
            error instanceof Error
              ? error.message
              : "Pack history couldn’t load.",
          );
        }
      });
    return () => controller.abort();
  }, [member, attempt]);
  return (
    <section className="fantasy-panel">
      <h3>Original Starter Pack</h3>
      <p className="small-note">{status}</p>
      {receipt ? (
        <button
          className="pack-control secondary"
          onClick={() => setOpen(true)}
        >
          Replay Starter Pack
        </button>
      ) : failed ? (
        <button
          className="pack-control secondary"
          onClick={() => retry((n) => n + 1)}
        >
          Retry starter history
        </button>
      ) : null}
      {open && receipt && (
        <PackOpening
          userId={member}
          name={receipt.name}
          receipt={receipt}
          replay
          openPack={async () => receipt}
          onClose={() => setOpen(false)}
          onViewCard={(c) => {
            setOpen(false);
            setCard(c);
          }}
          ownedIds={[]}
        />
      )}
      {card && <CollectibleViewer card={card} onClose={() => setCard(null)} />}
    </section>
  );
}
