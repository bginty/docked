import { createRoot } from "react-dom/client";
import { SportProvider } from "../../src/components/sport-context";
import { SportSandbox } from "../../src/components/sport-sandbox";
import { CompetitionResults } from "../../src/components/competition-results";
import { PrizesPage } from "../../src/components/prizes-page";
import { sportStandingRounds } from "../../src/core/sport-standings";
import type { SandboxState } from "../../src/core/sport-sandbox";
void fetch("/api/play-owned")
  .then((r) => r.json())
  .then(({ state }: { state: SandboxState }) => {
    createRoot(document.getElementById("fixture-root")!).render(
      <SportProvider>
        <main className="page">
          {location.pathname.endsWith("/results") ? (
            <CompetitionResults
              sport={state.sport}
              seasonAggregationEnabled={false}
              rounds={[]}
              standings={[]}
              records={[]}
              weekly={sportStandingRounds(state)}
            />
          ) : location.pathname.endsWith("/prizes") ? (
            <PrizesPage
              schedules={[]}
              competitions={state.competitions.map((c) => ({
                id: c.id,
                name: c.name,
                sport: c.sport,
                season: c.season,
                week: c.round,
                mode: c.rules.mode,
              }))}
            />
          ) : (
            <SportSandbox
              initial={state}
              privateBeta
              apiPath="/api/play-owned"
              navigationPath="/fantasy/play"
            />
          )}
        </main>
      </SportProvider>,
    );
  });
