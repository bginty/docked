// Executes only inside the task-owned restored snapshot, never hosted.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { sha256, v31MigrationSql } from "./lib/v31-exact-package.mjs";
import { v31SchemaFingerprintSql } from "./lib/v31-schema-fingerprint.ts";
const out =
  "docs/qa/v31-prelaunch-execution-20261111/database/retention-role-correction";
const restored = JSON.parse(
  readFileSync(out + "/full-restore/restore-drill.json", "utf8"),
);
assert(
  restored.restored &&
    restored.protectedRecordsUnchanged &&
    restored.operatorSuperuser === false,
);
const target = restored.restoreTarget;
assert.match(
  target,
  /^docked-commercial-restore-20261111-attempt-[1-9][0-9]*$/,
);
const run = (args, input) =>
  spawnSync("docker", args, {
    input,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 4e6,
  });
const inspect = JSON.parse(run(["inspect", target]).stdout)[0];
assert.equal(inspect.HostConfig.NetworkMode, "none");
assert.equal(Object.keys(inspect.HostConfig.PortBindings ?? {}).length, 0);
function local(input) {
  const r = run(
    [
      "exec",
      "-i",
      target,
      "psql",
      "-X",
      "-qAt",
      "-v",
      "ON_ERROR_STOP=1",
      "-h",
      "/restore",
      "-U",
      "postgres",
      "-d",
      "postgres",
    ],
    input,
  );
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
}
assert.equal(
  local("select rolsuper from pg_roles where rolname=current_user"),
  "f",
);
assert.equal(
  local("select to_regprocedure('private.billing_ops_window()')is null"),
  "t",
);
const files = restored.migrations.map((m) => ({
  kind: "migration",
  path: "supabase/migrations/" + m.file,
  sha256: m.sha256,
  version: m.file.slice(0, 14),
  name: m.file.slice(15, -4),
}));
const path = "config/operations/billing-ops-outbox-v2.prepared.sql";
const outboxHash = sha256(readFileSync(path));
assert.equal(
  outboxHash,
  "59dffc74f3f9a354366bedc994136264fb1922201a6c33f40864777b2546cf09",
);
files.push({ kind: "outbox", path, sha256: outboxHash });
const fingerprint = () => local(v31SchemaFingerprintSql);
const before = fingerprint();
const result = JSON.parse(
  local(
    "begin;set local lock_timeout='3s';set local statement_timeout='60s';" +
      v31MigrationSql({ files }) +
      `
 select jsonb_build_object('historyRows',(select count(*)from supabase_migrations.schema_migrations where version in('20261109231834','20261109232000','20261109232124','20261110005726','20261110010050')),
 'retentionDisabled',(select not enabled from operations.retention_policy),'outboxDisabled',not private.billing_ops_window(),
 'creatorSet',pg_has_role('postgres','docked_incident_retention','SET'),'creatorInherit',pg_has_role('postgres','docked_incident_retention','USAGE'),
 'runtimePruneAccess',exists(select 1 from unnest(array['anon','authenticated','service_role','docked_app','docked_beta_app','docked_commercial_app'])r where pg_has_role(r,'docked_incident_retention','SET')or has_function_privilege(r,'operations.prune_routine(int)','execute')),
 'retentionSchemaCreate',has_schema_privilege('docked_incident_retention','operations','CREATE'),
 'phoneIndexValid',(select indisvalid and indisunique from pg_index where indexrelid='private.docked_verified_phone_canonical'::regclass),
 'phoneTriggerEnabled',exists(select 1 from pg_trigger where tgrelid='auth.users'::regclass and tgname='docked_verified_phone_claim'and tgenabled='O'),
 'phoneClaims',(select count(*)from private.verified_phone_claims),'verifiedPhones',(select count(*)from auth.users where phone_confirmed_at is not null and phone~'^\\+?[1-9][0-9]{7,14}$'),
 'commercialRows',(select count(*)from commercial_billing.cards),'enabledRounds',(select count(*)from public_gameplay.rounds where enabled));rollback;`,
  ),
);
assert.equal(result.historyRows, 5);
for (const k of [
  "retentionDisabled",
  "outboxDisabled",
  "phoneIndexValid",
  "phoneTriggerEnabled",
])
  assert.equal(result[k], true, k);
for (const k of [
  "creatorSet",
  "creatorInherit",
  "runtimePruneAccess",
  "retentionSchemaCreate",
])
  assert.equal(result[k], false, k);
assert.equal(result.phoneClaims, result.verifiedPhones);
assert.equal(result.commercialRows, 0);
assert.equal(result.enabledRounds, 0);
assert.equal(fingerprint(), before);
assert.equal(
  local(
    "select count(*)from supabase_migrations.schema_migrations where version in('20261109231834','20261109232000','20261109232124','20261110005726','20261110010050')",
  ),
  "0",
);
assert.equal(
  local("select to_regprocedure('private.billing_ops_window()')is null"),
  "t",
);
const report = {
  at: new Date().toISOString(),
  passed: true,
  target,
  postgresSuperuser: false,
  network: "none",
  atomicPackageAndHistoryInsertion: true,
  rolledBack: true,
  catalogueUnchangedAfterRollback: true,
  historyRowsAfter: 0,
  productionWrites: 0,
  files,
  checks: result,
};
writeFileSync(
  out + "/atomic-rehearsal.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
