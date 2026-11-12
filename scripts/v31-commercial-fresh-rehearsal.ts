/** Only the fresh disconnected restore; never a hosted database. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes, createHash, createHmac, pbkdf2Sync } from "node:crypto";
import {
  packet,
  blob,
  readJson,
  evidence,
  writeEvidence,
  sourceCommit,
  packageSha256,
} from "./lib/v31-commercial-approval.mjs";
import { v31SchemaFingerprintSql } from "./lib/v31-schema-fingerprint";
import { tableListQuery, checksumQuery } from "./lib/reviewed-inventory";
const p = packet(),
  restored = readJson(evidence + "/fresh-restore/restore-only.json");
assert.equal(restored.restored, true);
assert.equal(restored.protectedRecordsUnchanged, true);
assert.equal(restored.restoreTarget, "docked-commercial-restore-20261113a");
const target = restored.restoreTarget;
const configuration = JSON.parse(
  execFileSync("docker", ["inspect", target], {
    windowsHide: true,
    maxBuffer: 1e6,
  }).toString(),
)[0];
assert.equal(configuration.HostConfig.NetworkMode, "none");
assert.equal(
  Object.keys(configuration.HostConfig.PortBindings ?? {}).length,
  0,
);
function local(query: string) {
  return execFileSync(
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
      "-v",
      "ON_ERROR_STOP=1",
      "-Atq",
    ],
    { input: query, windowsHide: true, maxBuffer: 16e6 },
  )
    .toString()
    .trim();
}
assert.equal(
  local("select rolsuper from pg_roles where rolname=current_user"),
  "f",
);
assert.equal(local("select current_setting('cron.launch_active_jobs')"), "off");
const before = JSON.parse(
  local("select row_to_json(q) from (" + v31SchemaFingerprintSql + ")q"),
);
const tables = JSON.parse(local(tableListQuery)) as string[];
const sumSql = tables.map(checksumQuery).join(" union all ");
const beforeSums = local(sumSql);
// Parallel Append may return UNION ALL rows in any order. Compare by table.
const normalise = (text: string) =>
  text
    .split(/\r?\n/)
    .map((line) => JSON.parse(line))
    .sort((a, b) => a.table.localeCompare(b.table));
const salt = randomBytes(16),
  password = randomBytes(32).toString("hex"),
  salted = pbkdf2Sync(password, salt, 4096, 32, "sha256");
const client = createHmac("sha256", salted).update("Client Key").digest(),
  stored = createHash("sha256").update(client).digest("base64"),
  server = createHmac("sha256", salted).update("Server Key").digest("base64");
const scram =
  "SCRAM-SHA-256$4096:" + salt.toString("base64") + "$" + stored + ":" + server;
const query =
  "begin;set local lock_timeout='3s';set local statement_timeout='60s';\n" +
  p.productionMigrations.map((f: any) => blob(f.file).toString()).join("\n") +
  "\n" +
  blob(p.dormantRoleProposal.file).toString() +
  "\nalter role docked_commercial_runtime login password '" +
  scram +
  "';\n" +
  `
do $$begin
 if not exists(select 1 from pg_roles where rolname='docked_commercial_runtime' and rolcanlogin and rolinherit and rolconnlimit=6 and not rolsuper and not rolbypassrls and not rolcreaterole and not rolcreatedb and not rolreplication) then raise exception 'Runtime role mismatch';end if;
 if has_table_privilege('docked_commercial_runtime','private.outbox','select,insert,update,delete') or has_table_privilege('docked_commercial_runtime','auth.users','select,insert,update,delete') then raise exception 'Unexpected access';end if;
 if not exists(select 1 from pg_auth_members where roleid='docked_commercial_app'::regrole and member='docked_commercial_runtime'::regrole and inherit_option and not admin_option and not set_option)then raise exception 'Membership mismatch';end if;
end$$;
` +
  sumSql +
  ";\nrollback;";
const output = local(query);
assert.deepEqual(
  normalise(output),
  normalise(beforeSums),
  "Local DDL/runtime provisioning changed data",
);
assert.deepEqual(
  JSON.parse(
    local("select row_to_json(q) from (" + v31SchemaFingerprintSql + ")q"),
  ),
  before,
);
assert.equal(
  local(
    "select count(*) from pg_roles where rolname='docked_commercial_runtime'",
  ),
  "0",
);
assert.deepEqual(normalise(local(sumSql)), normalise(beforeSums));
salted.fill(0);
client.fill(0);
const report = {
  at: new Date().toISOString(),
  sourceCommit,
  packageSha256,
  archiveSha256: restored.archiveSha256,
  target,
  network: "none",
  operatorSuperuser: false,
  exactMigrationsAndRole: true,
  initialScramLoginRehearsed: true,
  protectedTablesUnchanged: tables.length,
  outboxAndAuthDenied: true,
  roleMembershipRestricted: true,
  rollbackVerified: true,
  productionWrites: 0,
};
writeEvidence("fresh-runtime-ddl-rehearsal.json", report);
console.log(JSON.stringify(report));
