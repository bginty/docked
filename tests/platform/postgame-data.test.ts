import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  nflversePlayerStatistics,
  nflversePostgame,
  parseStatisticsCsv,
} from "../../src/core/postgame-nflverse";
import { scorePlayer } from "../../src/core/scoring-v1";
import { currentRulesets } from "../../src/core/scoring-release";
import {
  fetchNflverseCsv,
  postgameChecks,
  requirePostgamePermit,
} from "../../src/server/postgame-download";
import { validateAuthorisedScoring } from "../../src/core/authorised-scoring-feed";

const csv = readFileSync(
  "tests/fixtures/postgame/nflverse-2026-atl-pit.csv",
  "utf8",
);
const rows = parseStatisticsCsv(csv);
const now = "2026-10-11T00:00:00Z";
const map = {
  fixtureId: "qa:nfl:fixture",
  gameId: "2026_01_ATL_PIT",
  season: 2026,
  seasonType: "REG" as const,
  home: "PIT",
  away: "ATL",
  players: [
    {
      playerId: "qa:rodgers",
      gsisId: "00-0023459",
      team: "PIT",
      position: "QB" as const,
    },
  ],
  // Synthetic timestamp solely exercises adapter contract. Actual bulk source
  // does not establish an exact final whistle/end instant.
  endedAt: "2026-09-13T22:00:00Z",
  completionEvidence: "https://example.invalid/synthetic-completion-contract",
};

