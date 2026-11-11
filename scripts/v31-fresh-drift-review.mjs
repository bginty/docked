/** Compare the fresh encrypted Production capture to the previous rehearsal.
 * Offline except the existing local Docker pg_restore client. No hosted writes,
 * plaintext archive files, credentials, or customer rows are emitted. */
import assert from "node:assert/strict";
import { createHash, createDecipheriv } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";
const run = process.env.DOCKED_RESTORE_RUN ?? "20261111";
assert.match(run, /^20261111[a-z]?$/);
const previousDir = "private-data/commercial-restore-20261110r";
const freshDir = `private-data/commercial-restore-${run}`;
const out = "docs/qa/v31-prelaunch-execution-20261111/database";
const key = Buffer.from(
  (
    await readFile(
      `${process.env.USERPROFILE}/.docked-secrets/launch-migration-backup-key.hex`,
      "utf8",
    )
  ).trim(),
  "hex",
);
assert.equal(key.length, 32);
const hash = (v) => createHash("sha256").update(v).digest("hex");
async function manifest(dir) {
  const raw = await readFile(`${dir}/manifest.aes`);
  const d = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(12, 28));
  const value = JSON.parse(
    Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString(),
  );
  assert.equal(value.project, "pojoymtniryarxxunyvz");
  return value;
}
async function schema(dir, meta) {
  const p = spawn(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_deletion-auth-local",
      "pg_restore",
      "--schema-only",
      "--no-owner",
      "--file=-",
    ],
    { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
  );
  const parts = [];
  let errorText = "";
  p.stdout.on("data", (b) => parts.push(b));
  p.stderr.on("data", (b) => {
    errorText += b;
  });
  const completed = new Promise((resolve, reject) => {
    p.on("error", reject);
    p.on("close", resolve);
  });
  const d = createDecipheriv("aes-256-gcm", key, Buffer.from(meta.iv, "hex"));
  d.setAuthTag(Buffer.from(meta.tag, "hex"));
  let pipeError;
  try {
    await pipeline(createReadStream(`${dir}/production.dump.aes`), d, p.stdin);
  } catch (e) {
    pipeError = e;
  }
  assert.equal(await completed, 0, "Local schema extraction failed");
  // pg_restore schema-only may stop reading archive payload early. Full GCM/hash
  // authentication is proved separately by --verify-archive, not this reader.
  if (
    pipeError &&
    !["EPIPE", "EOF", "ERR_STREAM_PREMATURE_CLOSE"].includes(pipeError.code)
  )
    throw pipeError;
  assert.equal(errorText.trim(), "", "Unexpected schema extraction warning");
  return Buffer.concat(parts)
    .toString()
    .replaceAll("\r\n", "\n")
    .split("\n")
    .filter(
      (l) => !/^\\(un)?restrict /.test(l) && !/^-- Dumped (by|from) /.test(l),
    )
    .join("\n")
    .trim();
}
const normalize = (rows) =>
  rows
    .map((row) =>
      Object.fromEntries(
        Object.entries(row).sort(([a], [b]) => a.localeCompare(b)),
      ),
    )
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
try {
  const before = await manifest(previousDir);
  const after = await manifest(freshDir);
  const oldSchema = await schema(previousDir, before);
  const newSchema = await schema(freshDir, after);
  const changedTables = [];
  let sameTables = 0;
  for (const table of new Set([
    ...Object.keys(before.sums),
    ...Object.keys(after.sums),
  ])) {
    const old = before.sums[table],
      next = after.sums[table];
    if (JSON.stringify(old) === JSON.stringify(next)) sameTables++;
    else
      changedTables.push({
        table,
        previousRows: old?.count ?? null,
        currentRows: next?.count ?? null,
        previousHash: old?.hash ?? null,
        currentHash: next?.hash ?? null,
      });
  }
  const baselineManifest = JSON.parse(
    await readFile(
      "docs/qa/v31-final-reconciliation-20261110/migration-manifest.json",
      "utf8",
    ),
  );
  const migrations = [];
  for (const m of baselineManifest.migrations) {
    const actual = hash(await readFile(`supabase/migrations/${m.file}`));
    assert.equal(actual, m.sha256, "Migration bytes changed");
    migrations.push({
      file: m.file,
      sha256: actual,
      matchesPriorRehearsal: true,
    });
  }
  const permission = baselineManifest.additionalPermissionPackage;
  assert.equal(
    hash(await readFile(permission.path)),
    permission.rawSha256,
    "Outbox permission package changed",
  );
  const schemaUnchanged = oldSchema === newSchema;
  const report = {
    checkedAt: new Date().toISOString(),
    previousSnapshotAt: before.at,
    freshSnapshotAt: after.at,
    freshArchiveSha256: after.sha256,
    previousSchemaSha256: hash(oldSchema),
    freshSchemaSha256: hash(newSchema),
    schemaUnchanged,
    rolesUnchanged:
      JSON.stringify(normalize(before.roles)) ===
      JSON.stringify(normalize(after.roles)),
    membershipsUnchanged:
      JSON.stringify(normalize(before.members)) ===
      JSON.stringify(normalize(after.members)),
    unchangedTableFingerprints: sameTables,
    changedTables,
    migrations,
    permissionPackage: permission,
    fullArchiveAuthentication:
      "See matching restore archive-integrity.json; schema-only extraction alone is insufficient",
    scope:
      "Fresh repeatable-read read-only snapshot against previous encrypted snapshot; hashes/counts only",
    productionWrites: 0,
  };
  await mkdir(out, { recursive: true });
  await writeFile(
    `${out}/fresh-drift-review.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      schemaUnchanged: report.schemaUnchanged,
      rolesUnchanged: report.rolesUnchanged,
      membershipsUnchanged: report.membershipsUnchanged,
      unchangedTables: sameTables,
      changedTables: changedTables.map((t) => t.table),
      exactMigrations: migrations.length,
      productionWrites: 0,
    }),
  );
} finally {
  key.fill(0);
}
