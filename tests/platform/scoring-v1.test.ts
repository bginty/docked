import { test } from "node:test";
import assert from "node:assert/strict";
import {
  scorePlayer,
  rulesets,
  sports,
  validateLineup,
} from "../../src/core/scoring-v1";
import {
  syntheticStats,
  syntheticScenario,
  scenarioTimes as t,
} from "../../src/core/scoring-synthetic";
import {
  saveTeam,
  lockTeams,
  importStatistics,
  finalise,
  results,
  digest,
} from "../../src/core/scoring-engine";
import { eplOnPitchEvidence } from "../../src/core/scoring-provider";
const op = { id: "fixture-operator", role: "reviewer" as const };
const epl = (overrides: object, position = "DEF") =>
  scorePlayer(rulesets.epl, position, {
    ...syntheticStats("epl"),
    ...overrides,
  }).centipoints;
test("EPL alternative appearance brackets, clean sheet and position goals", () => {
  assert.equal(epl({ regulationSeconds: 0, playedSeconds: 0 }), 0);
  assert.equal(epl({ regulationSeconds: 0, playedSeconds: 60 }), 100);
  assert.equal(epl({ regulationSeconds: 3599 }), 100);
  assert.equal(epl({ regulationSeconds: 3600, playedSeconds: 3700 }), 200);
  for (const [position, goal, clean] of [
    ["GK", 600, 400],
    ["DEF", 600, 400],
    ["MID", 500, 100],
    ["FWD", 400, 0],
  ] as const)
    assert.equal(
      epl({ goals: 1, concededOnPitch: 0, saves: 0 }, position),
      200 + goal + clean,
    );
});
test("EPL save groups, penalties, dismissal and conceded groups", () => {
  assert.equal(
    epl(
      {
        saves: 8,
        penaltySaves: 1,
        penaltiesMissed: 1,
        ownGoals: 1,
        concededOnPitch: 5,
      },
      "GK",
    ),
    300,
  );
  assert.equal(epl({ dismissal: "second-yellow", yellowCards: 2 }), -100);
  assert.equal(
    epl({ dismissal: "straight-red", yellowCards: 1, concededOnPitch: 0 }),
    -200,
  );
  assert.throws(() => epl({ dismissal: "second-yellow", yellowCards: 1 }));
  assert.throws(() => epl({ penaltySaves: 4 }));
  assert.throws(() => epl({ price: 100, rarity: "elite" }));
});
test("EPL ordered substitution and added-time events, no inferred on-pitch totals", () => {
  const s = eplOnPitchEvidence({
    intervals: [
      {
        enterOrder: 0,
        leaveOrder: 99,
        regulationSeconds: 3600,
        playedSeconds: 3700,
      },
    ],
    concededGoalOrders: [100, 110],
  });
  assert.equal(epl({ ...s }), 600);
  assert.equal(
    eplOnPitchEvidence({
      intervals: [
        {
          enterOrder: 0,
          leaveOrder: 100,
          regulationSeconds: 5400,
          playedSeconds: 5700,
        },
      ],
      concededGoalOrders: [99],
    }).concededOnPitch,
    1,
  );
  assert.throws(() =>
    eplOnPitchEvidence({
      intervals: [
        {
          enterOrder: 4,
          leaveOrder: 3,
          regulationSeconds: 60,
          playedSeconds: 60,
        },
      ],
      concededGoalOrders: [],
    }),
  );
  assert.throws(() => epl({ onPitchEvidence: undefined }));
});
test("NFL half-PPR fractions, negative yards, turnovers, conversions and individual returns", () => {
  const s = {
    ...syntheticStats("nfl"),
    passing_yards: 251,
    passing_touchdowns: 2,
    interceptions_thrown: 1,
    rushing_yards: -3,
    receiving_yards: 21,
    receptions: 3,
    fumbles_lost: 1,
    passing_two_point_conversions: 1,
    punt_return_touchdowns: 1,
    offensiveFumbleRecoveryTouchdowns: 1,
  };
  assert.equal(scorePlayer(rulesets.nfl, "QB", s).centipoints, 3134);
  assert.throws(() => scorePlayer(rulesets.nfl, "DST", s));
  assert.throws(() =>
    scorePlayer(rulesets.nfl, "QB", { ...s, receiving_yards: undefined }),
  );
});
test("AFL transparent events, partial appearances have no multiplier", () => {
  assert.equal(
    scorePlayer(rulesets.afl, "MID", {
      kicks: 10,
      handballs: 5,
      marks: 2,
      tackles: 3,
      goals: 2,
      behinds: 1,
      hitouts: 3,
      freesFor: 2,
      freesAgainst: 1,
    }).centipoints,
    7300,
  );
  assert.equal(
    scorePlayer(rulesets.afl, "FWD", {
      ...syntheticStats("afl"),
      kicks: 1,
      marks: 1,
      goals: 1,
    }).centipoints,
    1200,
  );
});
for (const sport of sports)
  test(`${sport}: locked two-user results, pending, correction, finalisation and rule version isolation`, () => {
    const f = syntheticScenario(sport);
    let state = f.state;
    for (const owner of ["amber", "violet"])
      state = saveTeam(
        state,
        owner,
        owner,
        f.catalog.filter((c) => c.owner === owner).map((c) => c.cardId),
        f.catalog,
        t.save,
      );
    assert.throws(
      () =>
        lockTeams(
          state,
          f.catalog.map((c) => ({ ...c, owner: "intruder" })),
          t.lock,
        ),
      /eligibility/,
    );
    state = lockTeams(state, f.catalog, t.lock);
    assert.throws(
      () => saveTeam(state, "amber", "Amber", [], f.catalog, t.initial),
      /locked/,
    );
    assert.equal(results(state).rows[0].centipoints, null);
    assert.throws(() => finalise(state, op, t.final), /Pending/);
    state = importStatistics(state, f.source, op, t.initial);
    assert.equal(results(state).rows[0].member, "amber");
    assert.equal(
      digest(importStatistics(state, f.source, op, t.initial)),
      digest(state),
    );
    assert.throws(
      () =>
        importStatistics(state, { ...f.source, players: [] }, op, t.initial),
      /Conflicting/,
    );
    const originalRules = structuredClone(state.period.rules);
    f.state.period.rules.weights.goals = 9999;
    f.catalog.forEach((c) => {
      c.owner = "new-owner-after-trade";
      c.position = "INVALID";
    });
    state = importStatistics(state, f.correction, op, t.corrected);
    assert.equal(results(state).rows[0].member, "violet");
    assert.deepEqual(state.period.rules, originalRules);
    assert.throws(() => finalise(state, op, t.corrected), /window/);
    state = finalise(state, op, t.final);
    const late = { ...f.correction, revision: 3, observedAt: t.final };
    assert.throws(
      () =>
        importStatistics(
          state,
          late,
          { id: "worker", role: "importer" },
          t.final,
        ),
      /late correction/,
    );
    state = importStatistics(
      state,
      late,
      op,
      t.final,
      "Verified provider late correction reference 1",
    );
    assert.equal(state.finalisedAt, null);
    assert.equal(results(state).rows[0].status, "provisional");
    assert.equal(state.sources.length, 3);
  });
