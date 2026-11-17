/** Readiness review on the network-disabled restore. No hosted writes. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

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
const run = (sql) =>
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
assert(run("show data_directory;").startsWith("/restore/"));
const manifest = JSON.parse(
  readFileSync("private-data/clean-transition-20261117/manifest.private.json"),
);
const owners = manifest.filter((row) => row.kind === "owner");
assert.equal(owners.length, 2);
const q = (s) => "'" + s.replaceAll("'", "''") + "'";
const before = run("select launch_transition.source_digest();");
let sql = `begin;select launch_transition.prepare(${q(JSON.stringify(manifest))}::jsonb,launch_transition.source_digest(),repeat('a',64),repeat('b',64));\n`;
for (const owner of owners) {
  sql += `select set_config('request.jwt.claim.sub',${q(owner.id)},true),set_config('request.jwt.claims',jsonb_build_object('sub',${q(owner.id)},'session_id',(select id from auth.sessions where user_id=${q(owner.id)}::uuid and aal='aal2' and(not_after is null or not_after>now())limit 1),'aal','aal2')::text,true);
set local role docked_app;
do $$begin
 if not exists(select 1 from public.profiles p join private.roles r on r.user_id=p.id where p.id=${q(owner.id)}::uuid and p.disabled_at is null and r.role='owner') then raise exception 'Public Owner projection missing';end if;
 if not (private.commercial_transition_status(${q(owner.id)}::uuid)->>'allowed')::boolean then raise exception 'Retained Owner excluded';end if;
 perform operations.review('read');
end$$;
select set_config('request.jwt.claims',jsonb_set(current_setting('request.jwt.claims')::jsonb,'{aal}','"aal1"'::jsonb)::text,true);
do $$begin
 begin perform operations.review('read');raise exception 'Expected MFA rejection';
 exception when raise_exception then if sqlerrm<>'Active owner MFA session required' then raise;end if;end;
end$$;
reset role;
`;
}
sql += "rollback;";
// Contains restored identities internally; never emit the SQL or result rows.
run(sql);
assert.equal(run("select launch_transition.source_digest();"), before);
const files = [
  "admin-search",
  "admin-record",
  "admin-announcements",
  "moderation-cases",
  "moderation-retention",
  "owner-operations",
  "owner-health",
  "owner-marketplace",
];
const surfaces = files.map((file) => {
  const path = `src/server/${file}.ts`,
    source = readFileSync(path, "utf8");
  const functions = [
    ...new Set(
      [...source.matchAll(/\bprivate\.([a-z_]+)\(/g)].map((match) => match[1]),
    ),
  ];
  const dependencies = functions.map((name) =>
    JSON.parse(
      run(
        `select jsonb_build_object('function',${q(name)},'publicSchemaExists',exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private'and p.proname=${q(name)}),'betaSchemaExists',exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='beta_private'and p.proname=${q(name)}));`,
      ),
    ),
  );
  return {
    path,
    explicitlyRequiresBetaRuntime: source.includes(
      'process.env.DOCKED_BETA_STAGING !== "true"',
    ),
    dependencies,
  };
});
const evidence = {
  at: new Date().toISOString(),
  environment:
    "Network-disabled restored database; restricted docked_app role; synthetic local claims from restored sessions",
  retainedOwners: 2,
  publicOwnerProfilesRolesAndTransitionRead: "passed",
  publicIncidentReadWithAal2: "passed for both Owners",
  publicIncidentReadWithAal1: "denied for both Owners",
  sourceDigestUnchangedAfterRollback: true,
  surfaces,
  conclusion:
    "Core incident access uses both retained Owner identities correctly in the public role. Eight existing administration modules explicitly require beta mode; a flag-only public switch cannot preserve all their current functions. This review does not certify full public-runtime acceptance.",
  hostedOwnerLogin: "not exercised by this isolated test",
  productionWrites: 0,
  emailsSent: 0,
};
writeFileSync(
  "docs/qa/final-public-runtime-20261117/owner-runtime-review.json",
  JSON.stringify(evidence, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    owners: 2,
    corePublicIncidentMfaPassed: true,
    betaOnlyModules: surfaces.filter((s) => s.explicitlyRequiresBetaRuntime)
      .length,
    productionWrites: 0,
  }),
);
