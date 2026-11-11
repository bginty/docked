// Real PostgreSQL, synthetic data only, no network/ports/hosted connection.
import assert from "node:assert/strict";
import { spawn, spawnSync, execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
const attempt = process.argv.find((x) => x.startsWith("--attempt="))?.slice(10);
assert(attempt === undefined || /^[1-9][0-9]*$/.test(attempt));
const target =
  "docked-v31-phone-guard-20261111" + (attempt ? "-" + attempt : "");
const migration =
  "supabase/migrations/20261110010050_australian_verified_phone_uniqueness.sql";
const source = readFileSync(migration, "utf8");
const run = (args, input) =>
  spawnSync("docker", args, {
    input,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 2e6,
  });
const args = (role = "postgres") => [
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
  "postgres",
];
function sql(input, role = "postgres", error) {
  const r = run(args(role), input);
  if (error) {
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, error);
    return;
  }
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
}
function concurrent(input) {
  return new Promise((resolve, reject) => {
    const p = spawn("docker", args("supabase_auth_admin"), {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let err = "";
    p.stderr.on("data", (b) => (err += b));
    p.stdout.resume();
    p.on("error", reject);
    p.on("close", (status) => resolve({ status, err }));
    p.stdin.end(input);
  });
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
  "public.ecr.aws/supabase/postgres:17.11.0.002",
  "-c",
  "initdb -D /restore/data -U bootstrap_admin -A trust --no-locale --encoding=UTF8 >/restore/init.log 2>&1 && exec postgres -D /restore/data -c listen_addresses='' -c unix_socket_directories=/restore",
]);
assert.equal(start.status, 0, start.stderr);
const checks = [];
const ids = [1, 2, 3, 4, 5, 6].map(
  (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
);
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
  sql(
    `create role postgres login createrole createdb bypassrls;alter database postgres owner to postgres;
 create role supabase_auth_admin login;create role anon;create role authenticated;create role service_role;create role docked_app;create role docked_beta_app;create role docked_commercial_app;
 create schema auth authorization supabase_auth_admin;create schema private authorization postgres;grant usage on schema auth to postgres;
 set role supabase_auth_admin;create table auth.users(id uuid primary key,phone text,phone_confirmed_at timestamptz,email_confirmed_at timestamptz,is_anonymous boolean default false,banned_until timestamptz,display_name text);grant select,update,trigger on auth.users to postgres;reset role;`,
    "bootstrap_admin",
  );
  sql(
    "create function private.public_phone_verified(uuid)returns boolean language sql as $$select false$$;",
  );
  sql(
    `insert into auth.users(id,phone,phone_confirmed_at,email_confirmed_at)values('${ids[0]}','+61400000001',now(),now()),('${ids[1]}','61400000002',now(),now()),('${ids[2]}',null,null,now()),('${ids[3]}',null,null,now()),('${ids[4]}',null,null,now()),('${ids[5]}',null,null,now());`,
    "supabase_auth_admin",
  );
  const digest = () =>
    sql(
      "select md5(jsonb_agg(to_jsonb(u)order by id)::text)from auth.users u;",
    );
  const before = digest();
  const old = execFileSync(
    "git",
    ["show", "47754edfd8abfac7a32ce62212c0374636441c41:" + migration],
    { encoding: "utf8", windowsHide: true },
  );
  sql("begin;" + old + "commit;", "postgres", /must be owner of table users/);
  for (let n = 0; n < 2; n++) sql("begin;" + source + "commit;");
  assert.equal(digest(), before);
  assert.equal(sql("select count(*) from private.verified_phone_claims"), "2");
  checks.push(
    "Original Auth index ownership failure reproduced; revised migration/backfill/replay passed as non-owner, non-superuser postgres without changing Auth rows",
  );
  sql(
    `update auth.users set phone='61400000001',phone_confirmed_at=now()where id='${ids[2]}';`,
    "supabase_auth_admin",
    /unique|duplicate/,
  );
  sql(
    `update auth.users set phone='+61400000002',phone_confirmed_at=now()where id='${ids[0]}';`,
    "supabase_auth_admin",
    /unique|duplicate/,
  );
  assert.equal(digest(), before);
  assert.equal(
    sql(
      `select canonical_phone from private.verified_phone_claims where user_id='${ids[0]}'`,
    ),
    "61400000001",
  );
  checks.push(
    "Duplicate verification and conflicting phone change roll back Auth and original claim together",
  );
  for (const [offset, isolation] of [
    [2, "read committed"],
    [4, "repeatable read"],
  ]) {
    const phone = offset === 2 ? "61400000003" : "61400000004";
    const outcomes = await Promise.all(
      [0, 1].map((i) =>
        concurrent(
          `begin isolation level ${isolation};update auth.users set phone='${i === 0 ? "+" : ""}${phone}',phone_confirmed_at=now()where id='${ids[offset + i]}';select pg_sleep(0.3);commit;`,
        ),
      ),
    );
    assert.equal(outcomes.filter((r) => r.status === 0).length, 1);
    assert.match(outcomes.find((r) => r.status !== 0).err, /unique|duplicate/);
    assert.equal(
      sql(
        `select count(*)from private.verified_phone_claims where canonical_phone='${phone}'`,
      ),
      "1",
    );
    checks.push(
      `Concurrent +61/61 verification with ${isolation}: exactly one transaction commits`,
    );
  }
  sql(
    `update auth.users set phone_confirmed_at=null where id='${ids[0]}';`,
    "supabase_auth_admin",
  );
  assert.equal(
    sql(
      `select count(*) from private.verified_phone_claims where user_id='${ids[0]}'`,
    ),
    "0",
  );
  sql(
    `update auth.users set phone='61400000001',phone_confirmed_at=now()where id='${ids[0]}';`,
    "supabase_auth_admin",
  );
  sql(
    `begin;update auth.users set phone='61400000009'where id='${ids[0]}';rollback;`,
    "supabase_auth_admin",
  );
  assert.equal(
    sql(
      `select canonical_phone from private.verified_phone_claims where user_id='${ids[0]}'`,
    ),
    "61400000001",
  );
  sql(
    `update auth.users set display_name='synthetic profile edit'where id='${ids[0]}';`,
    "supabase_auth_admin",
  );
  sql(`delete from auth.users where id='${ids[0]}';`, "supabase_auth_admin");
  assert.equal(
    sql(
      `select count(*) from private.verified_phone_claims where user_id='${ids[0]}'`,
    ),
    "0",
  );
  checks.push(
    "Unverification/delete release claims; transaction rollback preserves original claim; unrelated profile update works",
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
      sql(
        `select has_table_privilege('${role}','private.verified_phone_claims','select')or has_table_privilege('${role}','private.verified_phone_claims','insert')or has_function_privilege('${role}','private.sync_verified_phone_claim()','execute')`,
      ),
      "f",
    );
  }
  assert.equal(
    sql(
      "select relrowsecurity from pg_class where oid='private.verified_phone_claims'::regclass",
    ),
    "t",
  );
  checks.push(
    "Private registry RLS enabled; all six browser/runtime roles denied direct reads, writes and function execution",
  );
  sql(
    `update auth.users set id='00000000-0000-4000-8000-000000000099'where id='${ids[1]}';`,
    "supabase_auth_admin",
    /identity changes require separate review/,
  );
  sql(
    "alter table auth.users disable trigger docked_verified_phone_claim;",
    "supabase_auth_admin",
  );
  sql(
    "begin;" + source + "commit;",
    "postgres",
    /trigger drift requires review/,
  );
  sql(
    "alter table auth.users enable trigger docked_verified_phone_claim;",
    "supabase_auth_admin",
  );
  sql("begin;" + source + "commit;");
  checks.push(
    "Identity reassignment and disabled trigger drift rejected; original Auth owner retains legitimate lifecycle access",
  );
  sql(
    `begin;set local role supabase_auth_admin;alter table auth.users disable trigger docked_verified_phone_claim;update auth.users set phone='+61400000002',phone_confirmed_at=now()where id='${ids[2]}';set local role postgres;${source}commit;`,
    "bootstrap_admin",
    /Canonical verified phone conflict/,
  );
  assert.equal(
    sql(
      "select tgenabled from pg_trigger where tgrelid='auth.users'::regclass and tgname='docked_verified_phone_claim'",
    ),
    "O",
  );
  sql(
    `begin;insert into private.verified_phone_claims(canonical_phone,user_id)values('61400000099','00000000-0000-4000-8000-000000000099');${source}commit;`,
    "postgres",
    /claims differ from Auth/,
  );
  assert.equal(
    sql(
      "select count(*)from private.verified_phone_claims where canonical_phone='61400000099'",
    ),
    "0",
  );
  checks.push(
    "Pre-existing canonical duplicates and orphaned claim drift fail closed without choosing an owner; failed rehearsal mutations roll back",
  );
  const report = {
    at: new Date().toISOString(),
    passed: true,
    syntheticOnly: true,
    target,
    network: "none",
    publishedPorts: 0,
    productionWrites: 0,
    postgresSuperuser: false,
    authTableOwner: "supabase_auth_admin",
    migrationSha256: createHash("sha256").update(source).digest("hex"),
    checks,
  };
  const out =
    "docs/qa/v31-prelaunch-execution-20261111/database/retention-role-correction";
  mkdirSync(out, { recursive: true });
  writeFileSync(
    out + "/phone-guard-rehearsal.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
} finally {
  assert.equal(run(["stop", target]).status, 0);
}
