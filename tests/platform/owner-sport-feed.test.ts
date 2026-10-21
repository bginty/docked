import { test } from "node:test";
import assert from "node:assert/strict";
import { previewOwnerSportFeed } from "../../src/core/owner-sport-feed";
import { sportEventRules } from "../../src/core/sport-event-rules";
import {
  importStatistics,
  results,
  digest,
  type ScoringState,
} from "../../src/core/scoring-engine";
const now = "2099-01-02T00:00:00Z",
  ended = "2099-01-01T23:00:00Z";
const rules = sportEventRules("basketball");
const mapping = {
  sport: "basketball",
  provider: "owner-boxscores",
  season: "2099",
  providerFixtureId: "game1",
  fixtureId: "fixture1",
  scoringVersion: rules.version,
  maxAgeSeconds: 3600,
  players: [
    { providerPlayerId: "source1", playerId: "player1", position: "PG" },
    { providerPlayerId: "source2", playerId: "player2", position: "C" },
  ],
};
const feed = {
  schemaVersion: 1,
  sport: "basketball",
  provider: mapping.provider,
  season: "2099",
  providerFixtureId: "game1",
  revision: 1,
  observedAt: now,
  endedAt: ended,
  status: "completed",
  evidence: {
    url: "https://example.invalid/fictional-box-score",
    sha256: "a".repeat(64),
  },
  players: [
    {
      providerPlayerId: "source1",
      availability: "complete",
      stats: {
        points: 24,
        rebounds: 10,
        assists: 8,
        steals: 2,
        blocks: 1,
        turnovers: 5,
        threePointers: 4,
      },
    },
  ],
};
test("owner scraper maps stable IDs, preserves gaps, distinguishes DNP and a real zero", () => {
  const r = previewOwnerSportFeed(feed, mapping, rules, now);
  assert.equal(r.players[0].baseCentipoints, 5900);
  assert.deepEqual(r.missingPlayerIds, ["player2"]);
  assert.equal(r.players[1].baseCentipoints, null);
  assert.equal(r.snapshot.simulated, false);
  assert.equal(r.persistenceAllowed, false);
  const zero = Object.fromEntries(
    Object.keys(feed.players[0].stats).map((k) => [k, 0]),
  );
  for (const availability of ["complete", "confirmed-dnp", "pending"]) {
    const r = previewOwnerSportFeed(
      {
        ...feed,
        players: [
          {
            providerPlayerId: "source2",
            availability,
            stats: availability === "complete" ? zero : null,
          },
        ],
      },
      mapping,
      rules,
      now,
    );
    assert.equal(
      r.players[1].baseCentipoints,
      availability === "pending" ? null : 0,
    );
  }
  assert.equal(
    previewOwnerSportFeed(
      { ...feed, status: "live", endedAt: null },
      mapping,
      rules,
      now,
    ).players[0].baseCentipoints,
    null,
  );
});
test("owner scraper rejects guessed values, duplicate IDs, cross-sport data and stale/mismatched sources", () => {
  const original = JSON.stringify(feed);
  for (const bad of [
    { ...feed, sport: "afl" },
    { ...feed, season: "2098" },
    { ...feed, provider: "other" },
    { ...feed, providerFixtureId: "wrong" },
    { ...feed, observedAt: ended },
    { ...feed, observedAt: "2099-01-02T00:00:01Z" },
    { ...feed, players: [feed.players[0], feed.players[0]] },
    {
      ...feed,
      players: [{ ...feed.players[0], providerPlayerId: "unmapped" }],
    },
    {
      ...feed,
      players: [{ ...feed.players[0], availability: "confirmed-dnp" }],
    },
    { ...feed, players: [{ ...feed.players[0], stats: {} }] },
    { ...feed, finalPoints: 100 },
  ])
    assert.throws(() =>
      previewOwnerSportFeed(
        bad,
        { ...mapping, maxAgeSeconds: 3599 },
        rules,
        now,
      ),
    );
  assert.throws(() =>
    previewOwnerSportFeed(
      feed,
      { ...mapping, scoringVersion: "wrong" },
      rules,
      now,
    ),
  );
  assert.throws(() =>
    previewOwnerSportFeed(
      feed,
      { ...mapping, players: [mapping.players[0], mapping.players[0]] },
      rules,
      now,
    ),
  );
  assert.equal(JSON.stringify(feed), original);
});
test("scraper snapshots reuse the authoritative importer, correction audit, totals and final-result controls", () => {
  const base: ScoringState = {
    schemaVersion: 1,
    scope: "authorised-free-beta",
    period: {
      id: "beta:qa",
      sport: "basketball",
      label: "Fixture only",
      locksAt: "2099-01-01T00:00:00Z",
      rules,
      fixtures: [
        {
          id: "fixture1",
          scheduledAt: "2099-01-01T00:00:00Z",
          playerIds: ["player1", "player2"],
        },
      ],
    },
    entries: [
      {
        member: "qa",
        name: "QA",
        cards: [{ cardId: "qa-card", playerId: "player1", position: "PG" }],
        lockedAt: "2099-01-01T00:00:00Z",
        rulesHash: digest(rules),
      },
    ],
    sources: [],
    audits: [],
    finalisedAt: null,
    lineupsLockedAt: "2099-01-01T00:00:00Z",
  };
  const policy = {
    provider: mapping.provider,
    competition: "NBA",
    intendedUse: "isolated-free-beta",
    fantasyUse: true,
    storage: true,
    evidence: "https://example.invalid/fixture-policy",
    reviewExpires: "2099-02-01T00:00:00Z",
    maxAgeSeconds: 3600,
  };
  const op = { id: "qa-importer", role: "importer" as const };
  const s = previewOwnerSportFeed(feed, mapping, rules, now).snapshot;
  assert.throws(() => importStatistics(base, s, op, now)); // no policy silently fabricated
  const first = importStatistics(base, s, op, now, undefined, policy);
  assert.equal(results(first).rows[0].centipoints, 5900);
  assert.deepEqual(
    importStatistics(first, s, op, now, undefined, policy),
    first,
  );
  const corrected = structuredClone(feed);
  corrected.revision = 2;
  corrected.players[0].stats.points = 25;
  const next = previewOwnerSportFeed(corrected, mapping, rules, now).snapshot;
  const second = importStatistics(first, next, op, now, undefined, policy);
  assert.equal(results(second).rows[0].centipoints, 6000);
  assert.equal(second.audits.at(-1)?.action, "statistics-corrected");
  assert.throws(
    () =>
      importStatistics(
        { ...first, finalisedAt: now },
        next,
        op,
        now,
        undefined,
        policy,
      ),
    /late correction/,
  );
});
