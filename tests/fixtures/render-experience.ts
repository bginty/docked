// Isolated UI evidence only. Never imported by the application or stored in a ledger.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EdgeCard } from "../../src/components/edge-card";
import { NoEdge } from "../../src/components/no-edge";
import { educationalDrafts } from "../../src/content/editorial";
import type {
  TipPresentation,
  TipDisplayStatus,
} from "../../src/core/tip-presentation";
const sample: TipPresentation = {
  id: "fixture-only",
  participants: ["FICTIONAL TEAM A", "FICTIONAL TEAM B"],
  selection: "FICTIONAL TEAM A",
  start_at: "2026-10-02T08:00:00Z",
  odds: "2.00",
  minimum_odds: "1.88",
  probability: "0.55",
  estimated_ev: "0.10",
  market_rules: {
    market: "nba_moneyline",
    settlement: "full_game_including_overtime",
  },
  publication_payload: {
    fairOdds: "1.8182",
    offer: { bookmaker: "FICTIONAL BOOK", sourceAt: "2026-10-02T06:00:00Z" },
  },
  result: "pending",
  display_status: "active",
  current_odds: "1.95",
  current_source_at: "2026-10-02T06:00:00Z",
  current_observed_at: "2026-10-02T06:00:00Z",
};
const fixtures: Record<string, string> = {};
for (const status of [
  "active",
  "price_below_minimum",
  "expired",
  "suspended",
  "settled",
] satisfies TipDisplayStatus[]) {
  const tip = {
    ...sample,
    display_status: status,
    result: status === "settled" ? "lost" : "pending",
    current_odds: ["active", "price_below_minimum"].includes(status)
      ? status === "active"
        ? "1.95"
        : "1.80"
      : null,
    current_source_at: ["active", "price_below_minimum"].includes(status)
      ? sample.current_source_at
      : null,
  };
  fixtures[status] = renderToStaticMarkup(
    createElement(EdgeCard, {
      tip,
      timezone: "Australia/Melbourne",
      now: Date.parse("2026-10-02T06:01:00Z"),
      detail: true,
    }),
  );
}
fixtures.no_edge = renderToStaticMarkup(
  createElement(NoEdge, {
    state: { code: "no_edge", title: "", detail: "" },
    monitoring: { available: false, markets: [], events: [] },
    latest: educationalDrafts()[0],
  }),
);
process.stdout.write(JSON.stringify(fixtures));
