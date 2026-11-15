import test from "node:test";
import assert from "node:assert/strict";
import { nflCollectionPermit } from "../../src/server/nfl-collection-permit";
import { requirePostgamePermit } from "../../src/server/postgame-download";

test("stable catalogue does not renew expired source collection permission", () => {
  for (const task of ["rosters", "weekly", "pbp", "reconcile"] as const)
    assert.throws(
      () =>
        requirePostgamePermit(
          nflCollectionPermit(task),
          new Date("2026-11-15T00:00:00Z"),
        ),
      /source review expired/,
    );
});
