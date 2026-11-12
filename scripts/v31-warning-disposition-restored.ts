/** Transaction-rollback rehearsal against the existing disconnected restore. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { digest } from "../src/core/scoring-engine";
import { historicalWarningSql } from "./lib/historical-warning-disposition";
import { checksumQuery, tableListQuery } from "./lib/reviewed-inventory";
import { historicalWarningPackage } from "./v31-historical-warning-operator";
const target = "docked-commercial-restore-20261112d";
function docker(args: string[], input?: string) {
  return execFileSync("docker", args, {
    input,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
    stdio: ["pipe", "pipe", "pipe"],
  });
}
function sql(query: string) {
  return docker(
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
    query,
  )
    .split("\n")
    .filter((l) => l.startsWith("{") || l.startsWith("["))
    .map((l) => JSON.parse(l));
}
function capture() {
  const [tables] = sql(tableListQuery);
  return sql(
    `begin isolation level repeatable read read only;${tables.map(checksumQuery).join(";\n")};commit;`,
  );
}
function main() {
  assert.equal(process.argv[2], "--isolated-restored");
  const [i] = JSON.parse(docker(["inspect", target]));
  assert.equal(i.HostConfig.NetworkMode, "none");
  assert.equal(i.State.Running, true);
  assert(
    Object.values(i.NetworkSettings.Ports ?? {}).every(
      (p) => !p || (Array.isArray(p) && p.length === 0),
    ),
  );
  const before = capture(),
    pkg = historicalWarningPackage();
  const rows = JSON.parse(
    readFileSync(
      "private-data/v31-revenue-launch-20261113/historical-notifications.private.json",
      "utf8",
    ),
  ).rows;
  const correction = historicalWarningSql({
    rows,
    approvalReference:
      "ISOLATED RESTORED ROLLBACK TEST ONLY — NO PRODUCTION AUTHORITY",
    packageSha256: pkg.packageSha256,
    manifestSha256: pkg.manifestSha256,
    evidenceSha256: "0".repeat(64),
  });
  const [during] = sql(`begin;${correction}
 select jsonb_build_object('done',(select count(*) from credits_sandbox.store_notifications where id=any(array[${rows.map((r: any) => "'" + r.id.replaceAll("'", "''") + "'").join(",")}]) and state='done'),
 'operatorAudit',(select count(*) from private.audit_events where actor='operator:codex' and action='historical-google-test-externally-reconciled'),
 'preservedHoldEvidence',(select count(*) from private.audit_events where action='historical-google-test-externally-reconciled' and details->>'originalPreviewRecoveryHoldCredits'='5700' and details->>'recoveryHoldWaived'='false'));rollback;`);
  assert.equal(during.done, 7);
  assert.equal(during.operatorAudit, 1);
  assert.equal(during.preservedHoldEvidence, 1);
  const after = capture();
  assert.deepEqual(after, before);
  const report = {
    at: new Date().toISOString(),
    target,
    network: "none",
    mode: "isolated rollback rehearsal",
    packageSha256: pkg.packageSha256,
    targetRows: 7,
    during,
    protectedTablesUnchanged: after.length,
    allTableDigest: digest(after),
    productionWrites: 0,
    localCommittedWrites: 0,
    providerCalls: 0,
  };
  writeFileSync(
    "docs/qa/v31-revenue-launch-20261113/warning-restored.json",
    JSON.stringify(report, null, 2) + "\n",
    { flag: "wx" },
  );
  console.log(JSON.stringify(report));
}
try {
  main();
} catch (error) {
  writeFileSync(
    "private-data/v31-revenue-launch-20261113/warning-rehearsal-error.private.txt",
    String(error),
  );
  console.error(
    "Isolated warning rehearsal failed; private diagnostic saved. No Production connection.",
  );
  process.exitCode = 1;
}
