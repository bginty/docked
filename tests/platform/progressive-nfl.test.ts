import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  syntheticScenario,
  scenarioTimes as t,
} from "../../src/core/scoring-synthetic";
import { nflFutureRarityRules } from "../../src/core/scoring-v1";
import {
  createPeriod,
  saveTeam,
  lockTeams,
  importStatistics,
  results,
  scoringCompletion,
  finalise,
  digest,
} from "../../src/core/scoring-engine";
import {
  nflversePostgame,
  parseStatisticsCsv,
} from "../../src/core/postgame-nflverse";
import type { SourceSnapshot } from "../../src/core/scoring-provider";

test("seven-player NFL progression: partial scores, true zero/DNP, reconciliation, downward correction, ties and replay", () => {
  const f = syntheticScenario("nfl");
  const catalog = f.catalog.map((c, i) => ({
    ...c,
    rarity: i % 7 === 0 ? ("LEGENDARY" as const) : ("CORE" as const),
  }));
  const fixtures = Array.from({ length: 7 }, (_, i) => ({
    id: `sim:nfl:game${i}`,
    scheduledAt: t.lock,
    playerIds: catalog.filter((_, j) => j % 7 === i).map((c) => c.playerId),
  }));
  let state = createPeriod(
    { ...f.state.period, rules: nflFutureRarityRules(), fixtures },
    t.created,
  );
  for (const owner of ["amber", "violet"])
    state = saveTeam(
      state,
      owner,
      owner,
      catalog.filter((c) => c.owner === owner).map((c) => c.cardId),
      catalog,
      t.save,
    );
  state = lockTeams(state, catalog, t.lock);
  const before = digest(state.entries);
  const op = { id: "isolated-test", role: "reviewer" as const };
  const snapshot = (
    i: number,
    stats: Record<string, number>,
    status: SourceSnapshot["status"] = "completed",
    dnp = false,
    revision = 1,
  ): SourceSnapshot => ({
    provider: "docked-synthetic-v1",
    simulated: true,
    sport: "nfl",
    fixtureId: fixtures[i].id,
    revision,
    observedAt: t.initial,
    endedAt: status === "completed" ? t.ended : null,
    status,
    players: fixtures[i].playerIds.map((playerId) => ({
      playerId,
      availability: dnp ? "confirmed-dnp" : "complete",
      stats: dnp
        ? null
        : {
            ...Object.fromEntries(
              Object.keys(nflFutureRarityRules().weights).map((k) => [k, 0]),
            ),
            ...stats,
          },
    })),
  });
  const row = () => results(state).rows[0];
  assert.equal(row().centipoints, null);
  assert.equal(row().rank, null);
  state = importStatistics(
    state,
    snapshot(0, {
      passing_yards: 360,
      rushing_yards: 25,
      passing_touchdowns: 1,
    }),
    op,
    t.initial,
  );
  assert.equal(row().players[0].baseCentipoints, 2090);
  assert.equal(row().knownCentipoints, 2926);
  assert.equal(row().centipoints, null);
  assert.equal(scoringCompletion(row()).completedPlayers, 1);
  assert.deepEqual(
    results(state).rows.map((r) => r.rank),
    [1, 1],
  );
  state = importStatistics(
    state,
    snapshot(1, { rushing_yards: 100 }),
    op,
    t.initial,
  );
  assert.equal(row().knownCentipoints, 3926);
  state = importStatistics(
    state,
    snapshot(2, {}, "completed", true),
    op,
    t.initial,
  );
  assert.equal(row().knownCentipoints, 3926);
  assert.equal(scoringCompletion(row()).completedPlayers, 3);
  state = importStatistics(
    state,
    snapshot(3, { receiving_yards: 100 }, "live"),
    op,
    t.initial,
  );
  assert.equal(row().knownCentipoints, 4926);
  assert.equal(scoringCompletion(row()).completedPlayers, 3);
  const correction = snapshot(3, { receiving_yards: 95 }, "live", false, 2);
  state = importStatistics(state, correction, op, t.initial);
  assert.equal(row().knownCentipoints, 4876);
  assert.deepEqual(importStatistics(state, correction, op, t.initial), state);
  state = importStatistics(
    state,
    snapshot(3, { receiving_yards: 95 }, "completed", false, 3),
    op,
    t.initial,
  );
  for (let i = 4; i < 7; i++)
    state = importStatistics(
      state,
      snapshot(i, { receiving_yards: 10 }),
      op,
      t.initial,
    );
  assert.equal(scoringCompletion(row()).completedPlayers, 7);
  assert.equal(row().centipoints, 5176);
  state = finalise(state, op, t.final);
  assert.equal(row().status, "final");
  assert.deepEqual(
    results(state).rows.map((r) => [r.rank, r.centipoints]),
    [
      [1, 5176],
      [1, 5176],
    ],
  );
  assert.equal(digest(state.entries), before);
  assert.throws(
    () =>
      importStatistics(
        state,
        snapshot(0, {}, "completed", false, 2),
        { id: "collector", role: "importer" },
        t.final,
      ),
    /late correction/,
  );
  const tampered = structuredClone(state);
  tampered.entries[0].cards[0].multiplierTenths = 15;
  assert.throws(() => results(tampered), /rarity|multiplier/i);
});

test("unattributed NFL row cannot block identified players; duplicate identities and wrong fixture still fail closed", () => {
  const rows = parseStatisticsCsv(
    readFileSync("tests/fixtures/postgame/nflverse-2026-atl-pit.csv", "utf8"),
  );
  const source = rows.find((r) =>
    ["QB", "RB", "WR", "TE"].includes(r.position),
  )!;
  const mapping = {
    fixtureId: "qa:nfl:game",
    gameId: source.game_id,
    season: 2026,
    seasonType: "REG" as const,
    home: "PIT",
    away: "ATL",
    endedAt: t.ended,
    completionEvidence: "https://example.invalid/isolated",
    players: [
      {
        playerId: "qa:player",
        gsisId: source.player_id,
        team: source.team,
        position: source.position as "QB",
      },
    ],
  };
  const csv = (rs: typeof rows) =>
    [
      Object.keys(source).join(","),
      ...rs.map((r) =>
        Object.keys(source)
          .map((k) => JSON.stringify(r[k]))
          .join(","),
      ),
    ].join("\n");
  const anonymous = {
    ...source,
    player_id: "",
    player_display_name: "",
    position: "",
  };
  const valid = nflversePostgame(
    csv([source]),
    mapping,
    1,
    t.initial,
    undefined,
    nflFutureRarityRules().version,
  );
  const mixed = nflversePostgame(
    csv([source, anonymous]),
    mapping,
    1,
    t.initial,
    undefined,
    nflFutureRarityRules().version,
  );
  assert.deepEqual(mixed.snapshot, valid.snapshot);
  assert.match(mixed.issues[0], /quarantined/);
  assert.throws(
    () => nflversePostgame(csv([source, source]), mapping, 1, t.initial),
    /Duplicate/,
  );
  assert.throws(
    () =>
      nflversePostgame(
        csv([source, { ...anonymous, week: "2" }]),
        mapping,
        1,
        t.initial,
      ),
    /mismatched/,
  );
  assert.throws(
    () =>
      nflversePostgame(
        csv([{ ...source, player_id: "invalid" }]),
        mapping,
        1,
        t.initial,
      ),
    /mismatched/,
  );
});
