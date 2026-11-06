"use client";

import { lazy, Suspense, useCallback, useState } from "react";
import { fantasyAssets } from "@/brand/fantasy-assets";
import { rarities, rarityRule, type Rarity } from "@/core/card-rarity";
import { rarityPresentation } from "@/core/rarity-theme";
import type { AwardedCard, PackReceipt } from "@/core/pack-opening";
import { FantasySheet } from "./fantasy-player-sheet";
import { FantasyCardArtwork } from "./fantasy-card-artwork";
import { PackViewerBoundary } from "./pack-viewer-boundary";

const PackOpening = lazy(() => import("./pack-opening"));

/** Original fixture retained for opening and recovery regression tests. */
const positions = ["QB", "QB", "RB", "RB", "RB", "WR", "WR", "WR", "TE", "TE"];
export const previewReceipt: PackReceipt = {
  id: "design-preview-starter-v1",
  name: "NFL starter pack",
  opened_at: "2026-10-11T00:00:00Z",
  cards: positions.map((position, i) => ({
    id: "design-card-" + i,
    edition_id: "design-edition-" + i,
    player_id: "design-player-" + i,
    name: "Preview " + position + " " + (i + 1),
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

const sportSamples = {
  nfl: [
    ["Miami Dolphins", "QB"],
    ["Buffalo Bills", "RB"],
    ["Minnesota Vikings", "WR"],
    ["Philadelphia Eagles", "TE"],
    ["Green Bay Packers", "WR"],
    ["Kansas City Chiefs", "QB"],
    ["Chicago Bears", "RB"],
    ["Houston Texans", "WR"],
    ["Baltimore Ravens", "TE"],
  ],
  afl: [
    ["Sydney Swans", "MID"],
    ["Carlton", "DEF"],
    ["Fremantle", "FWD"],
    ["GWS Giants", "RUC"],
    ["Richmond", "MID"],
    ["Collingwood", "FWD"],
    ["Geelong", "DEF"],
    ["Port Adelaide", "MID"],
    ["Brisbane Lions", "RUC"],
  ],
  nrl: [
    ["Melbourne Storm", "WFB"],
    ["Brisbane Broncos", "CTR"],
    ["Canberra Raiders", "HLF"],
    ["Newcastle Knights", "MID"],
    ["Sydney Roosters", "EDG"],
    ["Penrith Panthers", "WFB"],
    ["Parramatta Eels", "CTR"],
    ["South Sydney Rabbitohs", "HOK"],
    ["New Zealand Warriors", "MID"],
  ],
} as const;
export type PreviewSport = keyof typeof sportSamples;
const previewSports = ["nfl", "afl", "nrl"] as const satisfies PreviewSport[];

const names = [
  "Avery Quill",
  "Jordan Sable",
  "Riley Voss",
  "Morgan Vale",
  "Casey Hartwell",
  "Taylor North",
  "Devon Ashby",
  "Cameron Finch",
  "Ellis Wren",
];
const packTiers: readonly Rarity[] = [
  "CORE",
  "RARE",
  "ELITE",
  "ULTRA_RARE",
  "LEGENDARY",
  "ICON",
  "RARE",
  "ELITE",
  "ULTRA_RARE",
];

/** Deterministic design cards. This factory has no inventory or payment access. */
export function previewPackReceipt(
  sport: PreviewSport,
  tier?: Rarity,
): PackReceipt {
  const cards = sportSamples[sport].map(([team, position], index) => {
    const rarity = packTiers[index];
    const cap = rarityRule(rarity).lifetimeCap;
    const id = "reveal-sample-" + sport + "-" + (index + 1);
    return {
      id,
      edition_id: id + "-edition",
      player_id: id + "-player",
      name: names[index],
      position,
      tier: rarity,
      season: "Design preview",
      kind: "regular",
      max_supply: cap ?? 0,
      serial: Math.min(index + 1, cap ?? 1),
      team,
      colour: "",
      shirt: 0,
      verifiedJerseyNumber: index + 3,
      status: "active",
      sport,
      tradeable: false,
    } satisfies AwardedCard;
  });

  return {
    id: "reveal-preview-v2-" + sport + "-" + (tier ?? "nine"),
    name:
      sport.toUpperCase() +
      " " +
      (tier ? "single-card preview" : "nine-card preview"),
    opened_at: "2026-10-11T00:00:00Z",
    cards: tier ? [cards[packTiers.indexOf(tier)]] : cards,
  };
}

export function PackOpeningPreview() {
  const [sport, setSport] = useState<PreviewSport>("afl");
  const [sample, setSample] = useState<PackReceipt | null>(null);
  const [open, setOpen] = useState(false);
  const [receipt, setReceipt] = useState<PackReceipt | null>(null);
  const [detail, setDetail] = useState<AwardedCard | null>(null);
  const close = useCallback(() => setOpen(false), []);
  const closeDetail = useCallback(() => setDetail(null), []);

  function start(tier?: Rarity) {
    setSample(previewPackReceipt(sport, tier));
    setReceipt(null);
    setOpen(true);
  }

  return (
    <section
      aria-label="Pack opening design preview"
      className="fantasy-public fantasy-mode pack-preview"
      style={{ maxWidth: 900 }}
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
        Explore a nine-card pack or try a single rarity. This preview uses
        sample players and does not award cards or charge credits.
      </p>
      <label style={{ maxWidth: 240 }}>
        Sport
        <select
          value={sport}
          onChange={(event) => {
            const selected = previewSports.find(
              (option) => option === event.target.value,
            );
            if (selected) setSport(selected);
          }}
        >
          {previewSports.map((option) => (
            <option key={option} value={option}>
              {option.toUpperCase()}
            </option>
          ))}
        </select>
      </label>
      <div className="actions">
        <button className="button" type="button" onClick={() => start()}>
          Preview nine-card pack
        </button>
        {receipt && (
          <button type="button" onClick={() => setOpen(true)}>
            Resume saved result
          </button>
        )}
      </div>
      <h2>Single-card reveals</h2>
      <div className="actions" role="group" aria-label="Single-card rarity">
        {rarities.map((tier) => (
          <button
            key={tier}
            type="button"
            style={{ borderColor: rarityPresentation(tier).accent }}
            onClick={() => start(tier)}
          >
            Preview {rarityRule(tier).label}
          </button>
        ))}
      </div>
      {open && sample && (
        <PackViewerBoundary onClose={close}>
          <Suspense fallback={<p role="status">Loading viewer…</p>}>
            <PackOpening
              key={sample.id}
              userId="design-preview"
              name={sample.name}
              sport={sample.cards[0].sport}
              cardCount={sample.cards.length}
              packType="PREMIUM"
              receipt={receipt}
              preview
              teamHref={null}
              collectionHref={"/fantasy/cards?sport=" + sample.cards[0].sport}
              ownedIds={[]}
              onClose={close}
              onViewCard={(card) => {
                close();
                setDetail(card);
              }}
              openPack={async () => {
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
          <p>Sample player, jersey number and serial.</p>
          <button
            type="button"
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
