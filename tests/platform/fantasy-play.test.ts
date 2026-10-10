import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formationFor,
  eligibleForPosition,
  lineupIssues,
  playRounds,
  historicalCards,
  footballBreakdown,
} from "../../src/core/fantasy-play";
import {
  proposedTradeFees,
  sandboxTradeFees,
  tradeFeeWindow,
} from "../../src/core/fantasy-market-fees";
import type {
  FantasyCard,
  FantasyCompetition,
  FantasyState,
} from "../../src/core/fantasy";
const comp = {
  id: "next",
  name: "QA football",
  sport: "football",
  season: "2026",
  round: 2,
  locks_at: "2026-10-12T00:00Z",
  rules: { positions: { GK: 1, DEF: 4, MID: 4, FWD: 2 } },
  scored_at: null,
} as FantasyCompetition;
const cards = [
  "GK",
  "DEF",
  "DEF",
  "DEF",
  "DEF",
  "MID",
  "MID",
  "MID",
  "MID",
  "FWD",
  "FWD",
].map((position, i) => ({
  id: String(i),
  player_id: "p" + i,
  owner_id: "owner",
  position,
  sport: "football",
  season: "2026",
  status: "active",
  tier: "CORE",
})) as FantasyCard[];
test("approved XI; unknown sport does not inherit football rules", () => {
  assert.deepEqual(formationFor(comp), comp.rules.positions);
  assert.equal(formationFor({ ...comp, sport: "afl" }), null);
  assert.deepEqual(
    lineupIssues(
      cards,
      cards.map((c) => c.id),
      comp,
      "owner",
    ),
    [],
  );
  assert.ok(
    lineupIssues(
      cards,
      cards.slice(1).map((c) => c.id),
      comp,
      "owner",
    ).length,
  );
});
test("owned-card selector rejects wrong ownership, position and duplicate player", () => {
  assert.equal(eligibleForPosition(cards[0], "GK", comp, "owner", []), true);
  for (const c of [
    { ...cards[0], owner_id: "other" },
    { ...cards[0], status: "retired" },
    { ...cards[0], season: "2025" },
  ])
    assert.equal(eligibleForPosition(c, "GK", comp, "owner", []), false);
  assert.equal(eligibleForPosition(cards[0], "DEF", comp, "owner", []), false);
  assert.equal(
    eligibleForPosition({ ...cards[0], id: "duplicate" }, "GK", comp, "owner", [
      cards[0],
    ]),
    false,
  );
  assert.equal(
    eligibleForPosition(cards[0], "GK", comp, "owner", [cards[0]], cards[0].id),
    true,
  );
});
test("points snapshot never falls back to todays cards; current and editable round differ", () => {
  const state = {
    cards,
    competitions: [
      comp,
      { ...comp, id: "old", round: 1, locks_at: "2026-10-01T00:00Z" },
    ],
  } as FantasyState;
  const rounds = playRounds(state, "football", Date.parse("2026-10-10T00:00Z"));
  assert.equal(rounds.current?.id, "old");
  assert.equal(rounds.next?.id, "next");
  assert.deepEqual(historicalCards(state, "old"), []);
  state.round_details = [
    {
      competition_id: "old",
      cards: [{ ...cards[0], owner_id: "past" }],
      scores: [],
    },
  ];
  assert.equal(historicalCards(state, "old")[0].owner_id, "past");
});
test("unsupported statistics remain unavailable, no rarity multiplier", () => {
  assert.equal(footballBreakdown({}, "GK", {}), null);
  const stats = {
    minutes: 90,
    goals: 0,
    assists: 1,
    conceded: 0,
    saves: 6,
    yellow: 1,
    red: 0,
    own_goals: 0,
  };
  const rules = {
    appearance: 1,
    sixty_minutes: 1,
    goal: { GK: 6 },
    clean_sheet: { GK: 4 },
    assist: 3,
    save_group: 3,
    save_points: 1,
    yellow: -1,
    red: -3,
    own_goal: -2,
    conceded_group: 2,
    conceded_points: -1,
  };
  assert.equal(
    footballBreakdown(stats, "GK", rules)?.reduce((n, p) => n + p.points, 0),
    10,
  );
});
test("live epoch unset; 48h/28d boundaries use integer cents and expire before fee changes", () => {
  const start = Date.parse(sandboxTradeFees.cycleStart!);
  assert.deepEqual(tradeFeeWindow(proposedTradeFees, start), {
    configured: false,
  });
  for (const [offset, fee] of [
    [-1, 250],
    [0, 0],
    [172800000 - 1, 0],
    [172800000, 250],
    [2419200000 - 1, 250],
    [2419200000, 0],
  ]) {
    const v = tradeFeeWindow(sandboxTradeFees, start + offset);
    assert.equal(v.configured && v.participantCents, fee);
    assert.equal(v.configured && v.totalCents, fee * 2);
  }
  const near = tradeFeeWindow(sandboxTradeFees, start + 172800000 - 1000);
  assert.equal(
    near.configured && near.expiresAt,
    new Date(start + 172800000).toISOString(),
  );
  assert.throws(() =>
    tradeFeeWindow({ ...sandboxTradeFees, participantCents: 2.5 }, start),
  );
});
