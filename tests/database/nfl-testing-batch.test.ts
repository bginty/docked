import { test } from "node:test";
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  batchSignature,
  readSignedBatch,
} from "../../src/server/nfl-testing-batch";
import {
  NflTestingStore,
  type FeedDb,
} from "../../src/server/nfl-testing-store";
import { nflTestingReport } from "../../src/server/nfl-testing-report";
import {
  dataset,
  eventPage,
  feedRaw,
  feedGameFixture,
} from "../fixtures/nfl-testing-data";
const key = "isolated-test-fixture-key-at-least-32-characters";
function signed(
  revision = 1,
  exportedAt = Date.now() / 1000,
  receptions: number | null = 2,
) {
  const raw = feedRaw("p_one", revision);
  (raw.stats as Record<string, number | null>).receptions = receptions;
  if (receptions === null)
    raw.fields.receptions = { availability: "unknown", current: false } as any;
  const page = eventPage(revision, raw);
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
      exported_at: exportedAt,
      dataset_id: dataset,
      changes: [page],
      games: { ...base, data: [feedGameFixture()] },
      players: {
        ...base,
        data: [{ id: "p_one", name: "Fixture", position: "WR" }],
      },
    }),
  );
  const timestamp = String(Math.floor(Date.now() / 1000));
  return { body, timestamp, signature: batchSignature(body, key, timestamp) };
}
function decode(s: ReturnType<typeof signed>) {
  return readSignedBatch(s.body, key, s.timestamp, s.signature, dataset);
}
test("batch HMAC, freshness, dataset, body-size and malformed archive reject before import", () => {
  const s = signed();
  assert.equal(decode(s).counts.events, 1);
  assert.throws(() =>
    readSignedBatch(s.body, key, s.timestamp, "0".repeat(64), dataset),
  );
  assert.throws(() =>
    readSignedBatch(s.body, key, "1000000000", s.signature, dataset),
  );
  assert.throws(() =>
    readSignedBatch(s.body, key, s.timestamp, s.signature, "other"),
  );
  assert.throws(() =>
    decode({ ...s, body: Buffer.concat([s.body, Buffer.from("tamper")]) }),
  );
  assert.throws(() => decode(signed(1, Date.now() / 1000 - 86401)));
  assert.throws(() => decode({ ...s, body: Buffer.alloc(2_000_001) }));
});
test("batch uses existing transactional importer; duplicates, older snapshots, corrections and missingness", async () => {
  const pg = new PGlite();
  try {
    await pg.exec(
      await readFile(
        "supabase/migrations/20261017042754_nfl_testing_feed_consumer.sql",
        "utf8",
      ),
    );
    const store = new NflTestingStore(pg as unknown as FeedDb);
    const at = Date.now() / 1000 - 10;
    const one = decode(signed(1, at));
    const generation = await store.sync(one.client, false, one.receipt);
    await store.map(
      dataset,
      "p_one",
      "fixture-docked",
      "WR",
      {
        identitySource: "synthetic",
        verifiedIdentity: "fixture",
        verifiedAt: new Date().toISOString(),
      },
      "test",
    );
    const initial = await nflTestingReport(pg as unknown as FeedDb);
    assert.equal(initial.players[0].history[0].points, 200);
    assert.equal(initial.players[0].seasons[0].points, 200);
    assert.equal(initial.players[0].seasons[0].weeks[0].points, 200);
    await pg.exec(
      "update nfl_test_feed.consumer set last_success='2026-01-01'",
    );
    assert.equal(await store.sync(one.client, false, one.receipt), generation);
    assert.equal(
      (
        await pg.query<any>(
          "select last_success='2026-01-01'::timestamptz as unchanged from nfl_test_feed.consumer",
        )
      ).rows[0].unchanged,
      true,
    );
    assert.equal(
      (
        await pg.query<any>(
          "select count(*)::int n from nfl_test_feed.audit where action='batch-imported'",
        )
      ).rows[0].n,
      1,
    );
    const corrected = decode(signed(2, at + 1, 4));
    await store.sync(corrected.client, false, corrected.receipt);
    const report = await nflTestingReport(pg as unknown as FeedDb);
    assert.equal(report.players[0].history[0].points, 400);
    assert.equal(report.players[0].seasons[0].points, 400);
    assert.equal(report.players[0].seasons[0].weeks[0].points, 400);
    await assert.rejects(
      () => store.sync(one.client, false, one.receipt),
      /OLDER_BATCH/,
    );
    const missing = decode(signed(3, at + 2, null));
    await store.sync(missing.client, false, missing.receipt);
    const incomplete = await nflTestingReport(pg as unknown as FeedDb);
    assert.equal(incomplete.players[0].history[0].points, null);
    assert.equal(
      (await pg.query<any>("select count(*)::int n from nfl_test_feed.records"))
        .rows[0].n,
      1,
    );
  } finally {
    await pg.close();
  }
});
