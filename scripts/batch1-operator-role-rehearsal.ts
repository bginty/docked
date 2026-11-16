/** Managed-Postgres operator permissions, rolled back in the disconnected DB. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { packAcceptanceSchemas } from "../src/server/pack-acceptance-sql";
const target = "docked-batch1-synthetic-20261116",
  dir = "private-data/batch1-beta-alignment-20261116";
const config = JSON.parse(
  execFileSync("docker", ["inspect", target], { windowsHide: true }).toString(),
)[0];
assert.equal(config.HostConfig.NetworkMode, "none");
assert.equal(Object.keys(config.HostConfig.PortBindings ?? {}).length, 0);
const schemas = [
  "b1_acceptance",
  ...packAcceptanceSchemas.map((s) => "b1_" + s),
];
const files = [
  "namespace-schema.sql",
  "namespace-permissions.sql",
  "fixtures.sql",
].map((name) => ({ name, bytes: readFileSync(dir + "/" + name, "utf8") }));
const psql = (text: string) =>
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
    {
      input: text,
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 3e6,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
const query = `select jsonb_build_object('superuser',(select rolsuper from pg_roles where rolname='postgres'),'cards',(select count(*) from b1_beta_packs.issued),'state',(select md5(document::text) from b1_credits_sandbox.state where id))`;
const before = JSON.parse(psql(query));
assert.equal(before.superuser, true);
let text =
  "begin;" + schemas.map((s) => `drop schema ${s} cascade;`).join("\n");
text +=
  "drop owned by docked_pack_acceptance_owner;drop role docked_pack_acceptance_owner;drop owned by docked_pack_acceptance;drop role docked_pack_acceptance;";
text +=
  "create role b1_operator_probe nologin nosuperuser createrole createdb bypassrls;grant create on database postgres to b1_operator_probe;grant usage on schema auth to b1_operator_probe;grant select,references on auth.users,auth.sessions,auth.mfa_factors to b1_operator_probe;set local role b1_operator_probe;select jsonb_build_object('operatorSuperuser',current_setting('is_superuser'));create role docked_pack_acceptance login nosuperuser nocreatedb nocreaterole noinherit nobypassrls;";
text += files.map((f) => f.bytes).join("\n");
text +=
  "select jsonb_build_object('definitions',(select count(*) from b1_commercial_billing.definitions),'issued',(select count(*) from b1_beta_packs.issued));";
text += schemas
  .map((s) => `revoke create on schema ${s} from docked_pack_acceptance_owner;`)
  .join("\n");
text +=
  "grant docked_pack_acceptance_owner to current_user with inherit false,set false;select jsonb_build_object('operatorCanSetOwner',pg_has_role(current_user,'docked_pack_acceptance_owner','SET'),'runtimeCanSetOwner',pg_has_role('docked_pack_acceptance','docked_pack_acceptance_owner','SET'),'ownerCanCreateSchema',has_database_privilege('docked_pack_acceptance_owner',current_database(),'CREATE'));rollback;";
try {
  const rows = psql(text)
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((s) => JSON.parse(s));
  assert.equal(rows[0].operatorSuperuser, "off");
  assert.deepEqual(rows[1], { definitions: 540, issued: 0 });
  assert.deepEqual(rows[2], {
    operatorCanSetOwner: false,
    runtimeCanSetOwner: false,
    ownerCanCreateSchema: false,
  });
  assert.deepEqual(
    JSON.parse(psql(query)),
    before,
    "Local transaction must roll back completely",
  );
  writeFileSync(
    "docs/qa/batch1-beta-alignment-20261116/operator-role-rehearsal.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        localOnly: true,
        managedOperatorPrivileges: true,
        rows,
        transactionRolledBack: true,
        hostedWrites: 0,
        files: files.map((f) => ({
          name: f.name,
          sha256: createHash("sha256").update(f.bytes).digest("hex"),
        })),
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    JSON.stringify({
      nonSuperuserSetupPassed: true,
      temporaryOwnerDataAccessRemoved: true,
      rolledBack: true,
      hostedWrites: 0,
    }),
  );
} catch (e: any) {
  writeFileSync(dir + "/operator-rehearsal.private.log", String(e.stderr ?? e));
  console.error(
    "Non-superuser isolated rehearsal stopped; diagnostic retained locally",
  );
  process.exitCode = 1;
}
