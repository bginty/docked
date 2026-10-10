import { createRoot } from "react-dom/client";
import { OwnerDashboard } from "../../src/components/owner-dashboard";
import { ScoringRulesTable } from "../../src/components/scoring-rules-table";
import { SocialComposer } from "../../src/components/social-composer";
import { PackProducts } from "../../src/components/pack-products";
import { currentRulesets } from "../../src/core/scoring-release";
import type { Operations } from "../../src/core/owner-operations";
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
                : "Single-card packs"}
        </h1>
        <p>Isolated visual test fixture</p>
        {screen === "dashboard" ? (
          <OwnerDashboard data={sample} />
        ) : screen === "empty" ? (
          <OwnerDashboard data={null} />
        ) : screen === "scoring" ? (
          <ScoringRulesTable rules={currentRulesets.afl} />
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
