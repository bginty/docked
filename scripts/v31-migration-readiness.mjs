/** Offline review of exact migration bytes and redacted read-only catalog evidence.
 * Does not connect to Production, apply SQL, decrypt the database archive or send mail.
 */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createDecipheriv, createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const out = "docs/qa/v31-operational-acceptance-20261110";
const prior = "docs/qa/v31-final-reconciliation-20261110";
const read = (file) => JSON.parse(readFileSync(file, "utf8"));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const manifest = read(`${prior}/migration-manifest.json`);
const restore = read(`${prior}/restore/restore-drill.json`);
assert.equal(restore.restored, true);
assert.equal(restore.protectedRecordsUnchanged, true);
assert.equal(restore.migrationsReapplied, true);
assert.equal(restore.protectedTables.length, 550);
const live = read(
  "private-data/v31-operational-readiness/live-dependencies.json",
);
// Only the encrypted backup manifest is opened, in memory. No keys/rows printed.
const key = Buffer.from(
  readFileSync(
    join(
      process.env.USERPROFILE,
      ".docked-secrets/launch-migration-backup-key.hex",
    ),
    "utf8",
  ).trim(),
  "hex",
);
const raw = readFileSync(
  "private-data/commercial-restore-20261110r/manifest.aes",
);
const cipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
cipher.setAuthTag(raw.subarray(12, 28));
const backup = JSON.parse(
  Buffer.concat([cipher.update(raw.subarray(28)), cipher.final()]).toString(),
);
key.fill(0);
assert.equal(backup.project, "pojoymtniryarxxunyvz");
const normal = (rows) =>
  (rows ?? [])
    .map((row) =>
      Object.fromEntries(
        Object.entries(row).sort(([a], [b]) => a.localeCompare(b)),
      ),
    )
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
const baselineSum = (table) =>
  backup.sums[`"${table.split(".")[0]}"."${table.split(".")[1]}"`] ??
  backup.sums[table];
assert.deepEqual(
  live.migrationHistory,
  baselineSum("supabase_migrations.schema_migrations"),
  "Applied migration history drift",
);
assert.deepEqual(live.cronJobs, baselineSum("cron.job"), "Scheduled job drift");
assert.deepEqual(
  normal(live.roles),
  normal(backup.roles),
  "Database role drift",
);
assert.deepEqual(
  normal(live.memberships),
  normal(backup.members),
  "Database role membership drift",
);
const migrations = manifest.migrations.map((item) => {
  const file = `supabase/migrations/${item.file}`;
  const bytes = readFileSync(file);
  assert.equal(hash(bytes), item.sha256, file);
  assert.equal(
    restore.migrations.find((m) => m.file === item.file)?.sha256,
    item.sha256,
  );
  assert.equal(
    hash(execFileSync("git", ["show", `8acae031:${file}`])),
    item.sha256,
  );
  return { ...item, matchesRehearsal: true, matchesCommittedBaseline: true };
});
const packagePath = manifest.additionalPermissionPackage.path;
const packageBytes = readFileSync(packagePath);
assert.equal(
  hash(packageBytes),
  manifest.additionalPermissionPackage.rawSha256,
);
assert.equal(
  hash(packageBytes.toString().replaceAll("\r\n", "\n")),
  manifest.additionalPermissionPackage.lfSha256,
);
const dependencyPaths = [
  "supabase/migrations",
  "config/operations/billing-ops-outbox-v2.prepared.sql",
  "package.json",
  "package-lock.json",
];
const diff = execFileSync(
  "git",
  ["diff", "--name-only", "8acae031", "--", ...dependencyPaths],
  { encoding: "utf8" },
).trim();
assert.equal(diff, "", "Migration source/dependency files changed");
const report = {
  checkedAt: new Date().toISOString(),
  baselineCommit: "8acae031002a45b0bee0c85550c808b5e8864e7d",
  migrations,
  permissionPackage: manifest.additionalPermissionPackage,
  priorRehearsal: {
    completedAt: restore.at,
    backupAt: restore.backupAt,
    postgres: restore.postgres,
    applications: manifest.applications,
    protectedTables: restore.protectedTables.length,
    unchanged: restore.protectedRecordsUnchanged,
  },
  liveReadOnly: {
    at: live.at,
    migrationHistoryUnchanged: true,
    cronDefinitionsUnchanged: true,
    scheduledJobs: live.cronJobs.count,
    databaseRolesUnchanged: true,
    roleMembershipsUnchanged: true,
  },
  migrationDependencyFilesUnchanged: true,
  newMigrationApplications: 0,
  rehearsalReused: true,
  reason:
    "Exact five SQL files, permission package and repository dependency files unchanged; live migration history, role metadata and schedules match encrypted rehearsal manifest.",
  limitation:
    "This does not compare every live object definition or repeat all 550 table fingerprints. A fresh consistent backup, complete schema/role/data drift review and isolated restore remain mandatory immediately before a separately approved Production application.",
  productionWrites: 0,
  passed: true,
};
writeFileSync(
  `${out}/migration-verification.json`,
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    passed: true,
    exactMigrations: migrations.length,
    rolesAndMigrationHistoryUnchanged: true,
    protectedTablesPreviouslyRehearsed: restore.protectedTables.length,
    rerunApplications: 0,
    productionWrites: 0,
  }),
);
