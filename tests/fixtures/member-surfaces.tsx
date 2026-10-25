import { createRoot } from "react-dom/client";
import { SportProvider } from "../../src/components/sport-context";
import { CompetitionResults } from "../../src/components/competition-results";
import { PrizesPage } from "../../src/components/prizes-page";
import { PackArtwork } from "../../src/components/pack-artwork";
import { Marketplace } from "../../src/components/marketplace";
import { IdentityVerification } from "../../src/components/identity-verification";
import type { StandingRound } from "../../src/core/standings";
const sport = new URLSearchParams(location.search).get("sport") ?? "nfl";
const rounds: StandingRound[] = ["SALARY_CAP", "OPEN"].map((mode) => ({
  competitionId: `${sport}-${mode}`,
  sport,
  label: "Historical QA round",
  season: "PRIVATE-TEST-2026",
  week: 1,
  mode,
  series: `${sport}-${mode}`,
  visible: true,
  finalised: false,
  rows: [],
}));
const competitions = rounds.map((r) => ({
  id: r.competitionId,
  sport,
  name: r.label,
  season: r.season,
  week: r.week,
  mode: r.mode,
}));
function Fixture() {
  return (
    <SportProvider>
      <main className="page">
        {location.pathname.includes("identity-verification") ? (
          <IdentityVerification
            admin={location.pathname.startsWith("/admin")}
          />
        ) : location.pathname.includes("market") ? (
          <Marketplace member="00000000-0000-4000-8000-000000000001" />
        ) : location.pathname.includes("prizes") ? (
          <PrizesPage competitions={competitions} schedules={[]} />
        ) : location.pathname.includes("packs") ? (
          <>
            <h1>Pack artwork</h1>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
                gap: 24,
              }}
            >
              {(["nfl", "afl", "nrl"] as const).flatMap((s) =>
                (["core", "blue", "gold"] as const).flatMap((color) =>
                  (color === "core" ? [4] : [1, 3, 9]).map((count) => (
                    <article key={`${s}-${color}-${count}`}>
                      <PackArtwork
                        core={color === "core"}
                        premium={color === "gold"}
                        name={`${s.toUpperCase()} ${color === "core" ? "Starter" : color === "gold" ? "Premium" : "Standard"} ${count} Pack`}
                        sport={s}
                        count={count}
                      />
                      <p>
                        {s.toUpperCase()} · {count} cards
                      </p>
                    </article>
                  )),
                ),
              )}
            </div>
          </>
        ) : (
          <CompetitionResults
            sport={sport}
            rounds={[]}
            standings={[]}
            records={[]}
            weekly={rounds}
            seasonAggregationEnabled={sport === "nfl"}
          />
        )}
      </main>
    </SportProvider>
  );
}
createRoot(document.getElementById("fixture-root")!).render(<Fixture />);
