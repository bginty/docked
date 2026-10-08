import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  assignNflLineup,
  nflOffensiveStats,
  scoreNflOffense,
} from "../../src/core/fantasy-nfl";
import { fantasyAction } from "../../src/core/fantasy";
import { fantasyProductionAction } from "../../src/core/fantasy-production";
const zero = Object.fromEntries(
  Object.keys(nflOffensiveStats.shape).map((k) => [k, 0]),
);
// Authored draft test coefficients only. These are not an approved Docked rule set.
const rules = {
  sport: "nfl",
  version: "authored-offense-v1",
  centipoints_per_unit: {
    ...zero,
    passing_yards: 4,
    passing_touchdowns: 400,
    interceptions_thrown: -200,
    rushing_yards: 10,
    rushing_touchdowns: 600,
    receptions: 100,
    receiving_yards: 10,
    receiving_touchdowns: 600,
    fumbles_lost: -200,
    passing_two_point_conversions: 200,
    rushing_two_point_conversions: 200,
    receiving_two_point_conversions: 200,
    kickoff_return_touchdowns: 600,
    punt_return_touchdowns: 600,
  },
};
const card = (position: string) => ({
  cardId: randomUUID(),
  playerId: randomUUID(),
  sport: "nfl",
  position,
});
const formation = {
  sport: "nfl",
  version: "authored-slots-v1",
  slots: [
    { id: "flex", positions: ["RB", "WR", "TE"] },
    { id: "rb", positions: ["RB"] },
    { id: "qb", positions: ["QB"] },
  ],
};
test("NFL calculation is explicit, fractional, reproducible and broken down by stat", () => {
  const stats = {
    ...zero,
    passing_yards: 251,
    passing_touchdowns: 2,
    interceptions_thrown: 1,
    rushing_yards: -3,
  };
  const scored = scoreNflOffense(stats, rules);
  assert.equal(scored.centipoints, 1574);
  assert.equal(scored.points, "15.74");
  assert.equal(scored.scoringVersion, rules.version);
  assert.equal(
    scored.breakdown.reduce((n, p) => n + p.centipoints, 0),
    scored.centipoints,
  );
  assert.deepEqual(scoreNflOffense(stats, rules), scored);
  assert.equal(
    scoreNflOffense({ ...zero, rushing_yards: -1 }, rules).points,
    "-0.10",
  );
  assert.equal(scoreNflOffense(zero, rules).points, "0.00");
});
test("NFL missing or malformed observations cannot silently score as zero", () => {
  for (const stats of [
    {},
    { ...zero, passing_yards: undefined },
    { ...zero, passing_yards: 1.5 },
    { ...zero, receptions: -1 },
    { ...zero, fumbles_lost: Infinity },
    { ...zero, goals: 1 },
    { ...zero, rarity_multiplier: 2 },
  ])
    assert.throws(() => scoreNflOffense(stats, rules));
  assert.throws(() => scoreNflOffense(zero, undefined));
  assert.throws(() =>
    scoreNflOffense(zero, {
      ...rules,
      centipoints_per_unit: { ...rules.centipoints_per_unit, receptions: 0.5 },
    }),
  );
  assert.throws(() => scoreNflOffense(zero, { ...rules, sport: "football" }));
  assert.throws(() =>
    scoreNflOffense(zero, { ...rules, rarity_multiplier: 2 }),
  );
});
test("all offensive categories use only configured weights, not position or rarity", () => {
  for (const name of Object.keys(zero)) {
    const result = scoreNflOffense({ ...zero, [name]: 2 }, rules);
    assert.equal(
      result.centipoints,
      2 * (rules.centipoints_per_unit as Record<string, number>)[name],
    );
  }
  const stats = { ...zero, receptions: 5 };
  assert.equal(
    scoreNflOffense(stats, {
      ...rules,
      version: "authored-no-receptions",
      centipoints_per_unit: { ...rules.centipoints_per_unit, receptions: 0 },
    }).centipoints,
    0,
  );
});
test("NFL slot matching handles FLEX reassignments regardless of card order", () => {
  const cards = [card("RB"), card("WR"), card("QB")];
  for (const order of [
    cards,
    [cards[2], cards[1], cards[0]],
    [cards[1], cards[0], cards[2]],
  ]) {
    const assignment = assignNflLineup(order, formation);
    assert.equal(
      assignment.find((s) => s.slot === "rb")?.cardId,
      cards[0].cardId,
    );
    assert.equal(new Set(assignment.map((s) => s.cardId)).size, 3);
  }
});
test("NFL slot validation denies duplicates, wrong sport, unsupported positions and bench", () => {
  const cards = [card("RB"), card("WR"), card("QB")];
  for (const input of [
    [...cards, card("WR")],
    cards.slice(1),
    [cards[0], cards[0], cards[2]],
    [cards[0], { ...cards[1], playerId: cards[0].playerId }, cards[2]],
    [card("QB"), card("QB"), card("QB")],
    [{ ...cards[0], sport: "football" }, ...cards.slice(1)],
    [card("K"), ...cards.slice(1)],
  ])
    assert.throws(() => assignNflLineup(input, formation));
  assert.throws(() =>
    assignNflLineup(cards, {
      ...formation,
      slots: [formation.slots[0], formation.slots[0], formation.slots[2]],
    }),
  );
  assert.throws(() => assignNflLineup(cards, { ...formation, bench: 1 }));
});
test("prepared NFL calculators do not activate existing Preview or production commands", () => {
  const request = {
    action: "admin_player",
    request_id: randomUUID(),
    payload: {
      name: "Authored Example",
      sport: "nfl",
      position: "QB",
      team: "Authored Team",
      colour: "#123456",
      shirt: 12,
      first_season: "2026",
      prospect_rank: 1,
    },
  };
  assert.equal(fantasyAction.safeParse(request).success, false);
  assert.equal(fantasyProductionAction.safeParse(request).success, false);
  assert.equal(
    fantasyProductionAction.safeParse({
      action: "admin_nfl_results",
      request_id: randomUUID(),
      payload: {},
    }).success,
    false,
  );
});
