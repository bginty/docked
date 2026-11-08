import test from "node:test";
import assert from "node:assert/strict";
import { marketplaceView, marketQuery } from "../../src/core/marketplace";
import {
  marketplaceFixture,
  marketActors,
  marketLabels,
} from "../fixtures/marketplace-state";
import { nflSeven } from "../../src/core/nfl-seven";

test("market round labels use authoritative sport rather than the selected browse sport", () => {
  const now = Date.parse("2026-11-08T00:00:00Z");
  const state = marketplaceFixture(now, marketActors, false, "basketball");
  const member = marketActors[0].id;
  const card = Object.keys(state.commerce.cards).find(
    (id) => state.commerce.cards[id].owner === member,
  )!;
  const display = {
    mode: "SALARY_CAP",
    lineupVersion: "saved-fixture",
    season: "2026",
    week: 8,
  };
  const view = marketplaceView(
    state,
    member,
    marketLabels,
    marketQuery.parse({ sport: "nfl", sell: card }),
    {
      reserved: [card],
      rounds: [
        {
          id: "nba-round",
          name: "NBA saved name",
          display,
          configuration: { ...nflSeven, sport: "basketball" },
          fixtures: [],
        },
        {
          id: "nfl-round",
          name: "NFL saved name",
          display,
          configuration: nflSeven,
          fixtures: [],
        },
        { id: "legacy", name: "Legacy saved name", fixtures: [] },
      ],
      ownerReservations: [
        {
          card,
          competition: "nba-round",
          name: "NBA saved name",
          slot: "G1",
          withdrawable: false,
          display,
        },
        {
          card,
          competition: "unlisted-nba-round",
          name: "NBA saved name",
          slot: "G1",
          withdrawable: false,
          display,
        },
      ],
    },
    now,
  );
  assert.deepEqual(
    view.rounds.map((r) => r.name),
    ["Traditional · Week 8", "Traditional · Round 8", "Legacy saved name"],
  );
  assert.equal(view.inventory.length, 1);
  assert.deepEqual(
    view.inventory[0].ownerReservations.map((r) => r.name),
    ["Traditional · Week 8", "Traditional · Week 8"],
    "Reserved-card metadata preserves NBA even if its round is no longer in the selectable list",
  );
  assert.equal(display.season, "2026");
});
