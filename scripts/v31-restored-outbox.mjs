// LOCAL ONLY. Apply/reapply the exact permission package on the retained restore.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
const runId = process.env.DOCKED_RESTORE_RUN ?? "20261111";
assert.match(runId, /^2026\d{4}[a-z]?$/);
const target = `docked-commercial-restore-${runId}`;
const out = "docs/qa/v31-prelaunch-execution-20261111/database";
const inspect = JSON.parse(
  spawnSync("docker", ["inspect", target], { encoding: "utf8" }).stdout,
)[0];
assert.equal(inspect.HostConfig.NetworkMode, "none");
assert.equal(Object.keys(inspect.HostConfig.PortBindings ?? {}).length, 0);
const local = (sql) => {
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
    {
      input: sql,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      windowsHide: true,
    },
  );
  if (r.status !== 0)
    throw Error("Local SQL failed; no hosted connection used");
  return r.stdout.trim();
};
const names = local(
  "select quote_ident(schemaname)||'.'||quote_ident(tablename) from pg_tables where schemaname not in ('pg_catalog','information_schema','net') and schemaname !~ '^pg_' order by 1",
).split("\n");
const fingerprints = () =>
  Object.fromEntries(
    local(
      names
        .map(
          (t) =>
            `select jsonb_build_array('${t}',jsonb_build_object('count',count(*),'hash',md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')))) from ${t} t ${t === "private.feature_flags" ? "where key<>'billing_ops_alerts'" : ""};`,
        )
        .join("\n"),
    )
      .split("\n")
      .map(JSON.parse),
  );
const before = fingerprints();
const path = "config/operations/billing-ops-outbox-v2.prepared.sql";
const source = readFileSync(path, "utf8");
const sha = createHash("sha256").update(source).digest("hex");
assert.equal(
  sha,
  "59dffc74f3f9a354366bedc994136264fb1922201a6c33f40864777b2546cf09",
);
for (let n = 0; n < 2; n++) local(source);
assert.deepEqual(fingerprints(), before);
const checks = JSON.parse(
  local(
    `select jsonb_build_object('admissionDisabled',not (select enabled from private.feature_flags where key='billing_ops_alerts'),'windowClosed',not private.billing_ops_window(),'outboxOperationalRows',(select count(*) from private.outbox where payload->>'purpose'='billing_ops_health_v1'),'commercialEnqueue',has_function_privilege('docked_commercial_app','public.docked_billing_ops_enqueue()','execute'),'anonymousEnqueue',has_function_privilege('anon','public.docked_billing_ops_enqueue()','execute'),'authenticatedEnqueue',has_function_privilege('authenticated','public.docked_billing_ops_enqueue()','execute'),'commercialDirectOutbox',has_table_privilege('docked_commercial_app','private.outbox','select'),'reservedOutboxPolicies',(select count(*) from pg_policies where schemaname='private' and tablename='outbox' and policyname like 'billing_ops_reserved_%'),'retentionDisabled',(select not enabled from operations.retention_policy))`,
  ),
);
assert(
  checks.admissionDisabled &&
    checks.windowClosed &&
    checks.retentionDisabled &&
    checks.commercialEnqueue,
);
assert(
  !checks.anonymousEnqueue &&
    !checks.authenticatedEnqueue &&
    !checks.commercialDirectOutbox,
);
assert.equal(checks.outboxOperationalRows, 0);
assert.equal(checks.reservedOutboxPolicies, 4);
mkdirSync(out, { recursive: true });
const report = {
  at: new Date().toISOString(),
  target,
  network: "none",
  package: path,
  sha256: sha,
  appliedTwice: true,
  protectedTables: names.length,
  protectedRowsUnchanged: true,
  expectedAddition: "one disabled billing_ops_alerts feature flag",
  checks,
  productionWrites: 0,
  emailSent: false,
};
writeFileSync(
  `${out}/restored-outbox.json`,
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
