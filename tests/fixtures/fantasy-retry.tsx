import { createRoot } from "react-dom/client";
import { FantasyScreen } from "../../src/components/fantasy-screen";
import type { FantasyState } from "../../src/core/fantasy";
const state: FantasyState = {
  mode: "production",
  user_id: "10000000-0000-4000-8000-000000000001",
  credits: 0,
  admin: false,
  fee_bps: 0,
  catalog: null,
  cards: [],
  packs: [],
  shop: [],
  market: [],
  trades: [],
  competitions: [],
  entries: [],
  results: [],
  ledger: [],
  provenance: [],
  members: [],
  replacements: [],
  rewards: {
    server_time: "2026-10-09T00:00:00Z",
    period_timezone: "UTC",
    next_claim_at: "2026-10-10T00:00:00Z",
    claimed_today: false,
    starter_claimed: true,
    points: 0,
    policy: {
      version: 1,
      daily_points: 10,
      card_every: 7,
      daily_card_limit: 0,
    },
    history: [],
  },
};
Object.assign(window, { fantasyFixtureState: state });
createRoot(document.getElementById("fixture-root")!).render(
  <FantasyScreen tab="cards" initial={state} />,
);
