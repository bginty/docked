import { test } from "node:test";
import assert from "node:assert/strict";
import { nflPlayerHistory } from "../../src/core/nfl-player-history";
import { playerReadiness } from "../../src/core/nfl-testing-feed";
import {
  nflPostgameTestRules,
  rulesets,
  scorePlayer,
  nflStats,
} from "../../src/core/scoring-v1";
import { nflPostgameWeights } from "../../src/core/nfl-postgame-policy";
import { feedRaw, feedGameFixture } from "../fixtures/nfl-testing-data";
import { playerHistory } from "../../src/core/player-card-history";
import {
  syntheticScenario,
  scenarioTimes,
} from "../../src/core/scoring-synthetic";
import {
  results,
  saveTeam,
  lockTeams,
  importStatistics,
} from "../../src/core/scoring-engine";
const raw = () => ({ ...feedRaw(), synthetic: false });
test("lineups, ranks and player history agree under the SAME frozen version; absent fixtures never score zero", () => {
  const f = syntheticScenario("nfl");
  let state = f.state;
  for (const member of ["amber", "violet"])
    state = saveTeam(
      state,
      member,
      member,
      f.catalog.filter((c) => c.owner === member).map((c) => c.cardId),
      f.catalog,
      scenarioTimes.save,
    );
  state = lockTeams(state, f.catalog, scenarioTimes.lock);
  state = importStatistics(
    state,
    f.source,
    { id: "audit", role: "importer" },
    scenarioTimes.initial,
  );
  const once = results(state);
  const twice = importStatistics(
    state,
    f.source,
    { id: "audit", role: "importer" },
    scenarioTimes.initial,
  );
  assert.deepEqual(results(twice), once);
  for (const row of once.rows) {
    assert.equal(
      row.centipoints,
      row.players.reduce((n, p) => n + p.centipoints!, 0),
    );
    assert.ok(row.rank !== null);
    for (const p of row.players) {
      const h = playerHistory(
        p.matches.map((m) => ({
          season: "2026",
          week: 1,
          fixture: m.fixtureId,
          scheduledAt: f.state.period.fixtures[0].scheduledAt,
          revision: m.revision!,
          observedAt: m.updatedAt,
          final: false,
          visible: true,
          position: p.position,
          rules: state.period.rules,
          source: {
            status: m.sourceStatus,
            availability: m.availability,
            stats: m.statistics,
          },
        })),
      );
      assert.equal(h.rows[0].base, p.centipoints);
    }
  }
  state.period.fixtures = state.period.fixtures.map((g) => ({
    ...g,
    playerIds: [],
  }));
  assert.equal(results(state).rows[0].centipoints, null);
  assert.equal(results(state).rows[0].rank, null);
});
test("every approved category has exact integer centipoints; no position or rarity bonus", () => {
  for (const rules of [rulesets.nfl, nflPostgameTestRules()]) {
    const zeros = Object.fromEntries(
      Object.keys(rules.weights).map((k) => [k, 0]),
    );
    for (const [key, coefficient] of Object.entries(rules.weights)) {
      for (const position of ["QB", "RB", "WR", "TE"])
        assert.equal(
          scorePlayer(rules, position, { ...zeros, [key]: 1 }).centipoints,
          coefficient,
        );
    }
    assert.equal(
      scorePlayer(rules, "WR", {
        ...zeros,
        rushing_yards: -1,
        passing_yards: 1,
        fumbles_lost: 1,
      }).centipoints,
      -206,
    );
    assert.throws(() => scorePlayer(rules, "K", zeros));
    assert.throws(() => scorePlayer(rules, "DST", zeros));
    for (const v of [null, undefined, 1.5, Infinity, "12"])
      assert.throws(() =>
        scorePlayer(rules, "WR", { ...zeros, receiving_yards: v }),
      );
  }
});
test("Rome diagnostic separates the two frozen versions and counts fumbles only once", () => {
  const all = Object.fromEntries(
    Object.keys(nflStats.shape).map((k) => [k, 0]),
  );
  const stats: Record<string, number> = {
    ...all,
    receptions: 6,
    receiving_yards: 94,
  };
  assert.equal(scorePlayer(rulesets.nfl, "WR", stats).centipoints, 1240);
  const reference = Object.fromEntries(
    Object.keys(nflPostgameWeights).map((k) => [k, stats[k]]),
  );
  assert.equal(
    scorePlayer(nflPostgameTestRules(), "WR", reference).centipoints,
    1540,
  );
  assert.equal(
    scorePlayer(nflPostgameTestRules(), "WR", {
      ...reference,
      receptions: 3,
      receiving_yards: 40,
      fumbles_lost: 1,
    }).centipoints,
    500,
  );
});
test("game history preserves canonical opponent, valid zero, missingness, revisions and season boundaries", () => {
  const a = raw(),
    game = {
      ...feedGameFixture(),
      home_id: "t_home",
      away_id: "t_away",
      home_name: "CHI",
      away_name: "NYJ",
    };
  a.stats.receptions = 6;
  a.stats.receiving_yards = 94;
  const input = { payload: a, game_payload: game, position: "WR" };
  const h = nflPlayerHistory([input, input], "2026", new Date().toISOString());
  assert.equal(h.feed?.seasonBase, 1540);
  assert.equal(h.played, 1);
  assert.equal(h.games?.[0].opponent, "NYJ");
  assert.equal(h.games?.[0].venue, "home");
  assert.equal(
    h.games?.[0].parts.reduce((s, p) => s + p.centipoints, 0),
    1540,
  );
  const corrected = {
    ...a,
    revision: 2,
    stats: { ...a.stats, receiving_yards: 104 },
  };
  const changed = nflPlayerHistory([input, { ...input, payload: corrected }]);
  assert.equal(changed.feed?.seasonBase, 1640);
  assert.equal(changed.played, 1);
  assert.equal(
    nflPlayerHistory([
      input,
      { ...input, payload: { ...corrected, removed: true } },
    ]).played,
    0,
  );
  assert.equal(nflPlayerHistory([input], "2025").played, 0);
  assert.throws(
    () =>
      nflPlayerHistory([
        input,
        { ...input, payload: { ...a, stats: corrected.stats } },
      ]),
    /Conflicting/,
  );
  for (const patch of [
    { id: "g_wrong" },
    { season: 2025 },
    { week: 2 },
    { status: "live" },
  ]) {
    const wrong = {
      ...game,
      ...patch,
      freshness: { ...game.freshness, stale: true },
    };
    assert.equal(playerReadiness(a, wrong, "WR").retainedPoints, null);
    assert.equal(
      nflPlayerHistory([{ ...input, game_payload: wrong }]).games?.[0].base,
      null,
    );
  }
  a.fields.receptions.current = false;
  const missing = nflPlayerHistory([input]);
  assert.equal(missing.games?.[0].values.receptions, null);
  assert.equal(missing.averageBase, null);
  assert.equal(playerReadiness(a, game, "WR").retainedPoints, null);
  a.fields.receptions.current = true;
  for (const k of Object.keys(a.stats)) a.stats[k] = 0;
  assert.equal(nflPlayerHistory([input]).games?.[0].base, 0);
  assert.equal(nflPlayerHistory([input]).played, 1);
});
test("fallback history refuses to mix full and half PPR into one season total", () => {
  const input = {
    season: "2026",
    week: 1,
    fixture: "fixture",
    scheduledAt: "2026-09-01T00:00:00Z",
    revision: 1,
    observedAt: null,
    final: true,
    visible: true,
    position: "WR",
    rules: rulesets.nfl,
    source: null,
  };
  const mixed = playerHistory([
    input,
    { ...input, rules: nflPostgameTestRules() },
  ]);
  assert.equal(mixed.rows[0].base, null);
  assert.match(mixed.rows[0].status, /rules differ/);
});
