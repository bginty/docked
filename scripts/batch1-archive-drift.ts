/** Inspect two authenticated encrypted archives in memory. No hosted connection or restored writes. */
import assert from "node:assert/strict";
import { readFileSync, createReadStream, writeFileSync } from "node:fs";
import { createDecipheriv, createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { createInterface } from "node:readline";
import { copyText } from "./lib/round-backup-compare";
const tables = [
  "cron.job",
  "cron.job_run_details",
  "private.docked_mail_scheduler",
  "sports_feed.nfl_rounds",
  "sports_feed.nfl_worker_runs",
  "sports_feed.raw_revisions",
  "sports_feed.weekly_core_job_runs",
];
const key = Buffer.from(
  readFileSync(
    process.env.USERPROFILE +
      "/.docked-secrets/launch-migration-backup-key.hex",
    "utf8",
  ).trim(),
  "hex",
);
const sha = (x: unknown) =>
  createHash("sha256").update(JSON.stringify(x)).digest("hex");
let stage = "initial";
async function archive(run: string) {
  stage = "archive " + run;
  const base = "private-data/commercial-restore-" + run + "/";
  const enc = readFileSync(base + "manifest.aes");
  const md = createDecipheriv("aes-256-gcm", key, enc.subarray(0, 12));
  md.setAuthTag(enc.subarray(12, 28));
  const manifest = JSON.parse(
    Buffer.concat([md.update(enc.subarray(28)), md.final()]).toString(),
  );
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(manifest.iv, "hex"),
  );
  decipher.setAuthTag(Buffer.from(manifest.tag, "hex"));
  const child = spawn(
    "docker",
    [
      "exec",
      "-i",
      "docked-commercial-restore-20261116b",
      "pg_restore",
      "--data-only",
      "--file=-",
      ...tables.flatMap((t) => ["--table=" + t.split(".")[1]]),
    ],
    { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
  );
  child.stderr.resume();
  const done = new Promise<void>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (c) =>
      c === 0 ? resolve() : reject(Error("Archive selection failed")),
    );
  });
  const answer: Record<string, Record<string, string | null>[]> = {};
  const consume = (async () => {
    let table: string | null = null;
    let cols: string[] = [];
    for await (const line of createInterface({
      input: child.stdout,
      crlfDelay: Infinity,
    })) {
      if (table) {
        if (line === "\\.") {
          table = null;
          continue;
        }
        const values = line.split("\t");
        assert.equal(values.length, cols.length);
        const row = Object.fromEntries(
          cols.map((c, j) => [
            c,
            ["body", "command", "return_message"].includes(c)
              ? values[j] === "\\N"
                ? null
                : "copy-sha256:" +
                  createHash("sha256").update(values[j]).digest("hex")
              : copyText(values[j]),
          ]),
        );
        if (table.endsWith("nfl_worker_runs"))
          row.__task = row.detail
            ? (JSON.parse(row.detail).task ?? null)
            : null;
        // Hash large/sensitive payload fields immediately; never retain source bodies,
        // scheduler commands or provider error text in the comparison report.
        for (const k of ["detail"])
          if (row[k] != null) row[k] = "sha256:" + sha(row[k]);
        answer[table].push(row);
        continue;
      }
      const m = line.match(/^COPY ([a-z_]+\.[a-z_]+) \((.+)\) FROM stdin;$/);
      if (!m || !tables.includes(m[1])) continue;
      assert(!answer[m[1]]);
      table = m[1];
      cols = m[2].split(", ");
      answer[table] = [];
    }
  })();
  await Promise.all([
    pipeline(
      createReadStream(base + "production.dump.aes"),
      decipher,
      child.stdin,
    ),
    done,
    consume,
  ]);
  for (const t of tables) assert(answer[t], t);
  return { at: manifest.at, tables: answer };
}
async function main() {
  const old = await archive("20261116a"),
    fresh = await archive("20261116b");
  key.fill(0);
  const result: any[] = [];
  for (const table of tables) {
    const a = old.tables[table],
      b = fresh.tables[table];
    const id =
      table === "cron.job"
        ? "jobid"
        : table === "cron.job_run_details"
          ? "runid"
          : table.endsWith("weekly_core_job_runs")
            ? "id"
            : table.endsWith("nfl_rounds")
              ? "competition_id"
              : table.endsWith("docked_mail_scheduler")
                ? "singleton"
                : "id";
    stage = "compare " + table;
    const index = new Map(b.map((r) => [r[id], r]));
    assert.equal(index.size, b.length, "Nonunique comparison key " + table);
    const oldKeys = new Set(a.map((r) => r[id]));
    const removed = [];
    const changed = [];
    for (const row of a) {
      const now = index.get(row[id]);
      if (!now) {
        removed.push(row[id]);
        continue;
      }
      const fields = [
        ...new Set([...Object.keys(row), ...Object.keys(now)]),
      ].filter((k) => row[k] !== now[k]);
      if (fields.length)
        changed.push({
          id: row[id],
          fields,
          ...(table.endsWith("raw_revisions")
            ? {
                before: Object.fromEntries(
                  fields.map((k) => [
                    k,
                    { isNull: row[k] === null, sha256: sha(row[k]) },
                  ]),
                ),
                after: Object.fromEntries(
                  fields.map((k) => [
                    k,
                    { isNull: now[k] === null, sha256: sha(now[k]) },
                  ]),
                ),
                expiryMetadata: Object.fromEntries(
                  Object.entries(now).filter(
                    ([k, v]) =>
                      /(until|expire|purged_at|fetched_at|received_at)/.test(
                        k,
                      ) &&
                      v !== null &&
                      /^\d{4}-\d\d-\d\d/.test(v!),
                  ),
                ),
              }
            : {}),
        });
    }
    const added = b.filter((r) => !oldKeys.has(r[id]));
    const details: Record<string, unknown> = {};
    if (table.endsWith("nfl_worker_runs")) {
      details.added = added.map((r) => ({
        id: r.id,
        status: r.status,
        task: r.__task,
      }));
    }
    if (table.endsWith("weekly_core_job_runs"))
      details.newOutcomes = added.reduce((o: Record<string, number>, r) => {
        const k = [r.status, r.issued, r.failures].join("/");
        o[k] = (o[k] ?? 0) + 1;
        return o;
      }, {});
    if (table === "cron.job_run_details") {
      const jobs = new Map(fresh.tables["cron.job"].map((r) => [r.jobid, r]));
      details.newStatuses = added.reduce((o: Record<string, number>, r) => {
        o[r.status ?? "null"] = (o[r.status ?? "null"] ?? 0) + 1;
        return o;
      }, {});
      details.newCommandIdentityMismatches = added.filter((r) => {
        const job = jobs.get(r.jobid);
        return (
          !job ||
          ["command", "database", "username"].some((k) => r[k] !== job[k])
        );
      }).length;
    }
    result.push({
      table,
      previousCount: a.length,
      currentCount: b.length,
      removedIds: removed,
      changed,
      addedCount: added.length,
      ...details,
    });
  }
  const report = {
    at: new Date().toISOString(),
    previousBackupAt: old.at,
    freshBackupAt: fresh.at,
    archivesGcmAuthenticated: true,
    rawSourceBodiesEmitted: false,
    productionWrites: 0,
    automaticDriftWaiver: false,
    tables: result,
  };
  writeFileSync(
    "docs/qa/batch1-controlled-20261116/archive-drift-details.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
}
main().catch((error) => {
  key.fill(0);
  console.error(
    "Archive-only drift inspection failed; no hosted write or plaintext archive",
  );
  console.error(
    JSON.stringify({
      stage,
      kind: error.name,
      detail:
        error instanceof assert.AssertionError
          ? error.message.split("\n")[0]
          : (error.code ?? "ARCHIVE_PROCESS_FAILURE"),
    }),
  );
  process.exitCode = 1;
});
