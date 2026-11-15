import test from "node:test";
import assert from "node:assert/strict";
import type { Sql } from "postgres";
import { downloadNflDataset } from "../../src/server/nflverse-bundle";
import { nflCollectionPermit } from "../../src/server/nfl-collection-permit";
import { CollectionFailure } from "../../src/server/nfl-collection-diagnostics";

test("roster provider failure preserves retained bodies and cannot use expired review", async () => {
  const queries: string[] = [];
  let fetched = 0;
  const sql = (async (parts: TemplateStringsArray) => {
    const query = parts.join("?");
    queries.push(query);
    if (query.startsWith("insert into sports_feed.postgame_cache"))
      return [{ raw_id: null }];
    if (query.startsWith("select * from sports_feed.raw_revisions")) {
      assert.match(query, /expires_at>clock_timestamp\(\)/);
      return [];
    }
    if (query.startsWith("update sports_feed.postgame_cache set lease=null"))
      return [];
    assert.fail("Unexpected write during failed roster refresh: " + query);
  }) as unknown as Sql;
  const fetcher: typeof fetch = async () => {
    fetched++;
    return new Response("source unavailable", { status: 403 });
  };
  const permit = {
    ...nflCollectionPermit("rosters"),
    expiresAt: new Date(Date.now() + 60000).toISOString(),
  };
  await assert.rejects(
    () => downloadNflDataset(sql, permit, "rosters", 2026, fetcher),
    (error: unknown) =>
      error instanceof CollectionFailure &&
      error.diagnostic === "NFL_SOURCE_HTTP_403",
  );
  assert.equal(fetched, 1);
  assert.equal(queries.length, 3);
  queries.length = 0;
  await assert.rejects(
    () =>
      downloadNflDataset(
        sql,
        { ...permit, expiresAt: "2000-01-01T00:00:00.000Z" },
        "rosters",
        2026,
        fetcher,
      ),
    /source review expired/,
  );
  assert.equal(queries.length, 0);
  assert.equal(fetched, 1);
});
