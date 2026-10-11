"use client";
import { lazy, Suspense, useCallback, useState } from "react";
import { fantasyAssets } from "@/brand/fantasy-assets";
import type { AwardedCard, PackReceipt } from "@/core/pack-opening";
import { FantasySheet } from "./fantasy-player-sheet";
import { FantasyCardArtwork } from "./fantasy-card-artwork";
const PackOpening = lazy(() => import("./pack-opening"));
import { PackViewerBoundary } from "./pack-viewer-boundary";
/** Explicit design fixture. Never used to populate an account, catalogue or ledger. */
const positions = ["QB", "QB", "RB", "RB", "RB", "WR", "WR", "WR", "TE", "TE"];
export const previewReceipt: PackReceipt = {
  id: "design-preview-starter-v1",
  name: "NFL starter pack",
  opened_at: "2026-10-11T00:00:00Z",
  cards: positions.map((position, i) => ({
    id: `design-card-${i}`,
    edition_id: `design-edition-${i}`,
    player_id: `design-player-${i}`,
    name: `Preview ${position} ${i + 1}`,
    position,
    tier: "CORE",
    season: "2026",
    kind: "regular",
    max_supply: 10,
    serial: 1,
    team: "Design sample",
    colour: "#1A2AFF",
    shirt: 1,
    status: "active",
    sport: "nfl",
    tradeable: true,
  })),
};
export function PackOpeningPreview() {
  const [open, setOpen] = useState(false),
    [single, setSingle] = useState(false),
    [receipt, setReceipt] = useState<PackReceipt | null>(null),
    [detail, setDetail] = useState<AwardedCard | null>(null);
  const close = useCallback(() => setOpen(false), []),
    closeDetail = useCallback(() => setDetail(null), []);
  const sample = {
    ...previewReceipt,
    id: single ? "design-preview-single-v1" : previewReceipt.id,
    name: single ? "Single-card pack" : previewReceipt.name,
    cards: single ? previewReceipt.cards.slice(0, 1) : previewReceipt.cards,
  };
  return (
    <section
      aria-label="Pack opening design preview"
      className="fantasy-public"
      style={{ maxWidth: 900, margin: "auto" }}
    >
      <img
        src={fantasyAssets.compactLarge}
        width="220"
        height="60"
        alt="Docked"
      />
      <p className="eyebrow">PACK OPENING · DESIGN PREVIEW</p>
      <h1>Your collection, revealed.</h1>
      <p>
        Interactive design sample. No account, card award, payment or scoring
        action takes place here. Sample identities and serials are illustrative.
      </p>
      <div className="actions">
        <button
          onClick={() => {
            setSingle(false);
            setReceipt(null);
            setOpen(true);
          }}
        >
          Preview starter pack
        </button>
        <button
          onClick={() => {
            setSingle(true);
            setReceipt(null);
            setOpen(true);
          }}
        >
          Preview single card
        </button>
        {receipt && (
          <button onClick={() => setOpen(true)}>Resume saved result</button>
        )}
      </div>
      <p>
        The live friends app stays on its accepted opening flow until visual
        approval. For actual owned pack receipts, use Cards in this protected
        Preview after signing in.
      </p>
      {open && (
        <PackViewerBoundary onClose={close}>
          <Suspense fallback={<p role="status">Loading viewer…</p>}>
            <PackOpening
              key={sample.id}
              userId="design-preview"
              name={sample.name}
              receipt={receipt}
              preview
              ownedIds={sample.cards.map((c) => c.id)}
              onClose={close}
              onViewCard={(c) => {
                close();
                setDetail(c);
              }}
              openPack={async () => {
                await new Promise((r) => setTimeout(r, 350));
                setReceipt(sample);
                return sample;
              }}
            />
          </Suspense>
        </PackViewerBoundary>
      )}
      {detail && (
        <FantasySheet title="Design sample card" onClose={closeDetail}>
          <FantasyCardArtwork card={detail} />
          <p>
            Design fixture only. No real player, ownership or supply is
            represented.
          </p>
          <button
            onClick={() => {
              closeDetail();
              setOpen(true);
            }}
          >
            Return to pack
          </button>
        </FantasySheet>
      )}
    </section>
  );
}
