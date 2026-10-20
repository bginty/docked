import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { completedNflMissingZero } from "../../src/core/nfl-completed-zero";
import {
  nflversePostgame,
  parseStatisticsCsv,
} from "../../src/core/postgame-nflverse";
import {
  syntheticScenario,
  scenarioTimes,
} from "../../src/core/scoring-synthetic";
import {
  importStatistics,
  results,
  saveTeam,
  lockTeams,
  digest,
} from "../../src/core/scoring-engine";
import { gameDayPlayerStatus } from "../../src/core/game-day";
import type { StandingPlayer } from "../../src/core/standings";

const csv = readFileSync(
  "tests/fixtures/postgame/nflverse-2026-atl-pit.csv",
  "utf8",
);
const rows = parseStatisticsCsv(csv);
const map = {
  fixtureId: "qa:nfl:fixture",
  gameId: "2026_01_ATL_PIT",
  season: 2026,
  seasonType: "REG" as const,
  home: "PIT",
  away: "ATL",
  players: [
    {
      playerId: "qa:absent",
      gsisId: "00-9999999",
      team: "PIT",
      position: "QB" as const,
    },
  ],
  endedAt: "2026-09-13T22:00:00Z",
  completionEvidence: "https://example.invalid/isolated-completion",
};
const plays = [
  {
    game_id: map.gameId,
    home_team: "PIT",
    away_team: "ATL",
    play_id: "10",
    play_deleted: "0",
    play_type_nfl: "END_GAME",
    qtr: "4",
    home_score: "20",
    away_score: "13",
  },
];
test("approved completed-game policy distinguishes absent player zero from confirmed DNP", () => {
  const parsed = nflversePostgame(csv, map, 1, "2026-10-11T00:00:00Z");
  const before = structuredClone(parsed);
  const out = completedNflMissingZero(parsed, map, rows, plays);
  assert.equal(out.snapshot.players[0].availability, "assumed-zero");
  assert.equal(out.snapshot.players[0].stats, null);
  assert.equal(
    out.snapshot.missingPlayerPolicy,
    "nfl-completed-missing-zero-v1",
  );
  assert.deepEqual(out.issues, []);
  assert.deepEqual(parsed, before);
  for (const evidence of [
    [],
    plays.map((p) => ({ ...p, play_type_nfl: "PASS" })),
  ])
    assert.deepEqual(
      completedNflMissingZero(parsed, map, rows, evidence),
      parsed,
    );
  assert.deepEqual(completedNflMissingZero(parsed, map, [], plays), parsed);
  assert.equal(
    gameDayPlayerStatus(
      {
        status: "final",
        completed: true,
        parts: [{ statistic: "assumed-zero", quantity: 1, centipoints: 0 }],
      } as StandingPlayer,
      0,
    ),
    "Provisional zero",
  );
});
test("wrong team, malformed statistics and mapping errors cannot become assumed zeros", () => {
  const wrongMap = {
    ...map,
    players: [
      {
        ...map.players[0],
        gsisId: rows[0].player_id,
        team: rows[0].team === "PIT" ? "ATL" : "PIT",
      },
    ],
  };
  const parsed = nflversePostgame(csv, wrongMap, 1, "2026-10-11T00:00:00Z");
  assert.equal(
    completedNflMissingZero(parsed, wrongMap, rows, plays).snapshot.players[0]
      .availability,
    "pending",
  );
});
test("provisional zeros enter authoritative totals and can be corrected without changing frozen rules", () => {
  const f = syntheticScenario("nfl");
  let state = saveTeam(
    f.state,
    "amber",
    "test",
    f.catalog.filter((c) => c.owner === "amber").map((c) => c.cardId),
    f.catalog,
    scenarioTimes.save,
  );
  state = lockTeams(state, f.catalog, scenarioTimes.lock);
  const rulesHash = digest(state.period.rules);
  const absent = structuredClone(f.source);
  absent.missingPlayerPolicy = "nfl-completed-missing-zero-v1";
  absent.players[0] = {
    ...absent.players[0],
    availability: "assumed-zero",
    stats: null,
  };
  const zero = importStatistics(
    state,
    absent,
    { id: "test", role: "importer" },
    scenarioTimes.initial,
  );
  const player = results(zero).rows[0].players.find(
    (p) => p.playerId === absent.players[0].playerId,
  )!;
  assert.equal(player.centipoints, 0);
  assert.notEqual(results(zero).rows[0].centipoints, null);
  assert.deepEqual(
    importStatistics(
      zero,
      absent,
      { id: "test", role: "importer" },
      scenarioTimes.initial,
    ),
    zero,
  );
  const corrected = { ...structuredClone(f.source), revision: 2 };
  const after = importStatistics(
    zero,
    corrected,
    { id: "test", role: "importer" },
    scenarioTimes.initial,
  );
  assert.equal(
    results(after).rows[0].players.find((p) => p.playerId === player.playerId)!
      .matches[0].availability,
    "complete",
  );
  assert.equal(digest(after.period.rules), rulesHash);
  assert.equal(after.sources[0].players[0].availability, "assumed-zero");
  assert.throws(
    () =>
      importStatistics(
        { ...zero, finalisedAt: scenarioTimes.initial },
        corrected,
        { id: "test", role: "importer" },
        scenarioTimes.initial,
      ),
    /late correction/,
  );
  assert.throws(
    () =>
      importStatistics(
        state,
        { ...absent, missingPlayerPolicy: undefined },
        { id: "test", role: "importer" },
        scenarioTimes.initial,
      ),
    /policy/,
  );
});
