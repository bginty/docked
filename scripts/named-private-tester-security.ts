/** Actual PostgreSQL permissions on the disconnected rehearsal only. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { namedTesterDirectory } from "./lib/named-tester-plan";
const target = "docked-commercial-restore-20261115l";
const config = JSON.parse(
  execFileSync("docker", ["inspect", target], { windowsHide: true }).toString(),
)[0];
assert.equal(config.HostConfig.NetworkMode, "none");
assert.equal(Object.keys(config.HostConfig.PortBindings ?? {}).length, 0);
const query = `select jsonb_build_object(
 'rls',(select relrowsecurity from pg_class where oid='beta_private.named_tester_exception'::regclass),
 'policies',(select count(*) from pg_policy where polrelid='beta_private.named_tester_exception'::regclass),
 'tableAccess',(select jsonb_agg(jsonb_build_object('role',r,'allowed',has_table_privilege(r,'beta_private.named_tester_exception','SELECT,INSERT,UPDATE,DELETE'))) from unnest(array['anon','authenticated','docked_app','docked_beta_app']) r),
 'functions',(select jsonb_agg(jsonb_build_object('name',proname,'securityDefiner',prosecdef,'settings',proconfig,
 'anonymous',has_function_privilege('anon',oid,'EXECUTE'),'authenticated',has_function_privilege('authenticated',oid,'EXECUTE'),
 'ordinaryApp',has_function_privilege('docked_app',oid,'EXECUTE'),'betaRuntime',has_function_privilege('docked_beta_app',oid,'EXECUTE')) order by proname)
 from pg_proc where pronamespace='beta_private'::regnamespace and (proname like 'named_tester_%' or proname='accept_named_tester')));`;
const row = JSON.parse(
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
    { input: query, windowsHide: true },
  )
    .toString()
    .trim(),
);
assert.equal(row.rls, true);
assert.equal(Number(row.policies), 0);
for (const access of row.tableAccess)
  assert.equal(access.allowed, false, access.role);
assert.equal(row.functions.length, 5);
for (const f of row.functions) {
  for (const key of ["anonymous", "authenticated", "ordinaryApp"])
    assert.equal(f[key], false, f.name + ":" + key);
  assert.equal(
    f.betaRuntime,
    ["named_tester_setup_identity", "accept_named_tester"].includes(f.name),
    f.name,
  );
  if (f.securityDefiner) assert(f.settings.includes('search_path=""'), f.name);
}
writeFileSync(
  namedTesterDirectory + "security-acceptance.json",
  JSON.stringify(
    { at: new Date().toISOString(), passed: true, productionWrites: 0, ...row },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({
    passed: true,
    privateTableDefaultDeny: true,
    narrowRuntimeFunctions: 2,
    productionWrites: 0,
  }),
);
