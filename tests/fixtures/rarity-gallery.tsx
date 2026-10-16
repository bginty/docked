import { useState } from "react";
import { FantasyCardArtwork } from "../../src/components/fantasy-card-artwork";
import { FantasySheet } from "../../src/components/fantasy-player-sheet";
import { CollectibleFace } from "../../src/components/collectible-face";
import PackOpening from "../../src/components/pack-opening";
import { rarities, rarityRule } from "../../src/core/card-rarity";
import { rarityFrame, rarityStyle } from "../../src/core/rarity-theme";
import type { FantasyCard } from "../../src/core/fantasy";
export function RarityGallery({ base }: { base: FantasyCard }) {
  const [reveal, setReveal] = useState(false);
  const [missingNumber, setMissingNumber] = useState(false);
  const [team, setTeam] = useState("ARI"),
    [long, setLong] = useState(false),
    [detail, setDetail] = useState<FantasyCard | null>(null);
  const cards = rarities.map((tier, i) => ({
    ...base,
    id: `rarity-visual-${tier}`,
    name: long ? "Alex Northbridge-Wellington" : base.name,
    team: ["WHITE", "GOLD"].includes(team) ? "Colour study" : team,
    sport: ["WHITE", "GOLD"].includes(team) ? "visual" : "nfl",
    colour: team === "WHITE" ? "#f3f4f6" : "#d3bc8d",
    shirt: 0,
    tier,
    position: base.position,
    serial: tier === "CORE" ? 0 : tier === "ICON" ? 1 : 17 + i,
    max_supply: rarityRule(tier).lifetimeCap ?? 0,
    verifiedJerseyNumber: missingNumber
      ? null
      : (base.verifiedJerseyNumber ?? 17), // Explicit synthetic gallery fixture, not a real player's number.
  }));
  return (
    <main className="rarity-gallery">
      <h1>Docked rarity frames</h1>
      <p>Local visual fixtures · same player and jersey · no cards issued</p>
      <div className="actions">
        <label>
          Team palette{" "}
          <select value={team} onChange={(e) => setTeam(e.target.value)}>
            {[
              ["ARI", "Arizona · crimson"],
              ["CHI", "Navy"],
              ["WHITE", "White · colour study"],
              ["KC", "Red"],
              ["BAL", "Purple"],
              ["GB", "Green"],
              ["GOLD", "Gold · colour study"],
              ["UNKNOWN", "Unknown team"],
            ].map(([v, n]) => (
              <option key={v} value={v}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={long}
            onChange={(e) => setLong(e.target.checked)}
          />{" "}
          Long player name
        </label>
        <label>
          <input
            type="checkbox"
            checked={missingNumber}
            onChange={(e) => setMissingNumber(e.target.checked)}
          />
          No verified number
        </label>
      </div>
      <h2>Collection / marketplace / reveal face</h2>
      <button onClick={() => setReveal(true)}>Preview six-card reveal</button>
      <div className="rarity-gallery-grid" data-preview="standard">
        {cards.map((c) => (
          <FantasyCardArtwork
            key={c.id}
            card={c}
            onInspect={() => setDetail(c)}
          >
            <small>
              {c.tier === "CORE"
                ? "Core · unlimited supply"
                : `#${c.serial} / ${c.max_supply.toLocaleString("en-AU")}`}
            </small>
          </FantasyCardArtwork>
        ))}
      </div>
      <h2>Compact lineup / player selection</h2>
      <div className="rarity-gallery-grid" data-preview="compact">
        {cards.map((c) => (
          <button
            key={c.id}
            className={`field-player ${rarityFrame(c.tier)}`}
            style={rarityStyle(c.tier)}
            onClick={() => setDetail(c)}
          >
            <CollectibleFace card={c} variant="lineup" />
          </button>
        ))}
      </div>
      <h2>Legacy scoring context</h2>
      <div style={{ maxWidth: 220 }}>
        <FantasyCardArtwork
          card={cards[5]}
          appliedMultiplier={rarityRule("CORE").multiplierTenths / 10}
          scoringLabel="Legacy competition · equal scoring"
          onInspect={() => setDetail(cards[5])}
        />
      </div>
      {reveal && (
        <PackOpening
          userId="rarity-visual"
          name="Six rarity preview"
          preview
          replay
          receipt={{
            id: "rarity-visual-reveal",
            name: "Six rarity preview",
            opened_at: "2026-10-15T00:00:00Z",
            cards,
          }}
          openPack={async () => {
            throw Error("Visual fixture cannot open a pack");
          }}
          ownedIds={cards.map((c) => c.id)}
          onClose={() => setReveal(false)}
          onViewCard={(card) =>
            setDetail(cards.find((c) => c.id === card.id) ?? null)
          }
        />
      )}
      {detail && (
        <FantasySheet title={detail.name} onClose={() => setDetail(null)}>
          <FantasyCardArtwork card={detail} />
        </FantasySheet>
      )}
    </main>
  );
}
