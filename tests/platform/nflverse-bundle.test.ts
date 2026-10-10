import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  completedNflGame,
  inspectNflRosters,
  parseNflDataset,
} from "../../src/core/nflverse-evidence";
import {
  nflversePlayerStatistics,
  parseStatisticsCsv,
  nflversePostgame,
} from "../../src/core/postgame-nflverse";
import { fetchNflDataset } from "../../src/server/nflverse-bundle";
const row = parseStatisticsCsv(
  readFileSync("tests/fixtures/postgame/nflverse-2026-atl-pit.csv", "utf8"),
)[0];
const end = {
  game_id: row.game_id,
  home_team: "PIT",
  away_team: "ATL",
  play_id: "4307",
  play_deleted: "0",
  play_type_nfl: "END_GAME",
  qtr: "4",
  home_score: "20",
  away_score: "13",
};
test("completion requires explicit final active END_GAME; no inferred end time", () => {
  assert.equal(completedNflGame([end])?.actualEndedAt, null);
  assert.equal(
    completedNflGame([{ ...end, play_type_nfl: "END_QUARTER" }]),
    null,
  );
  assert.equal(
    completedNflGame([end, { ...end, play_id: "4308", play_type_nfl: "PASS" }]),
    null,
  );
  assert.equal(completedNflGame([{ ...end, play_deleted: "1" }]), null);
  assert.throws(() => completedNflGame([{ ...end, home_score: "" }]));
});
test("CSV projection strips unused source columns; malformed or missing schema fails", () => {
  assert.deepEqual(
    parseStatisticsCsv('a,b\r\n1,"x,y"', {
      columns: ["a"],
      maxChars: 100,
      maxRows: 2,
      maxColumns: 2,
    }),
    [{ a: "1" }],
  );
  assert.throws(() => parseNflDataset("season,game_id\n2026,x", "pbp", 2026));
  assert.throws(() => parseStatisticsCsv('a,b\n1,"bad'));
});
test("offensive recovery TD counted once; overlapping or multiple attribution stays pending", () => {
  const r: Record<string, string> = {
    ...row,
    fumble_recovery_tds: "1",
    special_teams_tds: "0",
  };
  const p = {
    game_id: r.game_id,
    play_id: "1",
    td_player_id: r.player_id,
    touchdown: "1",
    fumble: "1",
    return_touchdown: "0",
    play_deleted: "0",
    pass_touchdown: "0",
    rush_touchdown: "0",
    special_teams_play: "0",
    lateral_recovery: "0",
    fumble_recovery_2_player_id: "",
    fumble_recovery_1_player_id: r.player_id,
    fumble_recovery_1_team: r.team,
    td_team: r.team,
    fumbled_1_team: r.team,
    posteam: r.team,
    defteam: r.opponent_team,
  };
  assert.equal(
    nflversePlayerStatistics(r, [p]).stats?.offensiveFumbleRecoveryTouchdowns,
    1,
  );
  assert.equal(
    nflversePlayerStatistics(r, [{ ...p, rush_touchdown: "1" }]).stats,
    null,
  );
  assert.equal(
    nflversePlayerStatistics(r, [{ ...p, lateral_recovery: "1" }]).stats,
    null,
  );
  assert.equal(
    nflversePlayerStatistics(r, [
      {
        ...p,
        fumbled_1_team: r.opponent_team,
        posteam: r.opponent_team,
        defteam: r.team,
      },
    ]).stats?.offensiveFumbleRecoveryTouchdowns,
    0,
  );
});
test("missing weekly rows are pending, roster membership never proves DNP", () => {
  const map = {
    fixtureId: "beta-real:qa:game",
    gameId: row.game_id,
    season: 2026,
    seasonType: "REG" as const,
    home: "PIT",
    away: "ATL",
    endedAt: null,
    completionObservedAt: "2026-10-10T00:00:00Z",
    completionEvidence: "https://github.com/nflverse/nflverse-data",
    players: [
      {
        playerId: "nfl:unknown",
        gsisId: "00-9999999",
        team: "PIT",
        position: "QB" as const,
      },
    ],
  };
  const out = nflversePostgame(
    readFileSync("tests/fixtures/postgame/nflverse-2026-atl-pit.csv", "utf8"),
    map,
    1,
    "2026-10-10T07:00:00Z",
  );
  assert.equal(out.snapshot.players[0].availability, "pending");
  assert.equal(out.snapshot.endedAt, null);
  const roster = inspectNflRosters(
    [
      {
        season: "2026",
        team: "PIT",
        position: "QB",
        status: "ACT",
        full_name: "Source player",
        gsis_id: "00-9999999",
        week: "5",
        game_type: "REG",
      },
    ],
    2026,
  );
  assert.equal(roster.participation, "NOT_ESTABLISHED");
  assert.equal(roster.status, "REVIEW_REQUIRED");
});
test("download refuses an arbitrary redirect or HTML", async () => {
  await assert.rejects(
    () =>
      fetchNflDataset(
        "weekly",
        2026,
        {},
        async () =>
          new Response(null, {
            status: 302,
            headers: { location: "https://example.invalid/private" },
          }),
      ),
    /redirect/,
  );
  await assert.rejects(
    () =>
      fetchNflDataset(
        "weekly",
        2026,
        {},
        async () =>
          new Response("login", { headers: { "content-type": "text/html" } }),
      ),
    /content type/,
  );
});
