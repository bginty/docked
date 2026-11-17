/** Completes the real Auth -> database checkpoint boundary using disposable
 * identities already created by the isolated v2.198 lifecycle test. */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { SignJWT } from "jose";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  retireContainedAccount,
  type RetirementAdmin,
} from "../src/core/account-retirement";
const cfg = JSON.parse(
  readFileSync(
    "private-data/clean-transition-20261117/auth-local.private.json",
    "utf8",
  ),
);
assert.equal(cfg.db, "docked-clean-auth-db-20261117");
const docker = (args: string[], input?: string) =>
  execFileSync("docker", args, {
    input,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024,
  });
assert.equal(
  JSON.parse(docker(["network", "inspect", cfg.network]))[0].Internal,
  true,
);
const db = (s: string) =>
  docker(
    [
      "exec",
      "-i",
      cfg.db,
      "psql",
      "-U",
      "postgres",
      "-X",
      "-qAt",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    s,
  ).trim();
const q = (s: string) => "'" + s.replaceAll("'", "''") + "'";
const ids = JSON.parse(
  readFileSync(
    "private-data/clean-transition-20261117/auth-fixtures.private.json",
    "utf8",
  ),
).ids;
const old = ids[0],
  owner = ids[2],
  remaining = ids[ids.length - 1];
for (const id of [old, owner, remaining]) assert.match(id, /^[a-f0-9-]{36}$/);
assert.equal(
  db(
    `select count(*)from auth.users where id=${q(old)}and deleted_at is not null`,
  ),
  "1",
);
assert.equal(
  db(
    `select count(*)from auth.mfa_factors where user_id=${q(owner)}and status='verified'`,
  ),
  "1",
);
const migration = readFileSync(
  "supabase/migrations/20261117001019_clean_commercial_account_transition.sql",
  "utf8",
);
const operator = readFileSync(
  "config/operations/clean-commercial-transition.prepared.sql",
  "utf8",
);
const schema = migration.slice(0, migration.indexOf("-- GoTrue"));
assert.equal(
  db("select to_regnamespace('launch_transition')is null"),
  "t",
  "Checkpoint fixture already exists; do not reset history",
);
db(`do $$declare r text;begin foreach r in array array['anon','authenticated','service_role','docked_app','docked_beta_app','docked_commercial_app']loop execute format('create role %I nologin',r);end loop;end$$;
create schema beta_private;${schema}
create table private.roles(user_id uuid primary key references auth.users,role text not null);
${operator.slice(operator.indexOf("create function launch_transition.record_auth_retired"), operator.lastIndexOf("revoke all"))}
insert into launch_transition.batches values(repeat('a',64),repeat('b',64),repeat('c',64),repeat('d',64),'blocked',now(),null);
insert into launch_transition.accounts values(${q(old)},repeat('a',64),'customer',repeat('e',64),'access_blocked'),(${q(owner)},repeat('a',64),'owner',repeat('f',64),'retained'),(${q(remaining)},repeat('a',64),'customer',repeat('0',64),'access_blocked');
update launch_transition.accounts set identity_sha256=encode(sha256(convert_to((select email from auth.users where id=user_id),'UTF8')),'hex')where kind='customer'and phase='access_blocked';
insert into private.roles values(${q(owner)},'owner');
select launch_transition.record_auth_retired(repeat('a',64),${q(old)});
select launch_transition.record_auth_retired(repeat('a',64),${q(old)});
`);
assert.equal(
  db(
    `select count(*)from launch_transition.events where user_id=${q(old)}and action='AUTH_RETIREMENT_VERIFIED'`,
  ),
  "1",
);
assert.throws(
  () => db("select launch_transition.complete(repeat('a',64))"),
  /retirement not verified/,
);
const email = db(`select email from auth.users where id=${q(remaining)}`);
assert(email.endsWith("@lifecycle.invalid"));
const token = await new SignJWT({ role: "service_role" })
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setExpirationTime("1h")
  .sign(new TextEncoder().encode(cfg.jwt));
const driver =
  "const fs=require('fs');const p=JSON.parse(fs.readFileSync(0,'utf8'));fetch(p.url,{method:p.method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+p.token},body:p.body===undefined?undefined:JSON.stringify(p.body),signal:AbortSignal.timeout(15000)}).then(async r=>console.log(JSON.stringify({status:r.status,data:await r.json()}))).catch(()=>process.exitCode=1)";
const api = async (method: string, id: string, body?: unknown) => {
  const r = JSON.parse(
    docker(
      [
        "run",
        "--rm",
        "--network",
        cfg.network,
        "-i",
        "node:22-alpine",
        "node",
        "-e",
        driver,
      ],
      JSON.stringify({
        url: `http://${cfg.auth}:9999/admin/users/${id}`,
        method,
        body,
        token,
      }),
    ),
  );
  return {
    data: { user: r.status === 200 ? r.data : null },
    error: r.status === 200 ? null : Error("Provider failure"),
  };
};
const admin: RetirementAdmin = {
  getUserById: (id) => api("GET", id),
  deleteUser: (id, soft) => {
    assert.equal(soft, true);
    return api("DELETE", id, { should_soft_delete: true });
  },
};
await retireContainedAccount({
  checkpoint: {
    userId: remaining,
    kind: "customer",
    phase: "access_blocked",
    emailSha256: createHash("sha256").update(email).digest("hex"),
  },
  admin,
  recordAttempt: async () => {
    db(
      `insert into launch_transition.events(batch,user_id,action)values(repeat('a',64),${q(remaining)},'AUTH_SOFT_DELETE_ATTEMPT')`,
    );
  },
  verifyAndRecord: async () => {
    db(
      `select launch_transition.record_auth_retired(repeat('a',64),${q(remaining)})`,
    );
  },
});
db(
  "select launch_transition.complete(repeat('a',64));select launch_transition.complete(repeat('a',64));",
);
assert.equal(
  db(
    "select count(*)from launch_transition.events where action='TRANSITION_COMPLETE_GATES_CLOSED'",
  ),
  "1",
);
assert.equal(
  db(
    `select count(*)from auth.users where id=${q(owner)}and deleted_at is null`,
  ),
  "1",
);
assert.equal(
  db(
    `select count(*)from auth.mfa_factors where user_id=${q(owner)}and status='verified'`,
  ),
  "1",
);
const result = {
  at: new Date().toISOString(),
  passed: true,
  provider: "GoTrue v2.198.0",
  productionWrites: 0,
  checks: [
    "Exact checkpoint SQL verifies real soft-deleted Auth rows",
    "Retry creates one completion audit event",
    "Partial retirement cannot complete",
    "Shared retirement operator calls supported soft-delete API",
    "Post-provider database checkpoint succeeds",
    "Batch completion is idempotent",
    "Retained Owner identity and individual MFA survive",
  ],
};
writeFileSync(
  "docs/qa/clean-transition-20261117/auth-checkpoint-tests.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result));
