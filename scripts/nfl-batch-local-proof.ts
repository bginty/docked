// No listening socket, upstream request or hosted credential: real-data transport proof.
import { spawnSync } from "node:child_process";
import { randomBytes, createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readSignedBatch } from "../src/server/nfl-testing-batch";
import { NflTestingStore, type FeedDb } from "../src/server/nfl-testing-store";
import { nflTestingReport } from "../src/server/nfl-testing-report";
import { nflPostgameWeights } from "../src/core/nfl-postgame-policy";

async function main() {
  const source = resolve("../docked-nfl-ingestion"),
    dbfile = resolve(source, "data/nflverse.sqlite");
  const snapshot = "private-data/nfl-roster-audit/snapshot-1792214552985.json";
  const hash = async (path: string) =>
    createHash("sha256")
      .update(await readFile(path))
      .digest("hex");
  const before = await hash(dbfile),
    recoveryBefore = await hash(snapshot);
  const work = resolve(`private-data/nfl-batch-${Date.now()}`);
  await mkdir(work, { recursive: true });
  const key = randomBytes(32).toString("hex");
  const python =
    process.argv.find((a) => a.startsWith("--python="))?.slice(9) ?? "python";
  const output = resolve(work, "batch.gz");
  const run = spawnSync(
    python,
    [
      "deployment/nfl-batch/export.py",
      "--source",
      source,
      "--database",
      dbfile,
      "--output",
      output,
      "--quiescent-snapshot",
    ],
    {
      env: { ...process.env, NFL_BATCH_KEY: key },
      windowsHide: true,
      encoding: "utf8",
      timeout: 60000,
    },
  );
  if (run.status !== 0) throw Error("Separate service batch export failed");
  const exported = JSON.parse(run.stdout);
  const auth = JSON.parse(
    await readFile(resolve(work, "batch.auth.json"), "utf8"),
  );
  const mappings = JSON.parse(
    await readFile(
      "docs/qa/nfl-roster-reconciliation/reviewed-feed-mappings.json",
      "utf8",
    ),
  );
  const batch = readSignedBatch(
    await readFile(output),
    key,
    auth.timestamp,
    auth.signature,
    mappings.dataset,
  );
  const pg = new PGlite();
  const db = pg as unknown as FeedDb;
  try {
    await pg.exec(
      await readFile(
        "supabase/migrations/20261017042754_nfl_testing_feed_consumer.sql",
        "utf8",
      ),
    );
    const store = new NflTestingStore(db);
    const generation = await store.sync(batch.client, false, batch.receipt);
    for (const m of mappings.players)
      await store.map(
        mappings.dataset,
        m.canonical,
        m.docked,
        m.position,
        m.evidence,
        mappings.reviewer,
      );
    const report = await nflTestingReport(db);
    const sample = report.players.find((p) =>
      p.history.some((h) => h.points !== null),
    )!;
    const game = sample.history.find((h) => h.points !== null)!;
    const raw = (
      await db.query(
        "select payload from nfl_test_feed.records where generation=$1 and player=$2 and game=$3",
        [generation, sample.id, game.game],
      )
    ).rows[0].payload;
    const expected =
      Math.round(
        Object.entries(nflPostgameWeights).reduce(
          (sum, [field, weight]) => sum + raw.stats[field] * weight,
          0,
        ) * 100,
      ) / 100;
    assert.equal(game.points, expected);
    await store.sync(batch.client, false, batch.receipt);
    assert.deepEqual(await nflTestingReport(db), report);
    assert.equal(await hash(dbfile), before);
    assert.equal(await hash(snapshot), recoveryBefore);
    const receipt = {
      at: new Date().toISOString(),
      transport: "signed gzip batch; no API listener",
      ...exported,
      rawRecords: report.rawRecords,
      incompleteGames: report.incompleteGames,
      reviewedMappings: mappings.players.length,
      sample: {
        player: sample.id,
        game: game.game,
        expected: expected / 100,
        actual: game.points! / 100,
      },
      duplicateUnchanged: true,
      sourceUnchanged: true,
      recoveryUnchanged: true,
      scoringVersion: report.version,
      hostedTest: false,
    };
    await mkdir("docs/qa/nfl-batch", { recursive: true });
    await writeFile(
      "docs/qa/nfl-batch/local-proof.json",
      JSON.stringify(receipt, null, 2) + "\n",
    );
    console.log(JSON.stringify(receipt));
  } finally {
    await pg.close();
  }
}
main().catch((error) => {
  // This harness uses only generated ephemeral keys and a local PGlite database.
  // Assertion/error codes provide useful evidence without printing environment/body.
  console.error(
    "Local batch proof failed",
    error instanceof Error ? error.message : "Unknown failure",
  );
  process.exitCode = 1;
});
