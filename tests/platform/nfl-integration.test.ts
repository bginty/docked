import { test } from "node:test";
import assert from "node:assert/strict";
import {
  nflTeams,
  nflTeamByName,
  nflSeasonAt,
} from "../../src/content/nfl-teams";
import {
  monitoredCompetitionIds,
  validateMarketDataConfig,
} from "../../src/core/market-data";
import {
  providerFixtures,
  fixtureRules,
  fetchTrialScores,
} from "../../src/providers/market-data";

// Authored events and scores, never actual 2026 results or provider evidence.
const observed = "2026-10-09T12:00:00Z";
const cfg = validateMarketDataConfig({
  version: "market-data-v1.0.0",
  provider: "the-odds-api",
  rights: {
    reference: "Authored parser fixture only",
    display: true,
    storage: true,
    derived: true,
    rawRetentionDays: 1,
  },
  monthlyCreditLimit: 5,
  pollIntervalSeconds: 3600,
  horizonHours: 168,
  maxEvents: 30,
  maxRequestsPerRun: 1,
  regions: ["au"],
  bookmakers: {},
  competitions: [
    {
      competitionId: "americanfootball_nfl",
      providerCompetitionId: "americanfootball_nfl",
      sport: "nfl",
      displayName: "NFL",
      mappingEvidence: "Authored parser mapping only",
    },
    {
      competitionId: "soccer_epl",
      providerCompetitionId: "soccer_epl",
      sport: "football",
      displayName: "EPL",
      mappingEvidence: "Authored parser mapping only",
    },
  ],
});
const event = {
  id: "authored-nfl-1",
  sport_key: "americanfootball_nfl",
  commence_time: "2026-10-10T12:00:00Z",
  home_team: "Buffalo Bills",
  away_team: "Miami Dolphins",
};

test("NFL catalogue contains 32 distinct current teams and eight four-team divisions", () => {
  assert.equal(nflTeams.length, 32);
  assert.equal(new Set(nflTeams.map((t) => t.id)).size, 32);
  assert.equal(new Set(nflTeams.map((t) => t.name)).size, 32);
  for (const c of ["AFC", "NFC"])
    for (const d of ["East", "West", "North", "South"])
      assert.equal(
        nflTeams.filter((t) => t.conference === c && t.division === d).length,
        4,
      );
  assert.equal(nflTeamByName("New York"), undefined);
  assert.equal(nflTeamByName("Oakland Raiders"), undefined);
  assert.equal(nflSeasonAt("2027-02-01T00:00:00Z"), 2026);
  assert.throws(() => nflSeasonAt("invalid"));
});
test("NFL fixture filter is applied to approved competition scope before pagination", () => {
  assert.deepEqual(monitoredCompetitionIds(cfg, { sport: "nfl" }), [
    "americanfootball_nfl",
  ]);
  assert.deepEqual(
    monitoredCompetitionIds(cfg, { sport: "nfl", competition: "soccer_epl" }),
    [],
  );
  assert.deepEqual(monitoredCompetitionIds(cfg, { sport: "unknown" }), []);
  assert.equal(monitoredCompetitionIds(cfg, {}).length, 2);
});
test("NFL fixture ingestion retains exact teams and provenance, never creates pricing rules", () => {
  const rows = providerFixtures([event], cfg, cfg.competitions[0], observed);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].competition, "NFL");
  assert.equal(rows[0].providerEventId, event.id);
  assert.equal(rows[0].sourceUpdatedAt, null);
  assert.equal(fixtureRules(rows[0]), null);
  for (const bad of [
    { ...event, home_team: "New York" },
    { ...event, away_team: event.home_team },
    { ...event, sport_key: "soccer_epl" },
    { ...event, commence_time: "2026-10-08T12:00:00Z" },
    { ...event, status: "cancelled" },
  ])
    assert.equal(
      providerFixtures([bad], cfg, cfg.competitions[0], observed).length,
      0,
    );
  assert.throws(
    () => providerFixtures([event, event], cfg, cfg.competitions[0], observed),
    /Duplicate/,
  );
});
const score = {
  ...event,
  commence_time: "2026-10-08T12:00:00Z",
  completed: true,
  scores: [
    { name: "Buffalo Bills", score: "20" },
    { name: "Miami Dolphins", score: "20" },
  ],
  last_update: "2026-10-08T16:00:00Z",
};
async function inspectScores(payload: unknown) {
  const calls: string[] = [];
  const result = await fetchTrialScores(
    "americanfootball_nfl",
    {
      key: "authored-fixture-only",
      reserve: async (cost) => {
        assert.equal(cost, 2);
        calls.push("reserved");
      },
    },
    async (url) => {
      assert.equal(calls[0], "reserved");
      assert.equal(
        new URL(String(url)).pathname,
        "/v4/sports/americanfootball_nfl/scores",
      );
      return new Response(JSON.stringify(payload));
    },
    () => new Date(observed),
  );
  return result;
}
test("NFL scores retain ties as facts, never settlement; incomplete and impossible finals reject", async () => {
  const result = await inspectScores([score]);
  assert.equal(result.settlementReady, false);
  assert.equal(result.scores[0].scores?.[0].score, "20");
  for (const bad of [
    { ...score, scores: null },
    { ...score, status: "cancelled" },
    { ...score, suspended: true },
    { ...score, last_update: null },
    { ...score, commence_time: "2026-10-10T12:00:00Z" },
    { ...score, last_update: "2026-10-10T12:00:00Z" },
    { ...score, home_team: "Unknown franchise" },
    {
      ...score,
      scores: [
        { name: "Buffalo Bills", score: "20" },
        { name: "Buffalo Bills", score: "20" },
      ],
    },
  ])
    await assert.rejects(inspectScores([bad]), /Invalid provider scores/);
  await assert.rejects(
    inspectScores([score, score]),
    /Invalid provider scores/,
  );
});
