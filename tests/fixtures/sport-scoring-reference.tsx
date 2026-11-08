import { createRoot } from "react-dom/client";
import { useState } from "react";
import { SportScoringHistory } from "../../src/components/sport-scoring-reference";
import { NflScoringReference } from "../../src/components/nfl-scoring-reference";
import type { CustomerSport } from "../../src/core/customer-sports";

function Fixture() {
  const [sport, setSport] = useState<CustomerSport>("nfl");
  const before = new URLSearchParams(location.search).has("before");
  return (
    <main
      className="community-shell sport-scoring-reference"
      style={{ padding: 16, display: "block" }}
    >
      <p className="form-help">LOCAL DESIGN REVIEW · isolated statistics</p>
      {before ? (
        <section className="scoring-review">
          <h1>NFL scoring rules</h1>
          <p>NFL scoring reference</p>
          <form>
            <label>
              Competition
              <select>
                <option>Player game-log reference</option>
                <option>Round 6 · Traditional</option>
                <option>Round 7 · Traditional</option>
                <option>Round 1 · Practice</option>
              </select>
            </label>
            <button type="button">View saved rules</button>
          </form>
          <NflScoringReference />
        </section>
      ) : (
        <>
          <nav className="owned-sports" aria-label="Sport">
            {(["nfl", "afl", "nrl"] as const).map((s) => (
              <button
                key={s}
                aria-pressed={sport === s}
                onClick={() => setSport(s)}
              >
                {s.toUpperCase()}
              </button>
            ))}
          </nav>
          <SportScoringHistory key={sport} sport={sport} />
        </>
      )}
    </main>
  );
}
createRoot(document.getElementById("fixture-root")!).render(<Fixture />);
