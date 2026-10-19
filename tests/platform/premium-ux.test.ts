import { test } from "node:test";
import assert from "node:assert/strict";
import {
  autoSelect,
  historicalRank,
  type RankedCard,
} from "../../src/core/lineup-auto-select";
import { completedAcquisition } from "../../src/core/purchase-celebration";
import { nflSeven, sevenIssues } from "../../src/core/nfl-seven";
import type { PlayerHistory } from "../../src/core/player-card-history";
import { recommendOwnedLineup } from "../../src/core/owned-lineup-recommendation";
import type { FantasyState } from "../../src/core/fantasy";
const cards: RankedCard[] = nflSeven.slots.flatMap((s, i) =>
  ["CORE", "ICON"].map((tier, j) => ({
    id: `${i}-${j}`,
    player_id: `p${i}`,
    tier,
    position: s.positions[0],
    status: "active",
    listed: false,
    value: 1000 + i * 10 + j * 50,
  })),
);
test("Auto Select optimises cap and slots deterministically rather than greedily choosing rarity", () => {
  const result = autoSelect(cards, "SALARY_CAP");
  assert.equal(result.picks.length, 7);
  assert.ok(result.cost <= 4400000);
  assert.deepEqual(
    sevenIssues("SALARY_CAP", result.picks, cards, true).errors,
    [],
  );
  assert.equal(result.picks.filter((p) => p.card.endsWith("-1")).length, 3);
  assert.deepEqual(autoSelect([...cards].reverse(), "SALARY_CAP"), result);
  assert.equal(
    autoSelect(cards, "OPEN").picks.filter((p) => p.card.endsWith("-1")).length,
    7,
  );
});
test("Auto Select preserves locks, excludes listed/ineligible players, prevents duplicate player variants and exposes unknowns", () => {
  const fixed = [{ slot: "QB1", card: "0-0" }];
  const result = autoSelect(
    cards.map((c) => ({
      ...c,
      value: null,
      listed: c.player_id === "p1",
      status: c.player_id === "p2" ? "retired" : c.status,
    })),
    "OPEN",
    fixed,
  );
  assert.deepEqual(
    result.picks.find((p) => p.slot === "QB1"),
    fixed[0],
  );
  assert.equal(
    new Set(
      result.picks.map((p) => cards.find((c) => c.id === p.card)!.player_id),
    ).size,
    result.picks.length,
  );
  assert.ok(result.missing.length > 0);
  assert.ok(result.unranked.length > 0);
});
test("Auto Select value matches exhaustive search including negative scores and flexible slots", () => {
  const cfg = {
    ...nflSeven,
    salaryCap: 1800000,
    slots: [
      { id: "WR", positions: ["WR"] },
      { id: "FLEX", positions: ["WR", "RB"] },
      { id: "RB", positions: ["RB"] },
    ],
  };
  for (let seed = 1; seed < 12; seed++) {
    const pool = Array.from({ length: 6 }, (_, i) => ({
      id: `c${i}`,
      player_id: `p${i}`,
      tier: i % 2 ? "RARE" : "CORE",
      position: i < 3 ? "WR" : "RB",
      status: "active",
      listed: false,
      value: ((seed * 17 + i * 23) % 90) - 30,
    }));
    const result = autoSelect(pool, "SALARY_CAP", [], cfg);
    const values: number[] = [];
    for (const a of pool.filter((c) => c.position === "WR"))
      for (const b of pool)
        for (const c of pool.filter((c) => c.position === "RB"))
          if (new Set([a.id, b.id, c.id]).size === 3)
            values.push(a.value + b.value + c.value);
    assert.equal(
      result.picks.reduce(
        (n, p) => n + pool.find((c) => c.id === p.card)!.value,
        0,
      ),
      Math.max(...values),
    );
  }
});
test("Historical ranks never include future/live/missing/DNP observations or pretend unknown is zero", () => {
  const game = {
    id: "g",
    week: 1,
    kickoff: "2026-09-01T00:00:00Z",
    played: true,
    base: 1260,
    gameStatus: "final",
    incomplete: false,
    missing: [],
    opponent: null,
    venue: null,
    scoringStatus: "Available stats",
    revision: 1,
    updatedAt: "2026-09-02T00:00:00Z",
    values: {},
    parts: [],
  } satisfies NonNullable<PlayerHistory["games"]>[number];
  const h: PlayerHistory = {
    season: "2026",
    seasons: ["2026"],
    averageBase: null,
    bestBase: null,
    played: 1,
    rows: [],
    games: [
      game,
      { ...game, id: "future", week: 7, base: 9999 },
      { ...game, id: "live", gameStatus: "live", base: 9000 },
      { ...game, id: "missing", base: null },
      { ...game, id: "dnp", played: false, base: 0 },
    ],
  };
  assert.deepEqual(historicalRank(h, 7, Date.parse("2026-10-20")), {
    average: 1260,
    appearances: 1,
    throughWeek: 1,
  });
  assert.equal(historicalRank({ ...h, games: [] }, 7, Date.now()), null);
});
test("Celebration requires matching completed receipt, never a review or pending request", () => {
  const result = {
    listing: "l",
    card: "c",
    price: 1000,
    receipt: {
      reference: "r_sale",
      at: 123,
      price: 1000,
      cardSnapshot: { id: "c", tier: "ICON", name: "Owned card" },
    },
  };
  assert.ok(completedAcquisition(result, { kind: "buy", listing: "l" }));
  assert.equal(
    completedAcquisition(result, { kind: "review-buy", listing: "l" }),
    null,
  );
  assert.equal(
    completedAcquisition(
      { listing: "l", price: 1000 },
      { kind: "buy", listing: "l" },
    ),
    null,
  );
  assert.equal(
    completedAcquisition(result, { kind: "buy", listing: "other" }),
    null,
  );
  assert.equal(
    completedAcquisition(
      { ...result, card: "wrong" },
      { kind: "buy", listing: "l" },
    ),
    null,
  );
});
test("Server recommendation only considers owned eligible cards and leaves entries/data unchanged", () => {
  const now = Date.now();
  const inventory = cards.map((c) => ({
    ...c,
    owner_id: "me",
    edition_id: c.id,
    serial: 1,
    max_supply: 1,
    name: c.id,
    sport: "nfl",
    team: "BUF",
    season: "2026",
    kind: "regular",
    colour: "blue",
    shirt: 1,
    tradeable: true,
    created_at: new Date(now).toISOString(),
    acquired_at: new Date(now).toISOString(),
  }));
  const outsider = {
    ...inventory[0],
    id: "other-owner",
    player_id: "other-player",
    owner_id: "other",
  };
  const data: FantasyState = {
    user_id: "me",
    credits: 0,
    admin: false,
    fee_bps: 500,
    catalog: null,
    cards: inventory,
    packs: [],
    shop: [],
    market: [],
    trades: [],
    entries: [],
    results: [],
    ledger: [],
    provenance: [],
    members: [],
    replacements: [],
    competitions: [
      {
        id: "week7",
        name: "Test future week",
        season: "2026",
        round: 7,
        locks_at: new Date(now + 86400000).toISOString(),
        scored_at: null,
        rules: { mode: "SALARY_CAP", lineup_version: nflSeven.version },
      },
    ],
    seven: {
      inventory: [...inventory, outsider],
      configurations: { [nflSeven.version]: nflSeven },
      drafts: [],
      entries: [],
      locks: [],
      server_time: new Date(now).toISOString(),
      fixtures: {
        week7: [
          {
            fixtureId: "f",
            scheduledAt: new Date(now + 86400000).toISOString(),
            playerIds: [...inventory, outsider].map((c) => c.player_id),
          },
        ],
      },
    },
  };
  const before = JSON.stringify(data),
    ranks = Object.fromEntries(
      [...inventory, outsider].map((c) => [
        c.player_id,
        {
          average: c === outsider ? 999999 : 1000,
          appearances: 2,
          throughWeek: 5,
        },
      ]),
    );
  const result = recommendOwnedLineup(data, "week7", ranks, now);
  assert.equal(result.picks.length, 7);
  assert.ok(result.picks.every((p) => p.card !== outsider.id));
  assert.equal(JSON.stringify(data), before);
  data.seven!.established = { "nfl:OPEN": true };
  assert.equal(
    recommendOwnedLineup(data, "week7", ranks, now).picks.length,
    7,
    "All-Star setup must not consume Traditional setup",
  );
  data.seven!.established["nfl:SALARY_CAP"] = true;
  assert.throws(
    () => recommendOwnedLineup(data, "week7", ranks, now),
    /established/,
    "Server rejects repeat Auto Select, even after withdrawal",
  );
  data.seven!.established = {};
  data.seven!.fixtures.week7[0].scheduledAt = new Date(
    now - 1000,
  ).toISOString();
  assert.equal(recommendOwnedLineup(data, "week7", ranks, now).picks.length, 0);
});
