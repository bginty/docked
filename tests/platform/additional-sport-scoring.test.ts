import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createPeriod,
  saveTeam,
  lockTeams,
  importStatistics,
  results,
  scoringCompletion,
  finalise,
  type CatalogCard,
} from "../../src/core/scoring-engine";
import { rulesets, scorePlayer, type Rules } from "../../src/core/scoring-v1";
import {
  nbaConfiguration,
  nrlConfiguration,
} from "../../src/core/sport-configuration";
import { nbaStats, nrlStats } from "../../src/core/additional-sport-statistics";
import { syntheticStats } from "../../src/core/scoring-synthetic";
const before = "2099-01-01T00:00:00Z",
  lock = "2099-01-02T00:00:00Z",
  ended = "2099-01-03T00:00:00Z",
  end = "2099-01-09T00:00:00Z";
const op = { id: "qa-operator", role: "reviewer" as const };
for (const config of [nrlConfiguration, nbaConfiguration])
  test(`${config.label}: explicit fixture-only coefficients, multi-game aggregation and frozen period boundaries`, () => {
    const schema = config.id === "nrl" ? nrlStats : nbaStats;
    // Artificial arithmetic fixture: every event = one centipoint. NOT a proposed ruleset.
    const weights = Object.fromEntries(
      Object.keys(schema.shape).map((k) => [k, 1]),
    );
    const rules: Rules = {
      sport: config.id as "nrl" | "basketball",
      version: "qa-arithmetic-only",
      title: "QA arithmetic only",
      beta: true,
      positions: [...new Set(config.slots.flatMap((s) => s.positions))],
      slots: config.slots,
      weights,
      correctionHours: 72,
      periodName: "QA window",
      policy: ["Synthetic coefficient test; no approved scoring model"],
    };
    const stats = Object.fromEntries(Object.keys(weights).map((k) => [k, 1]));
    assert.throws(
      () => scorePlayer({ ...rules, weights: {} }, rules.positions[0], stats),
      /Explicit versioned/,
    );
    const cards: CatalogCard[] = rules.slots.map((s, i) => ({
      cardId: `qa:c${i}`,
      playerId: `qa:p${i}`,
      position: s.positions[0],
      owner: "qa",
      sport: rules.sport,
      eligible: true,
    }));
    const period = {
      id: `sim:${rules.sport}:period`,
      sport: rules.sport,
      label: "QA multi-game",
      locksAt: lock,
      rules,
      window: { start: lock, end, timezone: "Australia/Sydney" },
      fixtures: [0, 1].map((i) => ({
        id: `sim:${rules.sport}:f${i}`,
        scheduledAt: i ? ended : lock,
        playerIds: cards.map((c) => c.playerId),
      })),
    };
    if (rules.sport === "basketball")
      assert.throws(
        () => createPeriod({ ...period, window: undefined }, before),
        /explicit weekly/,
      );
    assert.throws(
      () =>
        createPeriod(
          {
            ...period,
            window: { ...period.window, start: "2099-01-02T00:00:00" },
          },
          before,
        ),
      /Explicit scoring/,
    );
    assert.throws(
      () =>
        createPeriod(
          { ...period, window: { ...period.window, timezone: "" } },
          before,
        ),
      /Explicit scoring/,
    );
    assert.throws(
      () =>
        createPeriod(
          { ...period, window: { ...period.window, end: ended } },
          before,
        ),
      /outside/,
    );
    let s = createPeriod(period, before);
    s = saveTeam(
      s,
      "qa",
      "QA",
      cards.map((c) => c.cardId),
      cards,
      before,
    );
    s = lockTeams(s, cards, lock);
    const source = (i: number) => ({
      provider: "docked-synthetic-v1",
      simulated: true,
      sport: rules.sport,
      fixtureId: period.fixtures[i].id,
      revision: 1,
      observedAt: ended,
      status: "completed",
      endedAt: ended,
      players: cards.map((c) => ({
        playerId: c.playerId,
        availability: "complete",
        stats,
      })),
    });
    s = importStatistics(s, source(0), op, ended);
    assert.equal(scoringCompletion(results(s).rows[0]).completedPlayers, 0);
    assert.equal(results(s).rows[0].centipoints, null);
    s = importStatistics(s, source(1), op, ended);
    assert.equal(
      scoringCompletion(results(s).rows[0]).completedPlayers,
      cards.length,
    );
    assert.equal(
      results(s).rows[0].centipoints,
      2 * cards.length * Object.keys(weights).length,
    );
    const beforeCount = s.audits.length;
    s = importStatistics(s, source(1), op, ended);
    assert.equal(s.audits.length, beforeCount);
    assert.throws(() => finalise(s, op, ended), /period remains open/);
    assert.equal(results(finalise(s, op, end)).rows[0].status, "final");
  });
test("EPL official double and confirmed blank gameweeks preserve existing rules; missing fixtures are never inferred byes", () => {
  const rules = rulesets.epl,
    cards: CatalogCard[] = rules.slots.map((s, i) => ({
      cardId: `qa:c${i}`,
      playerId: `qa:p${i}`,
      position: s.positions[0],
      owner: "qa",
      sport: "epl",
      eligible: true,
    }));
  const base = {
    id: "sim:epl:blank",
    sport: "epl" as const,
    label: "QA blank",
    locksAt: lock,
    rules,
    window: { start: lock, end, timezone: "Europe/London" },
    fixtures: [],
    blankPlayerIds: cards.map((c) => c.playerId),
  };
  assert.throws(
    () => createPeriod({ ...base, blankPlayerIds: undefined }, before),
    /Invalid period/,
  );
  let s = createPeriod(base, before);
  s = saveTeam(
    s,
    "qa",
    "QA",
    cards.map((c) => c.cardId),
    cards,
    before,
  );
  assert.throws(() => finalise(s, op, end), /period remains open/);
  s = lockTeams(s, cards, lock);
  assert.equal(results(s).rows[0].centipoints, 0);
  assert.equal(scoringCompletion(results(s).rows[0]).completedPlayers, 11);
  assert.equal(results(finalise(s, op, end)).rows[0].status, "final");
  const fixtures = [0, 1].map((i) => ({
    id: `sim:epl:g${i}`,
    scheduledAt: lock,
    playerIds: cards.map((c) => c.playerId),
  }));
  s = createPeriod(
    { ...base, id: "sim:epl:double", blankPlayerIds: undefined, fixtures },
    before,
  );
  s = saveTeam(
    s,
    "qa",
    "QA",
    cards.map((c) => c.cardId),
    cards,
    before,
  );
  s = lockTeams(s, cards, lock);
  for (const f of fixtures)
    s = importStatistics(
      s,
      {
        provider: "docked-synthetic-v1",
        simulated: true,
        sport: "epl",
        fixtureId: f.id,
        revision: 1,
        status: "completed",
        endedAt: ended,
        observedAt: ended,
        players: cards.map((c) => ({
          playerId: c.playerId,
          availability: "complete",
          stats: syntheticStats("epl"),
        })),
      },
      op,
      ended,
    );
  assert.equal(
    results(s).rows[0].centipoints,
    cards.reduce(
      (n, c) =>
        n +
        scorePlayer(rules, c.position, syntheticStats("epl")).centipoints * 2,
      0,
    ),
  );
});
