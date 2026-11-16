/** Retained authenticated snapshot, local clone, no network, all changes rolled back. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tableListQuery, checksumQuery } from "./lib/reviewed-inventory";
const target = "docked-commercial-restore-20261117a";
const config = JSON.parse(
  execFileSync("docker", ["inspect", target], { windowsHide: true }).toString(),
)[0];
assert.equal(config.HostConfig.NetworkMode, "none");
assert.deepEqual(config.HostConfig.PortBindings, {});
assert.equal(config.State.Running, true);
const proof = JSON.parse(
  readFileSync(
    "docs/qa/v31-prelaunch-execution-20261111/database/restore-20261117a/restore-only.json",
    "utf8",
  ),
);
assert(
  proof.restored && proof.protectedRecordsUnchanged && proof.network === "none",
);
assert.equal(proof.restoreTarget, target);
function query(q: string) {
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      target,
      "psql",
      "-X",
      "-qAt",
      "-h",
      "/restore",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    {
      input: q,
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 64e6,
      stdio: ["pipe", "pipe", "pipe"],
    },
  )
    .split(/\r?\n/)
    .filter((s) => s.startsWith("{") || s.startsWith("["))
    .map((s) => JSON.parse(s));
}
const [settings] = query(
  "select jsonb_build_object('cron',current_setting('cron.launch_active_jobs'),'networkDatabase',current_setting('pg_net.database_name'))",
);
assert.equal(settings.cron, "off");
assert.equal(settings.networkDatabase, "network_worker_disabled");
const [tables] = query(tableListQuery);
const census = () =>
  query(
    "begin read only;" + tables.map(checksumQuery).join(";\n") + ";rollback;",
  );
const before = census();
const sourceHash = `with s as(select 'profile'::text kind,id::text key,to_jsonb(p) document from beta_public.profiles p union all select 'role',user_id::text,to_jsonb(p) from beta_private.roles p union all select 'consent',id::text,to_jsonb(p) from beta_private.consent_events p union all select 'notification',user_id::text,to_jsonb(p) from beta_public.notification_preferences p) select jsonb_build_object('hash',encode(sha256(convert_to(jsonb_agg(to_jsonb(s)order by kind,key)::text,'UTF8')),'hex')) from s;`;
const [source] = query(sourceHash);
const adoption = readFileSync(
  "config/operations/public-identity-adoption.prepared.sql",
  "utf8",
);
assert.equal((adoption.match(/^commit;$/gm) ?? []).length, 1);
const sms = readFileSync(
  "supabase/migrations/20261116215032_public_sms_budget_guard.sql",
  "utf8",
);
let stage = "identity adoption";
try {
  const result = query(
    `set docked.public_adoption_approval='${"a".repeat(64)}';set docked.public_adoption_source_sha256='${source.hash}';` +
      adoption.replace(
        /^commit;$/m,
        `
select jsonb_build_object('profiles',(select count(*) from public.profiles),'roles',(select count(*) from private.roles),'consents',(select count(*) from private.consent_events),'notificationPreferences',(select count(*) from public.notification_preferences));
rollback;`,
      ),
  );
  assert.equal(result[0].profiles, 6);
  assert.equal(result[0].roles, 2);
  stage = "inactive SMS migration";
  const [smsResult] = query(
    "begin;set local lock_timeout='3s';set local statement_timeout='20s';" +
      sms +
      `
select jsonb_build_object('windows',(select count(*) from sms_delivery.windows),'attempts',(select count(*) from sms_delivery.attempts),'runtimeCanReserve',has_function_privilege('docked_app','sms_delivery.reserve(text,text,uuid)','EXECUTE'),'authCannotReserve',not has_function_privilege('authenticated','sms_delivery.reserve(text,text,uuid)','EXECUTE'),'runtimeCannotUpdateWindow',not has_table_privilege('docked_app','sms_delivery.windows','UPDATE'));
rollback;`,
  );
  assert.deepEqual(smsResult, {
    windows: 0,
    attempts: 0,
    runtimeCanReserve: true,
    authCannotReserve: true,
    runtimeCannotUpdateWindow: true,
  });
  assert.deepEqual(census(), before);
  const report = {
    at: new Date().toISOString(),
    scope:
      "Account adoption and inactive SMS migration only; not complete public-runtime acceptance",
    sourceBackupAt: proof.backupAt,
    restoreProof: proof.archiveSha256,
    target,
    network: "none",
    allChangesRolledBack: true,
    protectedTablesUnchanged: before.length,
    adoptionSha256: createHash("sha256").update(adoption).digest("hex"),
    smsSqlSha256: createHash("sha256").update(sms).digest("hex"),
    adoption: result[0],
    sms: smsResult,
    productionWrites: 0,
    smsSent: 0,
  };
  writeFileSync(
    "docs/qa/final-release-decision-20261117/transition-partial-restore.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
} catch (error) {
  // SQL error details can contain copied profile values; keep them private.
  assert.deepEqual(census(), before);
  const detail = String(
    (error as { stderr?: Buffer }).stderr ?? "Local assertion failed",
  );
  writeFileSync("private-data/final-public-transition-failure.txt", detail);
  console.error(
    JSON.stringify({
      stage,
      failed: true,
      allChangesRolledBack: true,
      protectedTablesUnchanged: before.length,
      privateErrorFile: "private-data/final-public-transition-failure.txt",
    }),
  );
  process.exitCode = 1;
}
