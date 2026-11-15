/** Read-only completion of the recorded final fixture-audit comparison. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  namedTesterDirectory,
  namedTesterMigration,
  namedTesterId,
} from "./lib/named-tester-plan";
import { verifyNamedTesterFixtureAudit } from "./lib/named-tester-fixture-audit";
import { digest } from "../src/core/scoring-engine";
const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const target = "docked-commercial-restore-20261115l";
const container = JSON.parse(
  execFileSync("docker", ["inspect", target], { windowsHide: true }).toString(),
)[0];
assert.equal(container.HostConfig.NetworkMode, "none");
assert.equal(Object.keys(container.HostConfig.PortBindings ?? {}).length, 0);
const progress = read(namedTesterDirectory + "rehearsal-progress.json");
const backup = read(
  "docs/qa/v31-prelaunch-execution-20261111/database/restore-20261115l/restore-only.json",
);
const baseline = read(
  "private-data/brenton-private-tester-20261115/protected-baseline.private.json",
);
const comparison = read(
  "private-data/brenton-private-tester-20261115/preservation-result.private.json",
);
assert.equal(progress.restoreTarget, target);
assert.equal(backup.restored, true);
assert.equal(backup.protectedRecordsUnchanged, true);
assert.deepEqual(comparison.unexpected, ["beta_packs.events"]);
assert.equal(progress.completedChecks.length, 8);
const migrationSha256 = createHash("sha256")
  .update(readFileSync(namedTesterMigration))
  .digest("hex");
assert.equal(migrationSha256, progress.migrationSha256);
const values = (sql: string) =>
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      target,
      "psql",
      "-X",
      "-q",
      "-h",
      "/restore",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
    ],
    {
      input: "begin read only;" + sql + ";commit;",
      windowsHide: true,
      maxBuffer: 8e6,
    },
  )
    .toString()
    .split(/\r?\n/)
    .filter((l) => l.startsWith("{") || l.startsWith("["))
    .map((l) => JSON.parse(l));
const fixture = verifyNamedTesterFixtureAudit(values, baseline.protectedBefore);
const auditAfter = values(
  `select coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]') from beta_private.admission_events e join beta_private.admissions a on a.id=e.admission_id where a.user_id='${namedTesterId}'::uuid`,
)[0];
const originalIds = new Set(baseline.originalAudit.map((e: any) => e.id));
assert.equal(
  digest(auditAfter.filter((e: any) => originalIds.has(e.id))),
  digest(baseline.originalAudit),
);
const checks = [
  ...progress.completedChecks,
  "All original member audit, unrelated records, balances, cards and custody preserved; one exact local control audit verified separately",
];
const report = {
  at: new Date().toISOString(),
  passed: true,
  productionWrites: 0,
  network: "none",
  publishedPorts: 0,
  backupAt: backup.backupAt,
  sourceArchiveSha256: backup.archiveSha256,
  migrationSha256,
  originalTables: baseline.protectedBefore.filter((r: any) => r.table).length,
  originalDataPreservedByMigration: true,
  unrelatedRecordsPreserved: true,
  creditGrantAndPackTestRolledBack: true,
  hostedLoginOrConsentClaimed: false,
  initialCommandExitCode: 1,
  completion:
    "Read-only verification of the sole expected fixture audit after completed full record comparison; see rehearsal-progress.json",
  fixture,
  checks,
};
writeFileSync(
  namedTesterDirectory + "restored-acceptance.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    passed: true,
    checks: checks.length,
    readOnlyCompletion: true,
    productionWrites: 0,
  }),
);
