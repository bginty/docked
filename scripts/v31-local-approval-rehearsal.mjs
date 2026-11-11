// Network-isolated rollback-only acceptance of the exact operator SQL builder.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { readExactPackage, v31MigrationSql } from "./lib/v31-exact-package.mjs";
import { v31SchemaFingerprintSql } from "./lib/v31-schema-fingerprint.ts";
const target = "docked-commercial-restore-20261111";
const out = "docs/qa/v31-prelaunch-execution-20261111/database";
const info = JSON.parse(
  spawnSync("docker", ["inspect", target], { encoding: "utf8" }).stdout,
)[0];
assert.equal(info.HostConfig.NetworkMode, "none");
assert.equal(Object.keys(info.HostConfig.PortBindings ?? {}).length, 0);
function local(source) {
  const r = spawnSync(
    "docker",
    [
      "exec",
      "-i",
      target,
      "psql",
      "-h",
      "/restore",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-At",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    { input: source, encoding: "utf8", maxBuffer: 2e6, windowsHide: true },
  );
  if (r.status !== 0) {
    mkdirSync("private-data/v31-prelaunch-execution-20261111", {
      recursive: true,
    });
    writeFileSync(
      "private-data/v31-prelaunch-execution-20261111/atomic-rehearsal.private.log",
      r.stderr,
      { mode: 0o600 },
    );
    throw Error("Local rollback rehearsal failed; diagnostic kept private");
  }
  return r.stdout.trim();
}
const { manifest, digest } = readExactPackage();
const before = local(v31SchemaFingerprintSql);
const history = `select count(*) from supabase_migrations.schema_migrations where version in ('20261109231834','20261109232000','20261109232124','20261110005726','20261110010050')`;
assert.equal(local(history), "0");
const start = performance.now();
local(`begin;set local lock_timeout='3s';set local statement_timeout='60s';${v31MigrationSql(manifest)}
do $verify$ begin
 if (${history})<>5 then raise exception 'Five history entries required';end if;
 if exists(select 1 from private.feature_flags where key='billing_ops_alerts' and enabled) or exists(select 1 from operations.retention_policy where enabled) then raise exception 'Admission changed';end if;
end $verify$;rollback;`);
assert.equal(local(history), "0");
assert.equal(local(v31SchemaFingerprintSql), before);
const emergency = readFileSync(
  "config/operations/v31-emergency-close.prepared.sql",
  "utf8",
)
  .replace(/^begin;\r?$/m, "")
  .replace(/^commit;\r?$/m, "");
for (const missing of [false, true]) {
  local(`begin;${missing ? "alter table operations.retention_policy rename to retention_policy_temporarily_absent;" : ""}${emergency}
do $verify$ begin
 if exists(select 1 from commercial_billing.control where sales_enabled or issuance_enabled or transfers_enabled or gameplay_enabled) or exists(select 1 from private.feature_flags where key='registration' and enabled) or exists(select 1 from public_gameplay.policy where enabled) then raise exception 'Emergency controls remain open';end if;
end $verify$;rollback;`);
  assert.equal(local(v31SchemaFingerprintSql), before);
}
const report = {
  at: new Date().toISOString(),
  packageSha256: digest,
  target,
  network: "none",
  atomicPackageAndHistoryInsertion: true,
  rolledBack: true,
  historyRowsAfter: 0,
  catalogueUnchangedAfterRollback: true,
  emergencyCloseWithRetentionPresent: true,
  emergencyCloseWithRetentionAbsent: true,
  elapsedSeconds: Math.round((performance.now() - start) / 100) / 10,
  productionWrites: 0,
};
writeFileSync(
  `${out}/atomic-package-rehearsal.json`,
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
