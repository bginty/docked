/** Destructive only to this task's network-disconnected synthetic namespaces. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { packAcceptanceSchemas } from "../src/server/pack-acceptance-sql";
import { acceptancePrivate } from "./lib/batch1-acceptance-profile";
const target = "docked-batch1-synthetic-20261116",
  dir = acceptancePrivate;
const config = JSON.parse(
  execFileSync("docker", ["inspect", target], { windowsHide: true }).toString(),
)[0];
assert.equal(config.HostConfig.NetworkMode, "none");
assert.equal(Object.keys(config.HostConfig.PortBindings ?? {}).length, 0);
const scopes = [
  "b1_acceptance",
  ...packAcceptanceSchemas.map((s) => "b1_" + s),
];
let q =
  "begin;" +
  scopes.map((s) => `drop schema if exists ${s} cascade;`).join("\n");
q +=
  "do $$begin if exists(select 1 from pg_roles where rolname='docked_pack_acceptance_owner') then drop owned by docked_pack_acceptance_owner; drop role docked_pack_acceptance_owner;end if;end$$;";
// This rehearsal owns ONLY its two synthetic local Auth accounts.
q += `delete from auth.sessions where user_id in(select id from auth.users where raw_app_meta_data->>'docked_acceptance'='batch1-hosted-20261116'); delete from auth.mfa_factors where user_id in(select id from auth.users where raw_app_meta_data->>'docked_acceptance'='batch1-hosted-20261116');delete from auth.users where raw_app_meta_data->>'docked_acceptance'='batch1-hosted-20261116';`;
for (const f of [
  "namespace-schema.sql",
  "namespace-permissions.sql",
  "local-auth-only.sql",
  "fixtures.sql",
]) {
  let bytes = readFileSync(dir + "/" + f, "utf8");
  if (f === "fixtures.sql" && process.argv.includes("--short-rights")) {
    const old = "scope,now()-interval '1 day',now()+interval '24 hours'";
    assert(bytes.includes(old), "Expected synthetic rights fixture absent");
    bytes = bytes.replace(
      old,
      "scope,now()-interval '1 day',now()+interval '30 seconds'",
    );
  }
  q += bytes + "\n";
}
q += scopes
  .map((s) => `revoke create on schema ${s} from docked_pack_acceptance_owner;`)
  .join("\n");
q +=
  "grant docked_pack_acceptance_owner to current_user with inherit false,set false;alter role docked_pack_acceptance login;commit;";
try {
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
      input: q,
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 10e6,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  console.log("Disconnected schema, permission and fixture rehearsal passed");
} catch (e: any) {
  writeFileSync(dir + "/rehearsal-error.private.txt", String(e.stderr));
  console.error(
    String(e.stderr)
      .split("\n")
      .filter((l: string) => /ERROR:|CONTEXT:|LINE/.test(l))
      .join("\n"),
  );
  process.exitCode = 1;
}
