import { createRoot } from "react-dom/client";
import { OwnerDashboard } from "../../src/components/owner-dashboard";
import { ScoringRulesTable } from "../../src/components/scoring-rules-table";
import { SocialComposer } from "../../src/components/social-composer";
import { PackProducts } from "../../src/components/pack-products";
import { currentRulesets } from "../../src/core/scoring-release";
import type { Operations } from "../../src/core/owner-operations";
import { PrizeRegister } from "../../src/components/prize-register";
import { generatePrizes } from "../../src/core/prize-register";
const samplePrizes = generatePrizes(
  { scope: "synthetic-only", obligations: [], audit: [] },
  {
    competition: "SYNTHETIC QA ROUND",
    sport: "epl",
    round: "1",
    final: true,
    complete: true,
    revision: 1,
    winners: [
      { member: "qa-member", name: "Synthetic QA participant", rank: 1 },
    ],
  },
  {
    version: "sample-only",
    approved: true,
    tiePolicy: "hold",
    prizes: [
      {
        position: 1,
        description: "Synthetic sample pack",
        kind: "pack",
        quantity: 1,
        currency: null,
        cents: null,
        verificationRequired: false,
      },
    ],
  },
  { id: "synthetic-owner", owner: true, aal: "aal2" },
  "2026-10-10T12:00:00Z",
  "2026-10-11T12:00:00Z",
);
const sample: Operations = {
  scope: "beta",
  generatedAt: "2026-10-10T12:00:00Z",
  metrics: {
    registered: 2,
    admitted: 2,
    activeToday: 1,
    activeWeek: 2,
    activeMonth: 2,
    competitors: 1,
  },
  competitions: [
    {
      id: "synthetic-round",
      name: "SYNTHETIC QA ONLY",
      sport: "football",
      round: 1,
      locks_at: "2026-10-17T11:30:00Z",
      scored_at: null,
      rules_version: "test-only",
      entries: 1,
      scored_entries: 0,
      rankings: [],
    },
  ],
  inventory: [
    {
      id: "synthetic-edition",
      name: "Synthetic QA player",
      sport: "football",
      tier: "CORE",
      season: "2026-test",
      max_supply: 10,
      issued: 2,
      available_lifetime_supply: 8,
      cards: 2,
      distinct_serials: 2,
    },
  ],
  reports: [],
  emailFailures: 0,
  limitations: [
    "Synthetic browser fixture. Never hosted, issued, paid or counted as a genuine member.",
  ],
};
const root = createRoot(document.getElementById("fixture-root")!);
Reflect.set(window, "renderRelease", (screen: string) =>
  root.render(
    <div className="community-shell">
      <section className="scoring-review">
        <h1>
          {screen === "dashboard"
            ? "Owner dashboard"
            : screen === "scoring"
              ? "Scoring rules"
              : screen === "composer"
                ? "Create post"
                : screen === "prizes"
                  ? "Prize register"
                  : "Single-card packs"}
        </h1>
        <p>Isolated visual test fixture</p>
        {screen === "dashboard" ? (
          <OwnerDashboard data={sample} />
        ) : screen === "empty" ? (
          <OwnerDashboard data={null} />
        ) : screen === "scoring" ? (
          <ScoringRulesTable rules={currentRulesets.afl} />
        ) : screen === "prizes" ? (
          <PrizeRegister
            register={samplePrizes}
            now="2026-10-10T13:00:00Z"
            start="2026-10-10T00:00:00Z"
            end="2026-10-12T00:00:00Z"
          />
        ) : screen === "composer" ? (
          <SocialComposer />
        ) : (
          <PackProducts />
        )}
      </section>
    </div>,
  ),
);
Reflect.get(window, "renderRelease")("dashboard");
