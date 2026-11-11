// Synthetic, network-isolated PostgreSQL 17 test. Never connects to hosted data.
import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const target = "docked-v31-retention-acceptance-20261111";
const image = "public.ecr.aws/supabase/postgres:17.11.0.002";
const migration =
  "supabase/migrations/20261110005726_operational_incident_retention.sql";
const source = readFileSync(migration, "utf8");
const original = execFileSync(
  "git",
  ["show", "47754edfd8abfac7a32ce62212c0374636441c41:" + migration],
  { encoding: "utf8", windowsHide: true },
);
const run = (args, input) =>
  spawnSync("docker", args, {
    input,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 4e6,
  });
function psql(
  input,
  role = "postgres",
  database = "retention_acceptance",
  expectedError,
) {
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
      role,
      "-d",
      database,
    ],
    input,
  );
  if (expectedError) {
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, expectedError);
    return;
  }
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
}
assert.notEqual(
  run(["inspect", target]).status,
  0,
  "Use a fresh disposable container",
);
const start = run([
  "run",
  "-d",
  "--name",
  target,
  "--network",
  "none",
  "--user",
  "postgres",
  "--tmpfs",
  "/restore:rw,nosuid,nodev,mode=1777",
  "--entrypoint",
  "sh",
  image,
  "-c",
  "initdb -D /restore/data -U bootstrap_admin -A trust --no-locale --encoding=UTF8 >/restore/init.log 2>&1 && exec postgres -D /restore/data -c listen_addresses='' -c unix_socket_directories=/restore",
]);
assert.equal(start.status, 0, start.stderr);
const checks = [];
try {
  let ready = false;
  for (let i = 0; i < 20; i++) {
    if (
      run([
        "exec",
        target,
        "pg_isready",
        "-h",
        "/restore",
        "-U",
        "bootstrap_admin",
        "-d",
        "postgres",
      ]).status === 0
    ) {
      ready = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  assert(ready);
  psql(
    "create role postgres login createrole createdb bypassrls; create database retention_acceptance owner postgres;",
    "bootstrap_admin",
    "postgres",
  );
  psql(
    "create role anon; create role authenticated; create role service_role; create role docked_app; create role docked_beta_app; create role docked_commercial_app;",
    "bootstrap_admin",
  );
  psql(
    "create schema auth; create function auth.uid() returns uuid language sql as 'select null::uuid'; create function auth.jwt() returns jsonb language sql as $$select '{}'::jsonb$$;",
  );
  psql(
    readFileSync(
      "supabase/migrations/20261109232124_operational_incident_review.sql",
      "utf8",
    ),
  );
  assert.equal(
    psql("select rolsuper from pg_roles where rolname=current_user"),
    "f",
  );
  psql(
    "begin;" + original + "commit;",
    "postgres",
    "retention_acceptance",
    /Retention role must remain unassigned/,
  );
  assert.equal(
    psql(
      "select exists(select 1 from pg_roles where rolname='docked_incident_retention')",
    ),
    "f",
  );
  checks.push(
    "Original failure reproduced with non-superuser CREATEROLE; failed transaction leaves no role",
  );
  for (let i = 0; i < 2; i++) psql("begin;" + source + "commit;");
  checks.push(
    "Complete revised retention migration applied and reapplied as non-superuser postgres",
  );
  const state = JSON.parse(
    psql(`select jsonb_build_object(
    'enabled',(select enabled from operations.retention_policy),
    'creatorSet',pg_has_role('postgres','docked_incident_retention','SET'),
    'creatorInherit',pg_has_role('postgres','docked_incident_retention','USAGE'),
    'schemaCreate',has_schema_privilege('docked_incident_retention','operations','CREATE'),
    'owner',(select pg_get_userbyid(proowner) from pg_proc where oid='operations.prune_routine(int)'::regprocedure),
    'memberships',(select jsonb_agg(jsonb_build_object('member',m.rolname,'grantor',g.rolname,'admin',a.admin_option,'inherit',a.inherit_option,'set',a.set_option)) from pg_auth_members a join pg_roles m on m.oid=a.member join pg_roles g on g.oid=a.grantor where a.roleid='docked_incident_retention'::regrole))`),
  );
  assert.equal(state.enabled, false);
  assert.equal(state.creatorSet, false);
  assert.equal(state.creatorInherit, false);
  assert.equal(state.schemaCreate, false);
  assert.equal(state.owner, "docked_incident_retention");
  assert.deepEqual(state.memberships, [
    {
      member: "postgres",
      grantor: "bootstrap_admin",
      admin: true,
      inherit: false,
      set: false,
    },
  ]);
  checks.push(
    "Only unavoidable bootstrap ADMIN grant remains; no SET, inheritance, schema CREATE or enabled deletion",
  );
  for (const role of [
    "anon",
    "authenticated",
    "service_role",
    "docked_app",
    "docked_beta_app",
    "docked_commercial_app",
  ]) {
    assert.equal(
      psql(
        `select has_function_privilege('${role}','operations.prune_routine(int)','execute')`,
      ),
      "f",
    );
    assert.equal(
      psql(`select pg_has_role('${role}','docked_incident_retention','SET')`),
      "f",
    );
  }
  psql(
    "select operations.prune_routine();",
    "bootstrap_admin",
    "retention_acceptance",
    /Incident retention disabled/,
  );
  checks.push(
    "All six runtime roles denied prune execution and SET ROLE; disabled policy enforced",
  );
  psql("grant docked_incident_retention to anon;");
  psql(
    "begin;" + source + "commit;",
    "postgres",
    "retention_acceptance",
    /no executable memberships/,
  );
  psql("revoke docked_incident_retention from anon;");
  psql("alter role docked_incident_retention login;");
  psql(
    "begin;" + source + "commit;",
    "postgres",
    "retention_acceptance",
    /no executable memberships/,
  );
  psql("alter role docked_incident_retention nologin;");
  checks.push(
    "Unexpected runtime membership and LOGIN drift both rejected before setup grants",
  );
  psql(
    "begin;" + source + "select 1/0;commit;",
    "postgres",
    "retention_acceptance",
    /division by zero/,
  );
  assert.equal(
    psql("select pg_has_role('postgres','docked_incident_retention','SET')"),
    "f",
  );
  checks.push(
    "Later transaction failure rolls back setup without leaving executable membership",
  );
  const report = {
    at: new Date().toISOString(),
    passed: true,
    target,
    network: "none",
    ports: 0,
    hostedWrites: 0,
    syntheticOnly: true,
    operatorSuperuser: false,
    migrationSha256: createHash("sha256").update(source).digest("hex"),
    checks,
    finalState: state,
  };
  const out =
    "docs/qa/v31-prelaunch-execution-20261111/database/retention-role-correction";
  mkdirSync(out, { recursive: true });
  writeFileSync(
    out + "/synthetic-rehearsal.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
} finally {
  assert.equal(
    run(["stop", target]).status,
    0,
    "Stop this task-owned container",
  );
}
