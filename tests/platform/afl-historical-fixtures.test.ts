import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  canonicalFixtureBatch,
  mapScoringFixtures,
} from "../../src/core/sport-fixture-contract";
test("documented Squiggle historical AFL fixtures preserve real game IDs and UTC; team results never imply player stats", () => {
  const evidence = JSON.parse(
    readFileSync("docs/qa/multi-sport/afl-historical-fixtures.json", "utf8"),
  );
  const batch = canonicalFixtureBatch.parse({
    schemaVersion: 1,
    sport: "afl",
    season: "2019",
    provider: "squiggle",
    revision: 1,
    observedAt: evidence.observedAt,
    sourceUpdatedAt: null,
    source: evidence.source,
    sourceHash: evidence.sha256,
    completePeriod: true,
    fixtures: evidence.payload.games.map(
      (g: {
        id: number;
        unixtime: number;
        hteamid: number;
        ateamid: number;
        complete: number;
      }) => ({
        providerFixtureId: String(g.id),
        homeTeamId: String(g.hteamid),
        awayTeamId: String(g.ateamid),
        scheduledAt: new Date(g.unixtime * 1000).toISOString(),
        status: g.complete === 100 ? "completed" : "scheduled",
        playerStatistics: "unavailable",
      }),
    ),
  });
  assert.equal(batch.fixtures.length, 9);
  const first = batch.fixtures.find((f) => f.providerFixtureId === "3049")!;
  assert.equal(first.scheduledAt, "2019-03-21T08:20:00.000Z");
  assert(batch.fixtures.every((f) => f.playerStatistics === "unavailable"));
  const empty = {
    sport: "afl" as const,
    season: "2019",
    provider: "squiggle",
    fixtures: [],
  };
  assert.throws(
    () => mapScoringFixtures(batch, empty, batch.observedAt, 3600),
    /mapping/,
  );
  // Artificial identities test mapping only, not historical player participation.
  const mapping = {
    ...empty,
    fixtures: batch.fixtures.map((f) => ({
      providerFixtureId: f.providerFixtureId,
      fixtureId: `qa:historical:${f.providerFixtureId}`,
      playerIds: ["qa:fictional-only"],
    })),
  };
  assert.equal(
    mapScoringFixtures(batch, mapping, batch.observedAt, 3600).length,
    9,
  );
  assert.throws(
    () =>
      mapScoringFixtures(
        { ...batch, completePeriod: false },
        mapping,
        batch.observedAt,
        3600,
      ),
    /Complete/,
  );
  assert.throws(
    () =>
      mapScoringFixtures(
        {
          ...batch,
          fixtures: batch.fixtures.map((f) => ({ ...f, status: "postponed" })),
        },
        mapping,
        batch.observedAt,
        3600,
      ),
    /Exceptional/,
  );
});
