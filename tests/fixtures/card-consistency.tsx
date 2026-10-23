import { createRoot } from "react-dom/client";
import { useState } from "react";
import { FantasyCardArtwork } from "../../src/components/fantasy-card-artwork";
import {
  CollectibleViewer,
  type ViewerCard,
} from "../../src/components/collectible-viewer";
import { NbaBetaScreen } from "../../src/components/nba-beta-screen";
import PackOpening from "../../src/components/pack-opening";
import { rarities } from "../../src/core/card-rarity";
import { rosterCardMetadata } from "../../src/core/roster-card-metadata";
import roster from "../../public/data/rosters/wikimedia-roster-beta-2026-10-23-v1.json";
import { SportProvider } from "../../src/components/sport-context";
const query = new URLSearchParams(location.search),
  sport = query.get("sport") ?? "basketball";
const p = roster.players.find(
  (p) => p.sport === sport && p.verifiedJerseyNumber == null,
)!;
const base: ViewerCard =
  sport === "nfl"
    ? {
        id: "local-nfl",
        edition_id: "local-nfl",
        player_id: "local-nfl",
        name: "David Montgomery",
        team: "HOU",
        sport: "nfl",
        tier: "ULTRA_RARE",
        position: "RB",
        serial: 1,
        max_supply: 150,
        season: "LOCAL TEST",
        kind: "regular",
        colour: "",
        shirt: 0,
        verifiedJerseyNumber: 5,
        status: "active",
        tradeable: false,
      }
    : {
        id: "local-card",
        edition_id: "local-edition",
        player_id: p.fixturePlayerId,
        name: p.name,
        team: p.currentTeam,
        position: p.position,
        sport,
        tier: "CORE",
        serial: 1,
        max_supply: 100,
        season: "LOCAL TEST",
        kind: "regular",
        colour: "",
        shirt: 0,
        status: "active",
        tradeable: false,
        ...rosterCardMetadata(p.fixturePlayerId, sport, p.currentTeam),
      };
if (query.get("edge") === "long-missing") {
  base.name = "Alexandria Montgomery-Williams"; // Explicitly synthetic layout stress case.
  base.verifiedJerseyNumber = null;
  base.jerseyNumberText = undefined;
}
const cards = rarities.map((tier, i) => ({
  ...base,
  id: `local-${sport}-${i}`,
  tier,
}));
const original = window.fetch;
window.fetch = async (input, init) => {
  const url = String(input);
  if (url.startsWith("/api/nba-beta") || url.startsWith("/api/sports-beta"))
    return Response.json({
      state: {
        sport,
        user_id: "local",
        cards: cards.map((c) => ({
          ...c,
          inventory_class: "real-roster-beta-v1",
          inventory_source: "roster-beta-core-v1",
          owner_id: "local",
        })),
        competitions: [],
        drafts: [],
        entries: [],
        configurations: {},
        continuity: { established: {} },
        server_time: new Date().toISOString(),
      },
    });
  return original(input, init);
};
function Fixture() {
  const [card, setCard] = useState<ViewerCard | null>(null),
    [pack, setPack] = useState(false);
  return (
    <SportProvider>
      <main className="page-shell sport-card-collection">
        <p>LOCAL VISUAL TEST · no purchases or real ownership</p>
        {query.get("view") === "collection" && sport !== "nfl" ? (
          <NbaBetaScreen cards sport={sport as "basketball" | "afl" | "nrl"} />
        ) : (
          <>
            <h1>{sport.toUpperCase()} · six rarities</h1>
            <div className="fantasy-grid sport-review-grid roster-beta-collection">
              {cards.map((c) => (
                <FantasyCardArtwork
                  key={c.id}
                  card={c}
                  faceOnly
                  onInspect={() => setCard(c)}
                />
              ))}
            </div>
          </>
        )}
        <button onClick={() => setPack(true)}>Open local reveal</button>
        {pack && (
          <PackOpening
            name="Premium 9 Pack · local visual test"
            userId="local"
            receipt={{
              id: `local-${sport}`,
              name: "Local test",
              opened_at: new Date().toISOString(),
              cards: [...cards.slice(1), ...cards.slice(1, 5)],
            }}
            openPack={async () => {
              throw Error("No purchases allowed");
            }}
            ownedIds={[]}
            replay
            preview
            onClose={() => setPack(false)}
            onViewCard={setCard}
          />
        )}
        {card && (
          <CollectibleViewer card={card} onClose={() => setCard(null)} />
        )}
      </main>
    </SportProvider>
  );
}
createRoot(document.getElementById("fixture-root")!).render(<Fixture />);
