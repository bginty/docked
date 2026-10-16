"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { boundedFetch } from "@/core/bounded-request";
import type { AwardedCard, PackReceipt } from "@/core/pack-opening";
import PackOpening from "./pack-opening";
import { FantasySheet } from "./fantasy-player-sheet";
import { FantasyCardArtwork } from "./fantasy-card-artwork";
/** Read the original allocation receipt; never recreate or award the starter. */
export function StarterPackHistory({ member }: { member: string }) {
  const [receipt, setReceipt] = useState<PackReceipt | null>(null),
    [status, setStatus] = useState("Checking your original Starter Pack…"),
    [open, setOpen] = useState(false),
    [card, setCard] = useState<AwardedCard | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setReceipt(null);
    setOpen(false);
    void boundedFetch("/api/fantasy", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok || data.state?.user_id !== member) throw Error();
        if (!controller.signal.aborted) {
          setReceipt(data.state.starter_receipt ?? null);
          setStatus(
            data.state.starter_receipt
              ? "Original onboarding reward · saved result"
              : "View your original onboarding pack in Cards.",
          );
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setStatus("Original pack history could not be loaded.");
      });
    return () => controller.abort();
  }, [member]);
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
      ) : (
        <Link
          className="pack-control secondary"
          href="/fantasy/cards#starter-pack"
        >
          View Starter Pack
        </Link>
      )}
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
      {card && (
        <FantasySheet title={card.name} onClose={() => setCard(null)}>
          <FantasyCardArtwork card={card} />
        </FantasySheet>
      )}
    </section>
  );
}