test("Downloaded completed-match statistics reconcile Docked half-PPR, not provider fantasy totals", () => {
  assert.equal(rows.length, 20);
  const expected: Record<string, number> = {
    "00-0023459": 1254, // Rodgers: 221*.04 + 1*4 - 3*.1
    "00-0036894": 1310, // Freiermuth: 5*.5 + 46*.1 + 1*6
    "00-0037228": 780, // Warren: 46*.1 + 5*.5 + 27*.1 - 1*2
    "00-0038542": 2730, // Robinson: 83*.1 + 8*.5 + 90*.1 + 1*6
  };
  for (const [id, cp] of Object.entries(expected)) {
    const r = rows.find((r) => r.player_id === id)!;
    const normalized = nflversePlayerStatistics(r);
    assert.equal(normalized.issue, null);
    assert.equal(
      scorePlayer(currentRulesets.nfl, r.position, normalized.stats)
        .centipoints,
      cp,
    );
  }
});
test("Missing, malformed and ambiguous NFL fields remain pending, explicit zero aggregates are safe", () => {
  const row = rows[0];
  const changes: Record<string, string>[] = [
    { passing_yards: "" },
    { fumbles_lost_total: "NA" },
    { special_teams_tds: "1" },
    { fumble_recovery_tds: "1" },
    { receptions: "-1" },
    { receiving_tds: "1.5" },
  ];
  for (const change of changes)
    assert.equal(nflversePlayerStatistics({ ...row, ...change }).stats, null);
  assert.equal(
    nflversePlayerStatistics(row).stats?.offensiveFumbleRecoveryTouchdowns,
    0,
  );
});
test("Real companion match plays resolve Myles Price punt return without guessing or changing rules", () => {
  const row = parseStatisticsCsv(
    readFileSync(
      "tests/fixtures/postgame/nflverse-2026-return-sample.csv",
      "utf8",
    ),
  )[0];
  const plays = parseStatisticsCsv(
    readFileSync(
      "tests/fixtures/postgame/nflverse-2026-min-tb-plays.csv",
      "utf8",
    ),
  );
  assert.equal(plays.length, 179);
  assert.equal(nflversePlayerStatistics(row).stats, null);
  const result = nflversePlayerStatistics(row, plays);
  assert.equal(result.stats?.punt_return_touchdowns, 1);
  assert.equal(result.stats?.kickoff_return_touchdowns, 0);
  assert.equal(
    scorePlayer(currentRulesets.nfl, "WR", result.stats).centipoints,
    600,
  );
  assert.equal(nflversePlayerStatistics(row, [...plays, plays[0]]).stats, null);
  assert.equal(
    nflversePlayerStatistics(
      row,
      plays.filter((p) => p.play_id !== "362"),
    ).stats,
    null,
  );
  assert.equal(
    nflversePlayerStatistics(
      row,
      plays.map((p) => (p.play_id === "362" ? { ...p, fumble: "1" } : p)),
    ).stats,
    null,
  );
  assert.equal(
    nflversePlayerStatistics(
      row,
      plays.map((p) => ({ ...p, game_id: "wrong" })),
    ).stats,
    null,
  );
});
test("Stable game/GSIS/team/position mapping and missing-player abstention", () => {
  const result = nflversePostgame(csv, map, 1, now);
  assert.equal(result.snapshot.status, "completed");
  assert.equal(result.snapshot.simulated, false);
  assert.equal(result.snapshot.players[0].availability, "complete");
  const missing = nflversePostgame(
    csv,
    { ...map, players: [{ ...map.players[0], gsisId: "00-9999999" }] },
    1,
    now,
  );
  assert.equal(missing.snapshot.players[0].availability, "pending");
  assert.equal(missing.snapshot.players[0].stats, null);
  assert.equal(
    nflversePostgame(
      csv,
      { ...map, players: [{ ...map.players[0], team: "ATL" }] },
      1,
      now,
    ).issues.length,
    1,
  );
  assert.throws(
    () => nflversePostgame(csv, { ...map, home: "XXX" }, 1, now),
    /identity/,
  );
  assert.throws(
    () =>
      nflversePostgame(
        csv,
        { ...map, endedAt: "2027-01-01T00:00:00Z" },
        1,
        now,
      ),
    /completed/,
  );
  assert.throws(
    () => nflversePostgame(csv + csv.split(/\r?\n/)[1] + "\n", map, 1, now),
    /Duplicate/,
  );
});
test("CSV rejects malformed schemas and handles quoted names without formula evaluation", () => {
  assert.deepEqual(
    parseStatisticsCsv('id,name\r\n1,"Name, With ""Quote"""\r\n'),
    [{ id: "1", name: 'Name, With "Quote"' }],
  );
  for (const bad of [
    "id,id\n1,2",
    "id,name\n1",
    'id,name\n1,"bad',
    'id,name\n1,"x"oops',
    'id,name\n1,na"me',
  ])
    assert.throws(() => parseStatisticsCsv(bad));
  assert.throws(
    () => nflversePostgame("player_id\n00-0023459", map, 1, now),
    /schema/,
  );
});
test("Free-beta rights do not require purchasing a commercial API; approval and expiry still enforced", () => {
  const approval = {
    provider: "nflverse",
    competition: "NFL",
    intendedUse: "isolated-free-beta",
    fantasyUse: true,
    storage: true,
    evidence: "https://example.invalid/rights-contract",
    reviewExpires: "2026-11-01T00:00:00Z",
    maxAgeSeconds: 86400,
  };
  const data = nflversePostgame(csv, map, 1, now).snapshot;
  assert.equal(
    validateAuthorisedScoring(
      data,
      approval,
      { sport: "nfl", fixtureId: map.fixtureId, playerIds: ["qa:rodgers"] },
      now,
    ).provider,
    "nflverse",
  );
  assert.throws(() =>
    validateAuthorisedScoring(
      data,
      { ...approval, fantasyUse: false },
      { sport: "nfl", fixtureId: map.fixtureId, playerIds: ["qa:rodgers"] },
      now,
    ),
  );
  assert.throws(() => requirePostgamePermit({}, new Date(now)));
});
test("Bulk downloader follows only public asset CDN, uses conditional cache and detects changed schema", async () => {
  const urls: string[] = [];
  const result = await fetchNflverseCsv(
    2026,
    { etag: '"known"' },
    async (url, init) => {
      urls.push(String(url));
      assert.equal(init?.redirect, "manual");
      assert.equal(
        (init?.headers as Record<string, string>)["If-None-Match"],
        '"known"',
      );
      return urls.length === 1
        ? new Response(null, {
            status: 302,
            headers: {
              location:
                "https://release-assets.githubusercontent.com/known-test.csv",
            },
          })
        : new Response(csv, {
            headers: { "content-type": "text/csv", etag: '"new"' },
          });
    },
  );
  assert.equal(result.notModified, false);
  assert.equal(urls.length, 2);
  assert.equal(
    (
      await fetchNflverseCsv(
        2026,
        {},
        async () => new Response(null, { status: 304 }),
      )
    ).notModified,
    true,
  );
  await assert.rejects(
    () =>
      fetchNflverseCsv(
        2026,
        {},
        async () =>
          new Response(null, {
            status: 302,
            headers: { location: "http://127.0.0.1/private" },
          }),
      ),
    /redirect/,
  );
  await assert.rejects(
    () =>
      fetchNflverseCsv(
        2026,
        {},
        async () =>
          new Response("<html>login</html>", {
            headers: { "content-type": "text/html" },
          }),
      ),
    /content/,
  );
  await assert.rejects(
    () =>
      fetchNflverseCsv(
        2026,
        {},
        async () =>
          new Response("id\n1", { headers: { "content-type": "text/csv" } }),
      ),
    /schema/,
  );
  assert.equal(
    postgameChecks("2026-10-01T00:00:00Z")[4],
    "2026-10-08T00:00:00.000Z",
  );
});
