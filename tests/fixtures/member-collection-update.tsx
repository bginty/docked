import { createRoot } from "react-dom/client";
import { useState } from "react";
import { ProfileOverview } from "../../src/components/profile-overview";
import { SportProvider } from "../../src/components/sport-context";
import { PlayerJersey } from "../../src/components/player-jersey";
import { FantasyCardArtwork } from "../../src/components/fantasy-card-artwork";
import {
  CollectibleViewer,
  type ViewerCard,
} from "../../src/components/collectible-viewer";
import { aflJerseys } from "../../src/core/afl-jerseys";
import type { FantasyState } from "../../src/core/fantasy";
import { rarities } from "../../src/core/card-rarity";
import { NavigationShortcut } from "../../src/components/navigation-shortcut";
Object.assign(window, { demoPath: "/profile" });
const query = new URLSearchParams(location.search);
const base: ViewerCard = {
  id: "local",
  edition_id: "local",
  player_id: "local",
  name: "Synthetic visual example",
  team: "ADE",
  sport: "afl",
  tier: "ULTRA_RARE",
  position: "MID",
  serial: 17,
  max_supply: 150,
  season: "LOCAL TEST",
  kind: "regular",
  colour: "",
  shirt: 0,
  verifiedJerseyNumber: 23,
  status: "active",
  tradeable: false,
};
function Fixture() {
  const [card, setCard] = useState<ViewerCard | null>(null);
  return (
    <SportProvider>
      <main className="page-shell" style={{ paddingBottom: 90 }}>
        <p>
          Isolated component verification · no real accounts or transactions
        </p>
        {query.get("view") === "jerseys" ? (
          <>
            <h1>AFL approved jerseys</h1>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(6,minmax(0,1fr))",
                gap: 14,
              }}
            >
              {Object.keys(aflJerseys).map((team, i) => (
                <div key={team} data-team={team}>
                  <PlayerJersey
                    card={{
                      ...base,
                      team,
                      verifiedJerseyNumber: i === 0 ? 7 : i === 17 ? null : 23,
                    }}
                  />
                  <strong>{team}</strong>
                </div>
              ))}
            </div>
            <h2>Six rarities · compact and full card renderer</h2>
            <div
              className="fantasy-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(6,minmax(0,1fr))",
                gap: 14,
              }}
            >
              {rarities.map((tier, i) => (
                <FantasyCardArtwork
                  key={tier}
                  card={{
                    ...base,
                    id: tier,
                    tier,
                    team: Object.keys(aflJerseys)[i],
                  }}
                  faceOnly
                  onInspect={() => setCard({ ...base, tier })}
                />
              ))}
            </div>
            {card && (
              <CollectibleViewer card={card} onClose={() => setCard(null)} />
            )}
          </>
        ) : (
          <ProfileOverview
            data={
              {
                user_id: "local-member",
                team_name: "Local Tester",
                members: [],
                cards: [],
              } as unknown as FantasyState
            }
            account={{
              displayName: "Local Tester",
              maskedEmail: "t•••@example.invalid",
              emailVerified: true,
            }}
          />
        )}
        <nav
          aria-label="Shared shortcut verification"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2,minmax(0,1fr))",
            gap: 12,
          }}
        >
          <NavigationShortcut href="/fantasy/cards?tab=packs&sport=afl">
            Buy Packs
          </NavigationShortcut>
          <NavigationShortcut icon="save" href="/fantasy/cards?sport=afl">
            My Collection
          </NavigationShortcut>
          <NavigationShortcut
            compact
            icon="edge"
            href="/fantasy/results?sport=afl"
          >
            Rankings
          </NavigationShortcut>
          <NavigationShortcut compact href="/fantasy/prizes?sport=afl">
            Prizes
          </NavigationShortcut>
        </nav>
      </main>
    </SportProvider>
  );
}
createRoot(document.getElementById("fixture-root")!).render(<Fixture />);
