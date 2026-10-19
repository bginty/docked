import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { friendsStarterPlan } from "../../src/core/player-catalogue";
import { currentRulesets } from "../../src/core/scoring-release";
import { createFreeBetaPeriod } from "../../src/core/free-beta-scoring";
import {
  sportsDataBoxscore,
  sportmonksFixture,
  sportsDataTime,
  nflRequiredProviderFields,
  sportmonksSquad,
  sportsDataCatalogue,
} from "../../src/core/sports-feed-adapters";
import { fetchSportsFeed } from "../../src/server/sports-feed-client";
import {
  saveTeam,
  lockTeams,
  importStatistics,
  finalise,
  results,
} from "../../src/core/scoring-engine";
import {
  syntheticScenario,
  scenarioTimes as t,
} from "../../src/core/scoring-synthetic";

const now = "2026-10-11T00:00:00Z";
test("Current squad import preserves stable identity, current club and mapped positions without rookie restriction", () => {
  const team = {
    id: 1,
    leagueId: 8 as const,
    verifiedAt: now,
    name: "Synthetic contract club",
    positionMap: { "3": "MID" },
  };
  const row = {
    player_id: 2,
    team_id: 1,
    position_id: 3,
    start: "2026-01-01",
    end: null,
    player: { id: 2, display_name: "Synthetic contract player" },
  };
  const p = sportmonksSquad({ data: [row] }, team, now)[0];
  assert.equal(p.providerId, "2");
  assert.equal(p.firstEligibleSeason, null);
  assert.equal(p.position, "MID");
  assert.equal(
    sportmonksSquad({ data: [{ ...row, end: "2026-10-10" }] }, team, now)
      .length,
    0,
  );
  assert.throws(
    () =>
      sportmonksSquad(
        { data: [row] },
        { ...team, verifiedAt: "2026-10-08T00:00:00Z" },
        now,
      ),
    /membership/,
  );
  assert.throws(
    () =>
      sportmonksSquad(
        { data: [{ ...row, player: { ...row.player, id: 4 } }] },
        team,
        now,
      ),
    /Unmapped/,
  );
  assert.throws(() => sportmonksSquad({ data: [row] }, team, "invalid"));
  const nfl = sportsDataCatalogue(
    [
      {
        PlayerID: 2,
        Name: "Synthetic contract player",
        Team: "QA",
        Position: "QB",
        Status: "Active",
      },
    ],
    now,
  );
  assert.equal(nfl[0].providerId, "2");
  assert.equal(nfl[0].scoringSupported, true);
  assert.throws(() =>
    sportsDataCatalogue(
      [
        {
          PlayerID: 2,
          Name: "Synthetic contract player",
          Team: "QA",
          Position: "QB",
          Status: "Active",
        },
      ],
      "invalid",
    ),
  );
});
test("Approved beta current-player eligibility supports complete EPL/NFL teams without rookie facts", () => {
  for (const sport of ["epl", "nfl"] as const) {
    const rules = currentRulesets[sport];
    const players = rules.slots.map((s, i) => ({
      id: randomUUID(),
      provider: "contract-test",
      providerId: String(i + 1),
      name: `Synthetic contract player ${i}`,
      sport,
      competition: sport.toUpperCase(),
      currentClubId: "club",
      currentClub: "Synthetic contract club",
      position: s.positions[0],
      firstEligibleSeason: null,
      observedAt: now,
      evidence: "https://example.invalid/fixture",
    }));
    const manifest = {
      provider: "contract-test",
      version: "fixture-only",
      reviewedAt: now,
      reviewExpiresAt: "2026-11-01T00:00:00Z",
      evidence: "https://example.invalid/rights",
      fantasyUse: true,
      storage: true,
      collectibleSales: false,
      playerLikeness: false,
      clubLogos: false,
      players,
    };
    assert.equal(
      friendsStarterPlan(manifest, rules, now).grantsPerMember,
      sport === "epl" ? 11 : 7,
    );
    assert.throws(
      () =>
        friendsStarterPlan(
          { ...manifest, players: players.slice(1) },
          rules,
          now,
        ),
      /complete/,
    );
    assert.throws(() =>
      friendsStarterPlan({ ...manifest, fantasyUse: false }, rules, now),
    );
  }
});
test("Provider contract fields preserve missingness and do not turn deprecated NFL statistics into zero", () => {
  const mapping = {
    fixtureId: "beta-nfl-one",
    providerFixtureId: 1,
    playerIds: ["p"],
    providerPlayers: { p: "2" },
  };
  const row = {
    ScoreID: 1,
    PlayerID: 2,
    ...Object.fromEntries(nflRequiredProviderFields.map((f) => [f, 0])),
    OffensiveFumbleRecoveryTouchdowns: 0,
  };
  const raw = {
    Score: {
      ScoreID: 1,
      Status: "Final",
      GameEndDateTime: "2026-10-10T15:00:00",
    },
    PlayerGames: [row],
  };
  const r = sportsDataBoxscore(raw, mapping, 1, now);
  assert.equal(r.snapshot.players[0].stats, null);
  assert.ok(r.issues.some((s) => s.includes("fumble")));
  assert.equal(r.snapshot.endedAt, "2026-10-10T19:00:00.000Z");
  assert.throws(
    () =>
      sportsDataBoxscore({ ...raw, PlayerGames: [row, row] }, mapping, 1, now),
    /Duplicate/,
  );
  assert.throws(() => sportsDataTime("2026-11-01T01:30:00"), /Ambiguous/);
  assert.equal(
    sportsDataBoxscore({ ...raw, PlayerGames: [] }, mapping, 1, now).snapshot
      .players[0].availability,
    "pending",
  );
});
test("Documented Sportmonks fixture envelope excludes other leagues and requires exact timing evidence", () => {
  const mapping = {
    fixtureId: "beta-epl-one",
    providerFixtureId: 1,
    playerIds: ["p"],
    providerPlayers: { p: "2" },
  };
  const data = {
    id: 1,
    sport_id: 1,
    league_id: 8,
    state: { developer_name: "FT" },
    lineups: [{ player_id: 2, details: [] }],
    events: [],
  };
  const r = sportmonksFixture({ data }, mapping, 1, now);
  assert.equal(r.snapshot.players[0].stats, null);
  assert.ok(r.issues.length >= 2);
  assert.throws(
    () =>
      sportmonksFixture({ data: { ...data, league_id: 501 } }, mapping, 1, now),
    /Premier League/,
  );
});
test("Provider fetch gate, quota, fixed paths, redirects and secret-bearing errors", async () => {
  let calls = 0,
    budget = 0;
  const permit = {
    provider: "sportsdataio",
    enabled: true,
    scope: "isolated-free-beta",
    fantasyUse: true,
    rawStorage: true,
    derivedStorage: true,
    evidence: "https://example.invalid/contract",
    expiresAt: "2099-01-01T00:00:00Z",
    unscrambled: true,
    maxRequestsPerDay: 5,
    rawRetentionDays: 30,
  };
  const fetcher: typeof fetch = async (url, init) => {
    calls++;
    assert.equal(init?.redirect, "error");
    assert.ok(!String(url).includes("test-secret"));
    return Response.json({ Score: {} });
  };
  await assert.rejects(() =>
    fetchSportsFeed(
      { provider: "sportsdataio", kind: "boxscore", id: 1 },
      { ...permit, enabled: false },
      "test-secret",
      async () => {
        budget++;
      },
      fetcher,
    ),
  );
  assert.equal(calls, 0);
  assert.equal(budget, 0);
  await fetchSportsFeed(
    { provider: "sportsdataio", kind: "boxscore", id: 1 },
    permit,
    "test-secret",
    async () => {
      budget++;
    },
    fetcher,
  );
  assert.equal(calls, 1);
  assert.equal(budget, 1);
  await assert.rejects(
    () =>
      fetchSportsFeed(
        { provider: "sportsdataio", kind: "boxscore", id: 1 },
        permit,
        "test-secret",
        async () => {
          throw Error("budget");
        },
        fetcher,
      ),
    /budget/,
  );
  assert.equal(calls, 1);
  await assert.rejects(
    () =>
      fetchSportsFeed(
        { provider: "sportsdataio", kind: "boxscore", id: 1 },
        permit,
        "test-secret",
        async () => {},
        async () => new Response("test-secret", { status: 401 }),
      ),
    (e) => String(e).includes("HTTP 401") && !String(e).includes("test-secret"),
  );
});
test("Real-source engine uses the shared rules, frozen lineups, corrections and complete finalisation; samples are test-only", () => {
  const f = syntheticScenario("nfl");
  const period = {
    ...f.state.period,
    rules: currentRulesets.nfl,
    id: "beta-real:nfl:contract",
    fixtures: f.state.period.fixtures.map((x) => ({
      ...x,
      id: x.id.replace("sim:", "beta-real:"),
    })),
  };
  let s = createFreeBetaPeriod(period, t.save, {
    source: "https://example.invalid/schedule-fixture",
    verifiedAt: t.save,
    completeRound: true,
    lockPolicy: "whole-round-before-first-kickoff",
    offsetSeconds: 0,
  });
  const catalog = f.catalog.map((c) => ({ ...c }));
  s = saveTeam(
    s,
    "amber",
    "Contract only",
    catalog.filter((c) => c.owner === "amber").map((c) => c.cardId),
    catalog,
    t.save,
  );
  s = lockTeams(s, catalog, t.lock);
  const approval = {
    provider: "contract-test",
    competition: "NFL",
    commercialFantasy: true,
    storage: true,
    evidence: "https://example.invalid/fixture",
    reviewExpires: "2099-01-01T00:00:00Z",
    maxAgeSeconds: 86400,
  };
  const source = {
    ...f.source,
    players: f.source.players.map((player) => ({
      ...player,
      stats: player.stats
        ? Object.fromEntries(
            Object.keys(currentRulesets.nfl.weights).map((key) => [
              key,
              (player.stats as Record<string, number>)[key],
            ]),
          )
        : null,
    })),
    provider: "contract-test",
    simulated: false,
    competition: "NFL",
    fixtureId: period.fixtures[0].id,
  };
  assert.throws(
    () =>
      importStatistics(s, source, { id: "test", role: "importer" }, t.initial),
    /./,
  );
  s = importStatistics(
    s,
    source,
    { id: "test", role: "importer" },
    t.initial,
    undefined,
    approval,
  );
  assert.equal(results(s).simulated, false);
  assert.equal(results(s).rows[0].status, "provisional");
  s = finalise(s, { id: "test", role: "reviewer" }, t.final);
  assert.equal(results(s).rows[0].status, "final");
  assert.throws(
    () =>
      createFreeBetaPeriod(period, t.final, {
        source: "https://example.invalid/x",
        verifiedAt: t.final,
        completeRound: true,
        lockPolicy: "whole-round-before-first-kickoff",
        offsetSeconds: 0,
      }),
    /started/,
  );
});
