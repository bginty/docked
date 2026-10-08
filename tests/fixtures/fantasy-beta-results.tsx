import { createRoot } from "react-dom/client";
import { FantasyScreen } from "../../src/components/fantasy-screen";
import type { FantasyState } from "../../src/core/fantasy";

// Authored component fixture only: no credentials, database or real members.
const state: FantasyState = {
  mode: "production",
  release_channel: "beta",
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
  my_championship_points: 250,
  leaderboard: {
    scope: "visible_members_current_release",
    rows: [
      {
        id: "10000000-0000-4000-8000-000000000001",
        name: "You",
        points: 250,
        rank: 1,
      },
      {
        id: "20000000-0000-4000-8000-000000000002",
        name: "Invited member",
        points: 250,
        rank: 1,
      },
      {
        id: "20000000-0000-4000-8000-000000000003",
        name: "Another member",
        points: 100,
        rank: 2,
      },
    ],
  },
  rewards: {
    release_channel: "beta",
    server_time: "2026-10-09T00:00:00Z",
    period_timezone: "UTC",
    next_claim_at: "2026-10-10T00:00:00Z",
    claimed_today: true,
    starter_claimed: true,
    points: 10,
    policy: {
      version: 1,
      daily_points: 10,
      card_every: 7,
      daily_card_limit: 10,
    },
    history: [
      {
        period: "2026-10-09",
        points: 10,
        policy_version: 1,
        pack_id: null,
        card_outcome: "not_due",
        release_channel: "beta",
      },
    ],
  },
};
const root = createRoot(document.getElementById("fixture-root")!);
Object.assign(window, {
  renderBetaResults: (tab: "play" | "cards") =>
    root.render(<FantasyScreen key={tab} tab={tab} initial={state} />),
});
