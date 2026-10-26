import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { SportSandbox } from "../../src/components/sport-sandbox";
import type { SandboxState } from "../../src/core/sport-sandbox";
import { CollectibleFace } from "../../src/components/collectible-face";
import { nrlJerseys } from "../../src/core/nrl-jerseys";
function Fixture() {
  const [state, setState] = useState<SandboxState | null>(null);
  useEffect(() => {
    void fetch("/state" + location.search)
      .then((r) => r.json())
      .then(setState);
  }, []);
  if (!state) return <p>Loading isolated fixture</p>;
  if (new URLSearchParams(location.search).has("gallery"))
    return (
      <main>
        <h1>NRL · 17 existing team identities</h1>
        <p>
          Isolated artwork fixtures; numbers are synthetic examples, not player
          claims.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(155px,1fr))",
            gap: 12,
            maxWidth: 1200,
            margin: "auto",
          }}
        >
          {Object.keys(nrlJerseys).map((team, i) => (
            <article key={team} style={{ minWidth: 0 }}>
              <h2>{team}</h2>
              <CollectibleFace
                card={{
                  name: "Synthetic QA Player",
                  sport: "nrl",
                  team,
                  position: "WFB",
                  tier: [
                    "CORE",
                    "RARE",
                    "ELITE",
                    "ULTRA_RARE",
                    "LEGENDARY",
                    "ICON",
                  ][i % 6],
                  serial: 1,
                  max_supply: 50,
                  verifiedJerseyNumber:
                    i % 3 === 0 ? null : i % 3 === 1 ? 1 : 13,
                }}
              />
            </article>
          ))}
        </div>
      </main>
    );
  return (
    <SportSandbox initial={state} privateBeta navigationPath="/fantasy/play" />
  );
}
createRoot(document.getElementById("fixture-root")!).render(<Fixture />);
