import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  NflTestingStore,
  type FeedDb,
} from "../../src/server/nfl-testing-store";
import { NflTestingClient } from "../../src/server/nfl-testing-client";
import { reconcileTestingGame } from "../../src/server/nfl-testing-reconcile";
import { nflTestingReport } from "../../src/server/nfl-testing-report";
import { taggedFeedSql } from "../fixtures/nfl-testing-sql";
import { SportsFeedStore } from "../../src/server/sports-feed-store";
import {
  syntheticScenario,
  scenarioTimes,
} from "../../src/core/scoring-synthetic";
import {
  saveTeam,
  lockTeams,
  finalise,
  digest,
} from "../../src/core/scoring-engine";
import { nflPostgameTestRules } from "../../src/core/scoring-v1";
import {
  dataset,
  feedRaw,
  feedGameFixture,
  eventPage,
} from "../fixtures/nfl-testing-data";
async function setup() {
  const pg = new PGlite();
  await pg.exec(
    await readFile(
      "supabase/migrations/20261017042754_nfl_testing_feed_consumer.sql",
      "utf8",
    ),
  );
  return {
    pg,
    db: pg as unknown as FeedDb,
    store: new NflTestingStore(pg as unknown as FeedDb),
  };
}
test("page atomicity, lease, restart checkpoint, tombstones, conflicts and epoch replacement", async () => {
  const { pg, db, store } = await setup();
  try {
    const token = await store.lease();
    await assert.rejects(() => store.lease(), /BUSY/);
    await db.query(
      "insert into nfl_test_feed.generations(id,dataset)values('one',$1)",
      [dataset],
    );
    const raw = feedRaw();
    await assert.rejects(() =>
      store.page(token, "one", eventPage(1, raw), null, () => {
        throw Error("interrupt");
      }),
    );
    assert.equal(
      (await db.query("select count(*)::int n from nfl_test_feed.records"))
        .rows[0].n,
      0,
    );
    assert.equal(
      (await db.query("select cursor from nfl_test_feed.generations")).rows[0]
        .cursor,
      null,
    );
    await store.page(token, "one", eventPage(1, raw), null);
    await new NflTestingStore(db).page(
      token,
      "one",
      eventPage(2, raw),
      `${dataset}:1`,
    );
    assert.equal(
      (await db.query("select count(*)::int n from nfl_test_feed.outbox"))
        .rows[0].n,
      1,
    );
    await store.page(
      token,
      "one",
      eventPage(3, { ...raw, revision: 2 }, "remove"),
      `${dataset}:2`,
    );
    await store.page(token, "one", eventPage(4, raw), `${dataset}:3`);
    assert.equal(
      (await db.query("select removed from nfl_test_feed.records")).rows[0]
        .removed,
      true,
    );
    await assert.rejects(
      () =>
        store.page(
          token,
          "one",
          eventPage(
            5,
            { ...raw, revision: 2, stats: { ...raw.stats, receptions: 99 } },
            "remove",
          ),
          `${dataset}:4`,
        ),
      /CONFLICTING/,
    );
    await db.query(
      "update nfl_test_feed.consumer set active='one',lease=null,lease_until=null",
    );
    const next = "d2a5d96c-bf07-4a94-bf59-893f4fb3d432";
    let fail = false;
    const fake: typeof fetch = async (input) => {
      const u = new URL(String(input));
      if (u.pathname === "/v1/stat-changes") {
        if (u.searchParams.has("cursor"))
          return new Response("", { status: 410 });
        return Response.json({
          ...eventPage(1, raw),
          dataset_id: next,
          next_cursor: `${next}:1`,
        });
      }
      if (fail) return Response.json({ wrong: true });
      return Response.json({
        schema_version: "1.0",
        dataset_id: next,
        feed_class: "development_testing",
        feed_mode: "postgame",
        data: u.pathname === "/v1/games" ? [feedGameFixture()] : [],
        next_after: null,
      });
    };
    const client = new NflTestingClient(
      "http://localhost:8080",
      "isolated-reader-not-a-real-key",
      ["http://localhost:8080"],
      fake,
    );
    await assert.rejects(() => store.sync(client), /RESYNC/);
    fail = true;
    await assert.rejects(() => store.sync(client, true));
    assert.equal(
      (await db.query("select active from nfl_test_feed.consumer")).rows[0]
        .active,
      "one",
    );
    fail = false;
    const generation = await store.sync(client, true);
    assert.notEqual(generation, "one");
    assert.equal(
      (
        await db.query(
          "select revision from nfl_test_feed.records where generation=$1",
          [generation],
        )
      ).rows[0].revision,
      1,
    );
    await pg.exec("create role anon;set role anon");
    await assert.rejects(
      () => db.query("select * from nfl_test_feed.records"),
      /permission/,
    );
    await pg.exec("reset role");
  } finally {
    await pg.close();
  }
});
test("whole fixture uses existing journal; corrections, pending, frozen teams and reviewer gates", async () => {
  const { pg, db, store } = await setup();
  try {
    await pg.exec(await readFile("sandbox/sports-feed.sql", "utf8"));
    const sql = taggedFeedSql(db),
      journal = new SportsFeedStore(sql),
      fixture = syntheticScenario("nfl");
    const initial = fixture.state;
    initial.scope = "authorised-free-beta";
    initial.period.id = "beta-real:qa:feed:unit";
    initial.period.rules = nflPostgameTestRules();
    await journal.create(initial);
    const catalog = fixture.catalog.filter((c) => c.owner === "amber");
    // Reduce only local fixture's declared player pool to this test lineup.
    // The period was created with both teams; all required observations follow.
    await journal.change(initial.period.id, (s) =>
      saveTeam(
        s,
        "amber",
        "Frozen test team",
        catalog.map((c) => c.cardId),
        fixture.catalog,
        scenarioTimes.save,
      ),
    );
    await journal.change(initial.period.id, (s) =>
      lockTeams(s, fixture.catalog, scenarioTimes.lock),
    );
    const before = (
      await db.query(
        "select body from sports_feed.journal order by revision desc limit 1",
      )
    ).rows[0].body;
    const token = await store.lease();
    await db.query(
      "insert into nfl_test_feed.generations(id,dataset)values('one',$1)",
      [dataset],
    );
    let seq = 0;
    for (const c of fixture.catalog) {
      const raw = feedRaw(c.playerId);
      await store.page(
        token,
        "one",
        eventPage(++seq, raw),
        seq === 1 ? null : `${dataset}:${seq - 1}`,
      );
      await store.map(
        dataset,
        c.playerId,
        c.playerId,
        c.position,
        {
          identitySource: "isolated stable identity fixture",
          verifiedIdentity: c.playerId,
          verifiedAt: scenarioTimes.created,
        },
        "test reviewer",
      );
    }
    const game = feedGameFixture();
    await db.query("insert into nfl_test_feed.games values('one','g_one',$1)", [
      JSON.stringify(game),
    ]);
    await db.query(
      "update nfl_test_feed.consumer set active='one',lease=null,lease_until=null",
    );
    await db.query(
      "insert into nfl_test_feed.fixtures values($1,'g_one',$2,$3,2026,'REG',1,'{}')",
      [dataset, initial.period.id, initial.period.fixtures[0].id],
    );
    const approval = {
      provider: "nflverse",
      enabled: true,
      scope: "isolated-free-beta",
      automatedDownload: true,
      fantasyUse: true,
      storage: true,
      derivedUse: true,
      evidence: "https://example.invalid/local-test",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      rawRetentionDays: 30,
    };
    const actor = { id: "local-importer", role: "importer" as const };
    assert.equal(
      (await reconcileTestingGame(db, sql, "one", "g_one", actor, approval))
        .status,
      "applied",
    );
    const get = async () =>
      (
        await db.query(
          "select * from sports_feed.journal order by revision desc limit 1",
        )
      ).rows[0];
    let current = await get();
    const firstRev = current.revision;
    assert.equal(current.calculated.rows[0].centipoints, 1400);
    await db.query(
      "update nfl_test_feed.consumer set last_error='Metadata fetch failed'",
    );
    const staleReport = await nflTestingReport(db);
    assert.equal(staleReport.players[0].seasons[0].points, null);
    assert.equal(staleReport.players[0].history[0].retainedPoints, 200);
    await assert.rejects(
      () => reconcileTestingGame(db, sql, "one", "g_one", actor, approval),
      /metadata reconciliation required/,
    );
    assert.equal((await get()).revision, firstRev);
    await db.query("update nfl_test_feed.consumer set last_error=null");
    await reconcileTestingGame(db, sql, "one", "g_one", actor, approval);
    assert.equal((await get()).revision, firstRev);
    // Corrected real input shape, downward and upward; no ownership lookup.
    let lease = await store.lease();
    const changed = feedRaw(catalog[0].playerId, 2);
    changed.stats.receptions = 5;
    await store.page(
      lease,
      "one",
      eventPage(++seq, changed),
      `${dataset}:${seq - 1}`,
    );
    await db.query(
      "update nfl_test_feed.consumer set lease=null,lease_until=null",
    );
    await reconcileTestingGame(db, sql, "one", "g_one", actor, approval);
    current = await get();
    assert.equal(current.calculated.rows[0].centipoints, 1700);
    const down = {
      ...changed,
      revision: 3,
      stats: { ...changed.stats, receptions: 1 },
    };
    lease = await store.lease();
    await store.page(
      lease,
      "one",
      eventPage(++seq, down),
      `${dataset}:${seq - 1}`,
    );
    await db.query(
      "update nfl_test_feed.consumer set lease=null,lease_until=null",
    );
    await reconcileTestingGame(db, sql, "one", "g_one", actor, approval);
    assert.equal((await get()).calculated.rows[0].centipoints, 1300);
    await journal.change(initial.period.id, (s) =>
      finalise(
        s,
        { id: "reviewer", role: "reviewer" },
        new Date(Date.now() + 97 * 3600000).toISOString(),
      ),
    );
    lease = await store.lease();
    await store.page(
      lease,
      "one",
      eventPage(++seq, { ...down, revision: 4, removed: true }, "remove"),
      `${dataset}:${seq - 1}`,
    );
    await db.query(
      "update nfl_test_feed.consumer set lease=null,lease_until=null",
    );
    assert.equal(
      (await reconcileTestingGame(db, sql, "one", "g_one", actor, approval))
        .status,
      "review",
    );
    assert.equal((await get()).body.finalisedAt !== null, true);
    assert.equal(
      (
        await reconcileTestingGame(
          db,
          sql,
          "one",
          "g_one",
          { id: "reviewer", role: "reviewer" },
          approval,
          "Reviewed upstream removal of player statistic",
        )
      ).status,
      "applied",
    );
    current = await get();
    assert.equal(current.body.finalisedAt, null);
    assert.equal(current.calculated.rows[0].centipoints, null);
    assert.equal(digest(current.body.entries), digest(before.entries));
    const report = await nflTestingReport(db);
    assert.equal(
      report.players.find((p) => p.id === catalog[0].playerId),
      undefined,
    );
    // A game-wide gap suppresses competition readiness even if a player is complete.
    await db.query("update nfl_test_feed.games set payload=$1", [
      JSON.stringify({ ...game, stats_state: "incomplete", usable: false }),
    ]);
    await reconcileTestingGame(db, sql, "one", "g_one", actor, approval);
    assert.equal((await get()).calculated.rows[0].centipoints, null);
  } finally {
    await pg.close();
  }
});
