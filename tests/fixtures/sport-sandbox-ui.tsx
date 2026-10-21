import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { SportSandbox } from "../../src/components/sport-sandbox";
import type { SandboxState } from "../../src/core/sport-sandbox";
import { CollectibleFace } from "../../src/components/collectible-face";
function Fixture() {
  const [state, setState] = useState<SandboxState | null>(null);
  useEffect(() => {
    void fetch("/state")
      .then((r) => r.json())
      .then(setState);
  }, []);
  if (state && new URLSearchParams(location.search).has("gallery"))
    return (
      <main className="sport-sandbox">
        <h1>Isolated {state.sport} rarity review</h1>
        <p>Fictional QA cards · no issuance</p>
        <div className="sport-slot-grid">
          {["CORE", "RARE", "ELITE", "ULTRA_RARE", "LEGENDARY", "ICON"].map(
            (tier, i) => (
              <div className="sport-slot" key={tier}>
                <CollectibleFace
                  card={{
                    ...state.cards[0],
                    tier,
                    serial: 1,
                    max_supply: 50,
                    name: "Fictional QA Long-Playername",
                    verifiedJerseyNumber: i === 0 ? null : 23,
                  }}
                />
              </div>
            ),
          )}
        </div>
      </main>
    );
  return state ? (
    <SportSandbox initial={state} />
  ) : (
    <p>Loading isolated fixture</p>
  );
}
createRoot(document.getElementById("fixture-root")!).render(<Fixture />);
