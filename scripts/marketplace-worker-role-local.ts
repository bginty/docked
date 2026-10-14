import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import postgres from "postgres";
import { randomBytes } from "node:crypto";
import { runNflCollection as sourceWorker } from "../src/server/nfl-collection-worker";
async function main() {
  const bundle = process.argv.includes("--bundle");
  const runNflCollection = bundle
    ? (await import("../supabase/functions/nfl-postgame/worker.mjs"))
        .runNflCollection
    : sourceWorker;
  const cfg = JSON.parse(
    readFileSync("tmp/marketplace-integrated-v2/status.private.json", "utf8"),
  );
  const url = new URL(cfg.DB_URL);
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.port, "55322");
  const sql = postgres(url.href, { max: 1, onnotice: () => {} });
  const password = randomBytes(24).toString("hex");
  await sql.unsafe(`alter role docked_nfl_worker login password '${password}'`);
  url.username = "docked_nfl_worker";
  url.password = password;
  const worker = postgres(url.href, { max: 3, onnotice: () => {} });
  const receipt = JSON.parse(
    readFileSync(
      "docs/qa/marketplace-authenticated/integrated-scoring.json",
      "utf8",
    ),
  );
  try {
    assert.equal(
      (await worker`select current_user role`)[0].role,
      "docked_nfl_worker",
    );
    const before =
      await sql`select stream_id,count(*)::int n from sports_feed.journal where stream_id=any(${receipt.streams}) group by stream_id order by stream_id`;
    const runs = [];
    for (const cid of receipt.rounds) {
      await sql`update sports_feed.nfl_rounds set next_check=clock_timestamp(),lease_until=null where competition_id=${cid}`;
      const result = await runNflCollection(worker, "reconcile", 2026);
      assert.equal(result.status, "reconciled", JSON.stringify(result));
      runs.push(result);
    }
    assert.deepEqual(
      await sql`select stream_id,count(*)::int n from sports_feed.journal where stream_id=any(${receipt.streams}) group by stream_id order by stream_id`,
      before,
    );
    writeFileSync(
      bundle
        ? "docs/qa/marketplace-authenticated/worker-bundle.json"
        : "docs/qa/marketplace-authenticated/worker-role.json",
      JSON.stringify(
        {
          passed: true,
          at: new Date().toISOString(),
          role: "docked_nfl_worker",
          scope:
            "Actual local role and worker; retained synthetic acceptance; no downloads",
          runs,
          duplicateScoring: false,
        },
        null,
        2,
      ),
    );
    console.log(
      "PASS: restricted worker role, retained source reconciliation, no duplicate scoring",
    );
  } finally {
    await sql.end();
    await worker.end();
  }
}
main().catch((e) => {
  console.error({ error: e.message });
  process.exitCode = 1;
});
