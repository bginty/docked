import { test } from "node:test";
import assert from "node:assert/strict";
import {
  feedMapping,
  sportsDataBoxscore,
  sportsDataTime,
  sportmonksFixture,
} from "../../src/core/sports-feed-adapters";
import {
  fetchSportsFeed,
  scoringApprovalFromFeedPermit,
  feedRetentionExpiresAt,
} from "../../src/server/sports-feed-client";
import { validateAuthorisedScoring } from "../../src/core/authorised-scoring-feed";

const at = "2026-10-16T12:00:00Z";
const mapping = {
  fixtureId: "fixture:test",
  providerFixtureId: 1,
  playerIds: ["player:a", "player:b"],
  providerPlayers: { "player:a": "2", "player:b": "3" },
};
const permit = {
  provider: "sportsdataio",
  enabled: true,
  scope: "isolated-free-beta",
  fantasyUse: true,
  rawStorage: true,
  derivedStorage: true,
  evidence: "https://example.invalid/synthetic-contract",
  expiresAt: "2099-01-01T00:00:00Z",
  unscrambled: true,
  maxRequestsPerDay: 10,
  rawRetentionDays: 1,
};
const nfl = { Score: { ScoreID: 1, Status: "Scheduled" }, PlayerGames: [] };
const epl = {
  data: {
    id: 1,
    sport_id: 1,
    league_id: 8,
    state: { developer_name: "NS" },
    lineups: [],
    events: [],
  },
};

test("Raw retention is capped at rights expiry rather than extending storage permission", () => {
  assert.equal(feedRetentionExpiresAt(permit, at), "2026-10-17T12:00:00.000Z");
  assert.equal(
    feedRetentionExpiresAt(
      { ...permit, expiresAt: "2026-10-16T13:00:00Z" },
      at,
    ),
    "2026-10-16T13:00:00.000Z",
  );
  assert.throws(
    () => feedRetentionExpiresAt({ ...permit, expiresAt: at }, at),
    /expired/,
  );
  assert.throws(() => feedRetentionExpiresAt(permit, "invalid"));
});

test("Frozen mappings reject missing, aliased, duplicate, extra and unsafe identities before either provider adapter", () => {
  const invalid = [
    { ...mapping, playerIds: [] },
    { ...mapping, playerIds: ["player:a", "player:a"] },
    { ...mapping, providerPlayers: { "player:a": "2" } },
    { ...mapping, providerPlayers: { "player:a": "2", "player:b": "2" } },
    {
      ...mapping,
      providerPlayers: { ...mapping.providerPlayers, "player:c": "4" },
    },
    {
      ...mapping,
      providerPlayers: { ...mapping.providerPlayers, "player:b": "03" },
    },
    {
      ...mapping,
      providerPlayers: {
        ...mapping.providerPlayers,
        "player:b": "9007199254740992",
      },
    },
    { ...mapping, providerFixtureId: Number.MAX_SAFE_INTEGER + 1 },
  ];
  assert.deepEqual(feedMapping.parse(mapping), mapping);
  for (const candidate of invalid) {
    assert.throws(() => sportsDataBoxscore(nfl, candidate, 1, at));
    assert.throws(() => sportmonksFixture(epl, candidate, 1, at));
  }
});

test("Provider adapters validate revision/time and retain missing statistics as pending", () => {
  for (const normalize of [
    (revision: number, observed: string) =>
      sportsDataBoxscore(nfl, mapping, revision, observed),
    (revision: number, observed: string) =>
      sportmonksFixture(epl, mapping, revision, observed),
  ]) {
    assert.throws(() => normalize(0, at));
    assert.throws(() => normalize(1, "not-a-time"));
    const result = normalize(1, at);
    assert.deepEqual(
      result.snapshot.players.map((row) => row.stats),
      [null, null],
    );
    assert.ok(
      result.snapshot.players.every((row) => row.availability === "pending"),
    );
  }
});

test("US Eastern timestamps reject spring gaps and autumn ambiguity instead of shifting fixture times", () => {
  assert.throws(() => sportsDataTime("2026-03-08T02:30:00"), /nonexistent/);
  assert.throws(() => sportsDataTime("2026-11-01T01:30:00"), /Ambiguous/);
  assert.equal(
    sportsDataTime("2026-11-01T01:30:00-04:00"),
    "2026-11-01T05:30:00.000Z",
  );
  assert.equal(
    sportsDataTime("2026-11-01T01:30:00-05:00"),
    "2026-11-01T06:30:00.000Z",
  );
  assert.equal(
    sportsDataTime("2026-03-08T03:30:00.123"),
    "2026-03-08T07:30:00.123Z",
  );
  assert.throws(() => sportsDataTime("2026-03-08"));
});

test("Free-beta feed approval cannot be projected into commercial permission", () => {
  const approval = scoringApprovalFromFeedPermit(
    permit,
    "sportsdataio",
    new Date(at),
  );
  assert.equal(approval.intendedUse, "isolated-free-beta");
  assert.equal(Object.hasOwn(approval, "commercialFantasy"), false);
  const snapshot = sportsDataBoxscore(nfl, mapping, 1, at).snapshot;
  assert.deepEqual(
    validateAuthorisedScoring(
      snapshot,
      approval,
      { ...mapping, sport: "nfl" },
      at,
    ),
    snapshot,
  );
  assert.throws(() =>
    scoringApprovalFromFeedPermit(
      { ...permit, scope: "commercial" },
      "sportsdataio",
      new Date(at),
    ),
  );
  assert.throws(() =>
    scoringApprovalFromFeedPermit(permit, "sportmonks", new Date(at)),
  );
  assert.throws(() =>
    scoringApprovalFromFeedPermit(
      { ...permit, expiresAt: at },
      "sportsdataio",
      new Date(at),
    ),
  );
  const eplApproval = scoringApprovalFromFeedPermit(
    { ...permit, provider: "sportmonks" },
    "sportmonks",
    new Date(at),
  );
  assert.equal(eplApproval.competition, "EPL");
  assert.throws(() =>
    validateAuthorisedScoring(
      snapshot,
      eplApproval,
      { ...mapping, sport: "nfl" },
      at,
    ),
  );
});

test("Provider credential echoes are blocked after JSON unescaping, including nested values and keys", async () => {
  const secret = "synthetic-secret";
  const escaped = secret.replace("s", "\\u0073");
  for (const body of [
    `{"nested":[{"echo":"${escaped}"}]}`,
    `{"${escaped}":"value"}`,
    `{"echo":"${secret}"}`,
  ]) {
    let requests = 0;
    await assert.rejects(
      () =>
        fetchSportsFeed(
          { provider: "sportsdataio", kind: "players" },
          permit,
          secret,
          async () => {
            requests++;
          },
          async () =>
            new Response(body, {
              headers: { "content-type": "application/json" },
            }),
          new Date(at),
        ),
      (error: unknown) =>
        /credential material/.test(String(error)) &&
        !String(error).includes(secret),
    );
    assert.equal(requests, 1);
  }
});

test("Safe provider sample survives validation without invented fields or credentials", async () => {
  const payload = {
    data: [{ id: 1, score: null }],
    label: "Synthetic fixture only",
  };
  const result = await fetchSportsFeed(
    { provider: "sportsdataio", kind: "players" },
    permit,
    "synthetic-secret",
    async () => {},
    async () => Response.json(payload),
    new Date(at),
  );
  assert.deepEqual(result.payload, payload);
  assert.equal(Object.hasOwn(result, "secret"), false);
});
