import { createRoot } from "react-dom/client";
import { CollectibleFace } from "../../src/components/collectible-face";
import { teamColourCatalogue } from "../../src/core/sport-team-colours";

const sport = new URLSearchParams(location.search).get("sport") || "afl";
const positions: Record<string, string> = {
  afl: "MID",
  nrl: "HLF",
  basketball: "PG",
  football: "MID",
};
createRoot(document.getElementById("fixture-root")!).render(
  <main style={{ padding: 16 }}>
    <h1>Docked · {sport} team colours</h1>
    <p>Fictional QA players · Original jerseys · No member assets</p>
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))",
        gap: 24,
      }}
    >
      {teamColourCatalogue
        .filter((t) => t.sport === sport)
        .map((t) => (
          <section key={t.id} data-team={t.id}>
            <h2 style={{ fontSize: 16, minHeight: 40 }}>{t.name}</h2>
            <div
              style={{
                width: "100%",
                maxWidth: 260,
                margin: "auto",
                aspectRatio: "2 / 3",
              }}
            >
              <CollectibleFace
                card={{
                  sport: t.sport,
                  team: t.id,
                  name: "Fictional QA Player",
                  position: positions[t.sport],
                  verifiedJerseyNumber: 7,
                  tier: "RARE",
                  serial: 1,
                  max_supply: 1000,
                }}
              />
            </div>
          </section>
        ))}
    </div>
  </main>,
);
