"use client";
import { useState } from "react";
import type { PlayerHistory } from "@/core/player-card-history";
import type { AwardedCard } from "@/core/pack-opening";
import { FlippableCard } from "./collectible-viewer";
import { FantasySheet } from "./fantasy-sheet";
type Example = {
  name: string;
  position: string;
  sport: string;
  history: PlayerHistory;
};
export function CardStatisticsPreview({ examples }: { examples: Example[] }) {
  const [selected, setSelected] = useState<Example | null>(null);
  return (
    <section className="statistics-preview-page">
      <p className="eyebrow">DOCKED · STATISTICS PREVIEW</p>
      <h1>The story behind the card.</h1>
      <p>
        Read-only player history from the verified import. Card frames and
        serials are display samples, not owned cards. No purchase, award or
        scoring action occurs here.
      </p>
      <div className="actions">
        {examples.map((example) => (
          <button
            type="button"
            key={example.name}
            onClick={() => setSelected(example)}
          >
            {example.position} · {example.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() =>
            setSelected({
              name: "EPL unavailable statistics",
              position: "MID",
              sport: "epl",
              history: {
                season: null,
                seasons: [],
                rows: [],
                played: 0,
                averageBase: null,
                bestBase: null,
              },
            })
          }
        >
          EPL · Missing data
        </button>
      </div>
      {selected && (
        <FantasySheet
          title={selected.name}
          className="collectible-viewer"
          onClose={() => setSelected(null)}
        >
          <p className="statistics-preview-note">
            Read-only preview · flip the card for player statistics.
          </p>
          <div className="card-detail-art">
            <FlippableCard
              key={selected.name}
              historySnapshot={selected.history}
              card={
                {
                  id: `preview-${selected.position}`,
                  edition_id: "display-only",
                  player_id: "display-only",
                  name: selected.name,
                  position: selected.position,
                  sport: selected.sport,
                  season: selected.history.season ?? "Unavailable",
                  tier: "LEGENDARY",
                  serial: 1,
                  max_supply: 50,
                  kind: "regular",
                  status: "active",
                  tradeable: false,
                  team: "",
                  colour: "#243f58",
                  shirt: 0,
                } as AwardedCard
              }
            />
          </div>
        </FantasySheet>
      )}
    </section>
  );
}