test("sport-specific positions and NFL FLEX use a non-greedy assignment", () => {
  const f = syntheticScenario("nfl");
  validateLineup(rulesets.nfl, f.catalog.slice(0, 7).reverse());
  assert.throws(() => validateLineup(rulesets.afl, f.catalog.slice(0, 7)));
  assert.throws(() =>
    validateLineup(rulesets.nfl, Array(7).fill(f.catalog[0])),
  );
});

test("double fixtures sum once; postponement, abandonment, outage and unknown IDs cannot become final zero", () => {
  const f = syntheticScenario("epl");
  f.state.period.fixtures.push({
    ...f.state.period.fixtures[0],
    id: "sim:epl:fixture2",
  });
  let state = saveTeam(
    f.state,
    "amber",
    "Amber",
    f.catalog.filter((c) => c.owner === "amber").map((c) => c.cardId),
    f.catalog,
    t.save,
  );
  state = lockTeams(state, f.catalog, t.lock);
  state = importStatistics(state, f.source, op, t.initial);
  assert.equal(results(state).rows[0].centipoints, null);
  assert.equal(results(state).rows[0].rank, null);
  for (const status of [
    "postponed",
    "abandoned",
    "cancelled",
    "rescheduled",
    "live",
  ] as const) {
    const pending = importStatistics(
      state,
      { ...f.source, fixtureId: "sim:epl:fixture2", status, endedAt: null },
      op,
      t.initial,
    );
    assert.equal(results(pending).rows[0].centipoints, null);
    assert.throws(() => finalise(pending, op, t.final));
  }
  assert.throws(
    () =>
      importStatistics(
        state,
        { ...f.source, fixtureId: "unmapped" },
        op,
        t.initial,
      ),
    /Unmapped/,
  );
  assert.throws(
    () => importStatistics(state, { ...f.source, sport: "afl" }, op, t.initial),
    /identity/,
  );
  assert.throws(() =>
    importStatistics(
      state,
      { ...f.source, provider: "unlicensed-live-feed", simulated: false },
      op,
      t.initial,
    ),
  );
  const incomplete = importStatistics(
    state,
    { ...f.source, fixtureId: "sim:epl:fixture2", players: [] },
    op,
    t.initial,
  );
  assert.equal(results(incomplete).rows[0].centipoints, null);
  const dnp = importStatistics(
    state,
    {
      ...f.source,
      fixtureId: "sim:epl:fixture2",
      players: f.source.players.map((p) => ({
        ...p,
        availability: "confirmed-dnp",
        stats: null,
      })),
    },
    op,
    t.initial,
  );
  const second = importStatistics(
    state,
    { ...f.source, fixtureId: "sim:epl:fixture2" },
    op,
    t.initial,
  );
  assert.equal(
    results(second).rows[0].centipoints,
    results(dnp).rows[0].centipoints! * 2,
  );
});
test("bye is explicit, pending is not zero, unsupported stats and roles fail closed", () => {
  const f = syntheticScenario("nfl");
  let s = lockTeams(
    saveTeam(
      f.state,
      "amber",
      "Amber",
      f.catalog.filter((c) => c.owner === "amber").map((c) => c.cardId),
      f.catalog,
      t.save,
    ),
    f.catalog,
    t.lock,
  );
  assert.throws(
    () =>
      importStatistics(
        s,
        f.source,
        { id: "member", role: "member" as never },
        t.initial,
      ),
    /Operator/,
  );
  s = importStatistics(
    s,
    {
      ...f.source,
      players: f.source.players.map((p) => ({
        ...p,
        availability: "bye",
        stats: null,
      })),
    },
    op,
    t.initial,
  );
  assert.equal(results(s).rows[0].centipoints, 0);
  assert.equal(results(s).rows[0].status, "provisional");
});
