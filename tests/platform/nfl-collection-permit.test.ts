import test from "node:test";
import assert from "node:assert/strict";
import { nflCollectionPermit } from "../../src/server/nfl-collection-permit";
import { requirePostgamePermit } from "../../src/server/postgame-download";

test("bounded roster-only review cannot renew statistics or scoring", () => {
  const now = new Date("2026-11-15T00:00:00Z");
  const roster = requirePostgamePermit(nflCollectionPermit("rosters"), now);
  assert.equal(roster.scope, "isolated-free-beta");
  assert.equal(roster.rawRetentionDays, 30);
  assert.equal(roster.expiresAt, "2026-11-22T00:00:00.000Z");
  for (const task of ["weekly", "pbp", "reconcile"] as const)
    assert.throws(
      () => requirePostgamePermit(nflCollectionPermit(task), now),
      /source review expired/,
    );
  assert.throws(
    () => requirePostgamePermit(roster, new Date(roster.expiresAt)),
    /source review expired/,
  );
});
