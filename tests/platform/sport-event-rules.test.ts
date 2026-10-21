import { test } from "node:test";
import assert from "node:assert/strict";
import { sportEventRules } from "../../src/core/sport-event-rules";
import {
  nrlEventStats,
  nrlStats,
  nbaStats,
} from "../../src/core/additional-sport-statistics";
import { scorePlayer, rulesets, aflStats } from "../../src/core/scoring-v1";
import { currentRulesets, scoringRows } from "../../src/core/scoring-release";
import { syntheticProvider } from "../../src/core/scoring-provider";

const empty = (shape: Record<string, unknown>) =>
  Object.fromEntries(Object.keys(shape).map((k) => [k, 0]));
test("NRL published event table, per-game floors, split offloads and penalties reconcile", () => {
  const rules = sportEventRules("nrl");
  const raw = {
    ...empty(nrlEventStats.shape),
    tries: 1,
    goals: 2,
    tryAssists: 1,
    lineBreaks: 1,
    lineBreakAssists: 1,
    tackles: 30,
    tackleBreaks: 3,
    missedTackles: 2,
    offloadsToHand: 2,
    offloadsToGround: 1,
    errors: 1,
    fortyTwenties: 1,
    runMetres: 129,
    kickMetres: 89,
    penaltiesConceded: 1,
    sixAgainInfringements: 1,
    trySaves: 1,
    kicksDefused: 3,
    forcedDropouts: 1,
    turnovers: 1,
    escapesInGoal: 1,
  };
  assert.equal(scorePlayer(rules, "MID", raw).centipoints, 9400);
  for (const [metres, expected] of [
    [9, 0],
    [10, 100],
    [19, 100],
    [20, 200],
  ])
    assert.equal(
      scorePlayer(rules, "MID", {
        ...empty(nrlEventStats.shape),
        runMetres: metres,
      }).centipoints,
      expected,
    );
  assert.equal(
    scorePlayer(rules, "MID", { ...empty(nrlEventStats.shape), kickMetres: 29 })
      .centipoints,
    0,
  );
  assert.equal(
    scorePlayer(rules, "MID", { ...empty(nrlEventStats.shape), kickMetres: 30 })
      .centipoints,
    100,
  );
  assert.equal(
    scorePlayer(rules, "MID", {
      ...empty(nrlEventStats.shape),
      sinBins: 1,
      sendOffs: 1,
    }).centipoints,
    -1500,
  );
  assert.throws(
    () => scorePlayer({ ...rules, statisticGroups: undefined }, "MID", raw),
    /frozen/,
  );
  assert.throws(() => scorePlayer(rules, "MID", { ...raw, offloads: 3 }));
  const missing = { ...raw } as Record<string, number>;
  delete missing.offloadsToHand;
  assert.throws(() => scorePlayer(rules, "MID", missing));
  assert(
    scoringRows(rules).some((r) => r.action.includes("complete 30 metres")),
  );
});
test("NBA events have no duplicate three-point or turnover scoring", () => {
  const rules = sportEventRules("basketball");
  assert.equal(
    scorePlayer(rules, "PG", {
      points: 24,
      rebounds: 10,
      assists: 8,
      steals: 2,
      blocks: 1,
      turnovers: 5,
      threePointers: 4,
    }).centipoints,
    5900,
  );
  assert.equal(scorePlayer(rules, "C", empty(nbaStats.shape)).centipoints, 0);
  assert.throws(() =>
    scorePlayer(rules, "C", { ...empty(nbaStats.shape), points: null }),
  );
});
test("AFL 22 keeps the owner's 2/1 event model; existing EPL/NFL/historical rules are immutable", () => {
  const before = JSON.stringify({ rulesets, currentRulesets });
  const rules = sportEventRules("afl");
  assert.equal(rules.slots.length, 22);
  assert.equal(
    scorePlayer(rules, "MID", {
      ...empty(aflStats.shape),
      kicks: 10,
      handballs: 5,
      marks: 4,
      tackles: 3,
      goals: 2,
      behinds: 1,
      hitouts: 7,
      freesFor: 2,
      freesAgainst: 1,
    }).centipoints,
    6800,
  );
  const epl = sportEventRules("epl");
  assert.deepEqual(epl, currentRulesets.epl);
  rules.weights.kicks = 999;
  epl.goal!.GK = 999;
  assert.equal(JSON.stringify({ rulesets, currentRulesets }), before);
});
test("new NRL schema is version-scoped and does not reinterpret legacy statistics", () => {
  const raw = {
    provider: "docked-synthetic-v1",
    simulated: true,
    sport: "nrl",
    fixtureId: "f",
    revision: 1,
    status: "completed",
    endedAt: "2099-01-01T01:00:00Z",
    observedAt: "2099-01-01T02:00:00Z",
    players: [
      { playerId: "p", availability: "complete", stats: empty(nrlStats.shape) },
    ],
  };
  assert.doesNotThrow(() =>
    syntheticProvider.normalize(raw, "nrl", "f", ["p"], "qa-arithmetic-only"),
  );
  assert.throws(() =>
    syntheticProvider.normalize(
      raw,
      "nrl",
      "f",
      ["p"],
      sportEventRules("nrl").version,
    ),
  );
  raw.players[0].stats = empty(nrlEventStats.shape);
  assert.doesNotThrow(() =>
    syntheticProvider.normalize(
      raw,
      "nrl",
      "f",
      ["p"],
      sportEventRules("nrl").version,
    ),
  );
});
