import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { gzipSync } from "node:zlib";
import { nflPlayerHistory } from "../../src/core/nfl-player-history";
import {
  historyDatabaseTarget,
  historyReceiverEnabled,
  nflHistoryTarget,
} from "../../src/core/nfl-history-target";
import {
  batchSignature,
  readSignedBatch,
} from "../../src/server/nfl-testing-batch";
import { historyStore } from "../../src/server/nfl-history-store";
import {
  NflTestingStore,
  type FeedDb,
} from "../../src/server/nfl-testing-store";
import {
  feedRaw,
  feedGameFixture,
  eventPage,
  dataset,
} from "../fixtures/nfl-testing-data";

test("history uses approved full PPR with fumbles once, preserves incomplete/zero/stale semantics", () => {
  const raw = { ...feedRaw(), synthetic: false };
  raw.stats.passing_yards = 100;
  raw.stats.fumbles_lost = 1;
  const game = feedGameFixture();
  game.stats_state = "incomplete";
  game.freshness.stale = true;
  const h = nflPlayerHistory(
    [{ payload: raw, game_payload: game, position: "WR" }],
    undefined,
    new Date().toISOString(),
  );
  assert.equal(h.rows[0].base, 400);
  assert.equal(h.feed?.seasonBase, 400);
  assert.equal(h.feed?.stale, true);
  assert.equal(h.rows[0].rawStats?.[0].incomplete, true);
  raw.fields.receptions.current = false;
  const missing = nflPlayerHistory([
    { payload: raw, game_payload: game, position: "WR" },
  ]);
  assert.equal(missing.rows[0].base, null);
  assert.equal(missing.rows[0].rawStats?.[0].values.receptions, null);
  raw.fields.receptions.current = true;
  Object.keys(raw.stats).forEach((k) => (raw.stats[k] = 0));
  assert.equal(
    nflPlayerHistory([{ payload: raw, game_payload: game, position: "WR" }])
      .rows[0].base,
    0,
  );
  assert.equal(nflPlayerHistory([]).feed?.seasonBase, null);
  assert.equal(
    nflPlayerHistory([
      {
        payload: { ...raw, synthetic: true },
        game_payload: game,
        position: "WR",
      },
    ]).rows.length,
    0,
  );
});
test("live history target requires dedicated credentials, exact project and explicit activation", () => {
  const url = `postgres://docked_nfl_history_reader.${nflHistoryTarget.projectRef}:fixture@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres`;
  assert.equal(
    historyDatabaseTarget(url, "reader"),
    nflHistoryTarget.readerRole,
  );
  assert.throws(() => historyDatabaseTarget(url, "writer"));
  assert.throws(() =>
    historyDatabaseTarget(
      url.replace("docked_nfl_history_reader", "postgres"),
      "reader",
    ),
  );
  assert.throws(() =>
    historyDatabaseTarget(
      url.replace(nflHistoryTarget.projectRef, "bckkllmndoxzpzdqrevb"),
      "reader",
    ),
  );
  assert.equal(historyReceiverEnabled({}, nflHistoryTarget.origin), false);
  const env = {
    NFL_HISTORY_IMPORT_ENABLED: "true",
    VERCEL_ENV: "production",
    VERCEL_PROJECT_ID: nflHistoryTarget.vercelProjectId,
  };
  assert.equal(historyReceiverEnabled(env, nflHistoryTarget.origin), true);
  assert.equal(
    historyReceiverEnabled(
      { ...env, VERCEL_ENV: "preview" },
      nflHistoryTarget.origin,
    ),
    false,
  );
});
test("history roles isolate raw imports; real-only signatures, duplicate delivery and correction retain settlement sentinel", async () => {
  const pg = new PGlite();
  try {
    await pg.exec(
      "create role anon;create role authenticated;create role service_role;create schema sports_feed;create table sports_feed.settled(points int);insert into sports_feed.settled values(777);",
    );
    await pg.exec(
      await readFile(
        "supabase/migrations/20261017092746_nfl_player_history_publication.sql",
        "utf8",
      ),
    );
    await pg.exec(
      `insert into nfl_history.mappings(dataset,canonical,docked,position,evidence,reviewed_by) values('${dataset}','p_one','docked-one','WR','{}','fixture');`,
    );
    const key = "fixture-history-key-at-least-32-characters",
      audience = nflHistoryTarget.audience;
    function batch(rev: number, synthetic = false) {
      const raw = { ...feedRaw("p_one", rev), synthetic };
      raw.stats.receptions = rev * 2;
      const base = {
        schema_version: "1.0",
        dataset_id: dataset,
        feed_class: "development_testing",
        feed_mode: "postgame",
        next_after: null,
      };
      const body = gzipSync(
        JSON.stringify({
          batch_version: "docked-raw-postgame-batch-v1",
          exported_at: Date.now() / 1000 - 10 + rev,
          dataset_id: dataset,
          changes: [eventPage(rev, raw)],
          games: { ...base, data: [feedGameFixture()] },
          players: { ...base, data: [{ id: "p_one" }] },
        }),
      );
      const timestamp = String(Math.floor(Date.now() / 1000)),
        signature = batchSignature(body, key, timestamp, audience);
      return () =>
        readSignedBatch(
          body,
          key,
          timestamp,
          signature,
          dataset,
          Date.now(),
          audience,
          true,
        );
    }
    assert.throws(batch(1, true));
    await pg.exec("set role docked_nfl_history_writer");
    await assert.rejects(pg.query("select * from sports_feed.settled"));
    await assert.rejects(pg.query("delete from nfl_history.audit"));
    await assert.rejects(
      pg.query(
        "insert into nfl_history.mappings values('x','x','x','WR','{}','x',now())",
      ),
    );
    const store = new NflTestingStore(historyStore(pg as unknown as FeedDb));
    const b = batch(1)(),
      g = await store.sync(b.client, false, b.receipt);
    const first = (
      await pg.query("select last_success from nfl_history.consumer")
    ).rows;
    assert.equal(await store.sync(b.client, false, b.receipt), g);
    assert.deepEqual(
      (await pg.query("select last_success from nfl_history.consumer")).rows,
      first,
    );
    const correction = batch(2)();
    await store.sync(correction.client, false, correction.receipt);
    assert.equal(
      (
        await pg.query<{ n: number }>(
          "select count(*)::int n from nfl_history.records",
        )
      ).rows[0].n,
      1,
    );
    assert.equal(
      (
        await pg.query<{ n: number }>(
          "select (payload->'stats'->>'receptions')::int n from nfl_history.records",
        )
      ).rows[0].n,
      4,
    );
    await pg.exec("reset role;set role docked_nfl_history_reader");
    await assert.rejects(
      pg.query("update nfl_history.consumer set last_error='test'"),
    );
    await pg.exec("reset role;set role authenticated");
    await assert.rejects(pg.query("select * from nfl_history.records"));
    await pg.exec("reset role");
    assert.equal(
      (
        await pg.query<{ points: number }>(
          "select points from sports_feed.settled",
        )
      ).rows[0].points,
      777,
    );
  } finally {
    await pg.close();
  }
});
