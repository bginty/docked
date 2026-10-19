// Isolated visual fixtures, never bundled into a deployment.
import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { AppShell } from "../../src/components/app-shell";
import { SportProvider } from "../../src/components/sport-context";
import { EnvironmentProvider } from "../../src/components/environment-context";
import { PrizesPage } from "../../src/components/prizes-page";
import {
  LightSweep,
  StartupBoundary,
} from "../../src/components/startup-loading";
import { MemberReleaseAdmin } from "../../src/components/member-release-admin";
import type {
  PrizeCompetition,
  PrizeSchedule,
} from "../../src/core/prize-schedules";
const competitions: PrizeCompetition[] = ["SALARY_CAP", "OPEN"].flatMap(
  (mode, m) =>
    ["2025", "2026"].flatMap((season, s) =>
      [5, 6].map((week, w) => ({
        id: `00000000-0000-4000-8000-00000000${m}${s}${w}0`,
        name: `${mode} fixture`,
        sport: "nfl",
        mode,
        season,
        week,
      })),
    ),
);
Object.assign(window, {
  demoPath: location.pathname,
  fixtureNavigate: (url: string) => {
    history.pushState(null, "", url);
    window.dispatchEvent(new PopStateEvent("popstate"));
  },
});
function Fixture() {
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false);
  const params = new URLSearchParams(location.search);
  const variant = params.get("fixture");
  useEffect(() => {
    Object.assign(window, {
      fixtureReady: () => setReady(true),
      fixtureFail: () => setFailed(true),
    });
  }, []);
  const schedules: PrizeSchedule[] =
    variant === "published"
      ? competitions.map((c) => ({
          id: c.id,
          sport: c.sport,
          mode: c.mode,
          season: c.season,
          scope: "weekly",
          week: c.week,
          items: [
            {
              from: 1,
              to: 1,
              description: "Local gold reward",
              type: "credits",
              amount: 100,
            },
            {
              from: 2,
              to: 2,
              description: "Local silver reward",
              type: "pack",
              amount: 2,
            },
            {
              from: 3,
              to: 3,
              description: "Local bronze reward",
              type: "card",
              amount: 1,
            },
          ],
        }))
      : [];
  return (
    <EnvironmentProvider
      value={{
        production: true,
        liveBeta: true,
        registrationAvailable: false,
        emailAvailable: false,
        invitationAllowed: false,
        policyVersions: null,
        accountConfigured: true,
        reason: "",
      }}
    >
      <SportProvider>
        {variant === "admin" ? (
          <AppShell authenticated>
            <MemberReleaseAdmin
              initial={{
                competitions,
                schedules: [],
                names: [
                  {
                    user: "00000000-0000-4000-8000-000000000009",
                    name: "Fixture Club",
                  },
                ],
                audit: [],
              }}
            />
          </AppShell>
        ) : variant === "loader" ? (
          <LightSweep />
        ) : variant === "failure" ? (
          ready ? (
            <h1>Retry succeeded</h1>
          ) : (
            <LightSweep
              failed
              onRetry={() => setReady(true)}
              authRequired={params.has("auth")}
            />
          )
        ) : variant === "startup" ? (
          <StartupBoundary>
            {failed ? (
              <LightSweep
                failed
                onRetry={() => {
                  setFailed(false);
                  setReady(true);
                }}
              />
            ) : ready ? (
              <AppShell authenticated>
                <h1>Ready fixture</h1>
              </AppShell>
            ) : null}
          </StartupBoundary>
        ) : (
          <AppShell authenticated>
            <PrizesPage competitions={competitions} schedules={schedules} />
          </AppShell>
        )}
      </SportProvider>
    </EnvironmentProvider>
  );
}
createRoot(document.getElementById("fixture-root")!).render(<Fixture />);
