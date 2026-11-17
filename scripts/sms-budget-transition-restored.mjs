/** Network-disabled local restore only. Every change is rolled back. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const container = "docked-commercial-restore-20261117e";
const inspected = JSON.parse(
  execFileSync("docker", ["inspect", container], {
    encoding: "utf8",
    windowsHide: true,
  }),
)[0];
assert.equal(inspected.HostConfig.NetworkMode, "none");
assert.equal(Object.keys(inspected.HostConfig.PortBindings ?? {}).length, 0);
assert(inspected.HostConfig.Tmpfs?.["/restore"]);
const manifest = JSON.parse(
  readFileSync("private-data/clean-transition-20261117/manifest.private.json"),
);
assert.equal(manifest.length, 6);
for (const [kind, count] of [
  ["owner", 2],
  ["customer", 3],
  ["system", 1],
])
  assert.equal(manifest.filter((row) => row.kind === kind).length, count);
const q = (s) => "'" + s.replaceAll("'", "''") + "'";
const query = (sql) =>
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      container,
      "psql",
      "-h",
      "/restore",
      "-U",
      "postgres",
      "-X",
      "-qAt",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    { input: sql, encoding: "utf8", windowsHide: true, maxBuffer: 4e6 },
  ).trim();
const digest = () => query("select launch_transition.source_digest();");
const before = digest();
assert(query("show data_directory;").startsWith("/restore/"));
assert.equal(query("select to_regnamespace('sms_delivery') is null;"), "t");
assert.equal(query("select count(*) from launch_transition.accounts;"), "0");
const migration =
  "supabase/migrations/20261116215032_public_sms_budget_guard.sql";
const bytes = readFileSync(migration, "utf8");
let sql = `begin;
select launch_transition.prepare(${q(JSON.stringify(manifest))}::jsonb,launch_transition.source_digest(),repeat('a',64),repeat('b',64));
${bytes}
insert into sms_delivery.windows(id,enabled,starts_at,expires_at,budget_aud_cents,authority_reference,price_evidence_reference)
values('local-transition-check',true,now()-interval '1 minute',now()+interval '1 hour',5000,'Local restore rehearsal; no actual send authorised','Local fictional price reference; external network disabled');
set local role docked_app;
`;
for (const [index, row] of manifest.entries())
  sql += `select jsonb_build_object('kind',${q(row.kind)},'decision',sms_delivery.reserve('local-transition-check',${q(index.toString(16).padStart(64, "0"))},${q(row.id)}::uuid));\n`;
sql +=
  "reset role;select jsonb_build_object('reserved',reserved_aud_cents,'attempts',(select count(*) from sms_delivery.attempts)) from sms_delivery.windows;rollback;";
const rows = query(sql)
  .split("\n")
  .filter((line) => line.startsWith("{"))
  .map((line) => JSON.parse(line));
const decisions = rows.filter((row) => Object.hasOwn(row, "decision"));
assert.equal(decisions.length, 6);
for (const row of decisions)
  assert.equal(row.decision, row.kind === "owner" ? "send" : "denied");
assert.deepEqual(
  rows.find((row) => Object.hasOwn(row, "reserved")),
  { reserved: 200, attempts: 2 },
);
assert.equal(
  digest(),
  before,
  "Restored account/asset digest unchanged after rollback",
);
assert.equal(query("select to_regnamespace('sms_delivery') is null;"), "t");
assert.equal(query("select count(*) from launch_transition.accounts;"), "0");
const evidence = {
  at: new Date().toISOString(),
  environment:
    "Network-disabled authenticated Production restore; local rolled-back transaction",
  migration,
  migrationSha256: createHash("sha256").update(bytes).digest("hex"),
  callerRole: "docked_app",
  decisions,
  onlyRetainedOwnersReserved: true,
  originalSourceDigestUnchanged: true,
  temporarySchemaRemovedByRollback: true,
  productionWrites: 0,
  smsSent: 0,
};
writeFileSync(
  "docs/qa/final-public-runtime-20261117/sms-gap-after.json",
  JSON.stringify(evidence, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    passed: true,
    accounts: decisions.length,
    productionWrites: 0,
    smsSent: 0,
  }),
);
