import { test } from "node:test";
import assert from "node:assert/strict";
import { gameDayStandings } from "../../src/server/game-day";
import { gameDayPlayerStatus, gameDayPoints } from "../../src/core/game-day";
import type { StandingRound, StandingPlayer } from "../../src/core/standings";
import { parseStatisticsCsv } from "../../src/core/postgame-nflverse";

test("provisional standings use persisted known totals, preserve missing data and shared ties", () => {
  const round = {
    visible: true,
    finalised: false,
    rows: [
      {
        key: "a",
        centipoints: null,
        knownCentipoints: 2500,
        rank: null,
        lineup: null,
      },
      {
        key: "b",
        centipoints: null,
        knownCentipoints: 2500,
        rank: null,
        lineup: null,
      },
      {
        key: "c",
        centipoints: 0,
        knownCentipoints: 0,
        rank: null,
        lineup: null,
      },
      {
        key: "d",
        centipoints: null,
        knownCentipoints: null,
        rank: null,
        lineup: null,
      },
    ],
  } as StandingRound;
  const before = structuredClone(round);
  const result = gameDayStandings([round])[0];
  assert.deepEqual(
    result.rows.map((r) => r.currentRank),
    [1, 1, 3, null],
  );
  assert.deepEqual(
    result.rows.map((r) => r.currentCentipoints),
    [2500, 2500, 0, null],
  );
  assert.equal(result.rows[0].centipoints, null);
  assert.deepEqual(round, before);
  assert.ok(result.rows.every((r) => r.lineup === null));
  assert.ok(
    gameDayStandings([{ ...round, visible: false }])[0].rows.every(
      (r) => r.currentCentipoints === null && r.currentRank === null,
    ),
  );
});
test("final ranks remain authoritative, corrections reorder provisional ranks without inventing a final winner", () => {
  const round = {
    visible: true,
    finalised: true,
    rows: [
      { key: "a", centipoints: 3000, rank: 2 },
      { key: "b", centipoints: 4000, rank: 1 },
    ],
  } as StandingRound;
  assert.equal(gameDayStandings([round])[0].rows[0].currentRank, 1);
  round.finalised = false;
  round.rows[0].centipoints = 5000;
  assert.equal(gameDayStandings([round])[0].rows[0].key, "a");
  assert.equal(round.rows[0].rank, 2);
});
test("confirmed zero, DNP, delayed data and pregame remain distinct", () => {
  const player = {
    status: "pending-data",
    centipoints: null,
    fixtures: [{ scheduledAt: "2030-01-01T00:00:00Z" }],
  } as StandingPlayer;
  assert.equal(
    gameDayPlayerStatus(player, Date.parse("2026-01-01")),
    "Not started",
  );
  assert.equal(
    gameDayPlayerStatus(player, Date.parse("2031-01-01")),
    "Awaiting stats",
  );
  assert.equal(
    gameDayPlayerStatus({ ...player, status: "dnp", centipoints: 0 }, 0),
    "DNP",
  );
  assert.equal(gameDayPoints(0), "0.0");
  assert.equal(gameDayPoints(null), "—");
  assert.equal(
    gameDayPlayerStatus(
      { ...player, status: "final", completed: true, centipoints: 0 },
      0,
    ),
    "Final",
  );
});
test("fast CSV projection retains strict quoting, missing values and complete row validation", () => {
  const profile = {
    columns: ["id", "value"],
    maxChars: 10000,
    maxRows: 20,
    maxColumns: 5,
  };
  assert.deepEqual(
    parseStatisticsCsv(
      '\uFEFFid,ignored,value\r\none,"a,b",""\r\ntwo,"a\nb","a""b"\r\nthree,x,',
      profile,
    ),
    [
      { id: "one", value: "" },
      { id: "two", value: 'a"b' },
      { id: "three", value: "" },
    ],
  );
  for (const text of [
    "id,ignored,value\nx,y",
    "id,ignored,value\nx,y,z,extra",
    'id,ignored,value\nx,a"b,z',
    'id,ignored,value\nx,"y"x,z',
    'id,ignored,value\nx,"y,z',
    "id,id,value\nx,y,z",
  ])
    assert.throws(() => parseStatisticsCsv(text, profile));
});
