import { test } from "node:test";
import assert from "node:assert/strict";
import afl from "../../config/history/afl-2026.json";
import nrl from "../../config/history/nrl-2026.json";
import {
  historicalArchive,
  historyQuery,
  historicalPage,
} from "../../src/core/historical-fixtures";
test("real match archives reconcile published season counts without invented player data", () => {
  for (const [raw, expected, teams] of [
    [afl, 218, 18],
    [nrl, 213, 17],
  ] as const) {
    const a = historicalArchive.parse(raw),
      q = historyQuery.parse({ sport: a.sport }),
      p = historicalPage(a, q);
    assert.equal(p.total, expected);
    assert.equal(p.teams.length, teams);
    assert.equal(p.player_games, 0);
    assert.equal(p.synthetic, false);
    assert.equal(p.player_statistics_available, false);
    assert.equal(new Set(a.games.map((g) => g.id)).size, expected);
    const ids = [];
    for (let page = 0; page < Math.ceil(expected / 20); page++)
      ids.push(...historicalPage(a, { ...q, page }).games.map((g) => g.id));
    assert.equal(new Set(ids).size, expected);
    assert.equal(ids.length, expected);
  }
  const a = historicalArchive.parse(nrl);
  assert.equal(
    a.games.reduce((s, g) => s + g.home_score + g.away_score, 0),
    10167,
  );
  assert.equal(a.games.filter((g) => g.kickoff === null).length, 1);
  assert(
    a.games.every(
      (g) =>
        !["Adam Gee", "Ashley Klein", "Peter Gough"].includes(g.venue ?? ""),
    ),
  );
});
test("history filters and bounds preserve sport scope", () => {
  const a = historicalArchive.parse(afl),
    q = historyQuery.parse({ sport: "afl", team: "Brisbane Lions" });
  assert(
    historicalPage(a, q).games.every((g) =>
      [g.home_name, g.away_name].includes(q.team),
    ),
  );
  assert.throws(
    () => historicalPage(a, historyQuery.parse({ sport: "nrl" })),
    /scope/,
  );
  for (const input of [
    { sport: "nba" },
    { sport: "afl", season: "2025" },
    { sport: "afl", page: -1 },
    { sport: "nrl", page: 0.5 },
  ])
    assert.equal(historyQuery.safeParse(input).success, false);
  const p = historicalPage(a, historyQuery.parse({ sport: "afl" }));
  assert(p.games.length <= 20);
  assert(Buffer.byteLength(JSON.stringify(p)) < 20000);
});
