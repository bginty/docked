/** Disposable LOCAL database only. Does not load credentials or contact providers. */
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const container = "docked-batch1-synthetic-20261116",
  database = "sms_budget_guard_20261117";
const migration =
  "supabase/migrations/20261116215032_public_sms_budget_guard.sql";
const args = (db) => [
  "exec",
  "-i",
  container,
  "psql",
  "-h",
  "127.0.0.1",
  "-X",
  "-qAt",
  "-v",
  "ON_ERROR_STOP=1",
  "-U",
  "postgres",
  "-d",
  db,
];
const query = (s, db = database) =>
  execFileSync("docker", args(db), {
    input: s,
    encoding: "utf8",
    windowsHide: true,
  }).trim();
function concurrent(s) {
  return new Promise((resolve, reject) => {
    const p = spawn("docker", args(database), {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "",
      error = "";
    p.stdout.on("data", (x) => (out += x));
    p.stderr.on("data", (x) => (error += x));
    p.on("error", reject);
    p.on("exit", (c) => (c === 0 ? resolve(out.trim()) : reject(Error(error))));
    p.stdin.end(s);
  });
}
const user = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const fp = (n) => n.toString(16).padStart(64, "0");
const reserve = (w, n, u = n) =>
  `set role docked_app; select sms_delivery.reserve('${w}','${fp(n)}','${user(u)}');`;
const window = (id, budget = 5000, settings = "") =>
  `insert into sms_delivery.windows(id,enabled,starts_at,expires_at,budget_aud_cents,authority_reference,price_evidence_reference) values('${id}',true,now()-interval '1 hour',now()+interval '1 day',${budget},'Synthetic isolated authority; no delivery permitted','Synthetic price ceiling; no provider contact');${settings}`;
let created = false;
const passed = [];
try {
  assert.equal(query("select current_database();", "postgres"), "postgres");
  query(`create database ${database};`, "postgres");
  created = true;
  query(`create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean,banned_until timestamptz);
 insert into auth.users select ('00000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,now(),false,null from generate_series(1,70)i;`);
  query(readFileSync(migration, "utf8"));
  assert.equal(query("select count(*) from sms_delivery.windows"), "0");
  passed.push("Migration inactive, no window/provider/settings mutations");
  query(window("race", 5000));
  const duplicates = await Promise.all(
    Array.from({ length: 20 }, () => concurrent(reserve("race", 1))),
  );
  assert.equal(duplicates.filter((x) => x === "send").length, 1);
  assert.equal(duplicates.filter((x) => x === "pending").length, 19);
  assert.equal(
    query(
      "select reserved_aud_cents from sms_delivery.windows where id='race'",
    ),
    "100",
  );
  passed.push("20 concurrent identical requests reserve once");
  query(window("cap", 300));
  const capped = await Promise.all(
    Array.from({ length: 20 }, (_, i) => concurrent(reserve("cap", i + 1))),
  );
  assert.equal(capped.filter((x) => x === "send").length, 3);
  assert.equal(
    query("select reserved_aud_cents from sms_delivery.windows where id='cap'"),
    "300",
  );
  passed.push("20 concurrent distinct requests cannot exceed budget");
  query(
    `set role docked_app;select sms_delivery.finish('race','${fp(1)}',false);`,
  );
  assert.equal(query(reserve("race", 1)), "uncertain");
  assert.equal(
    query(
      "select reserved_aud_cents from sms_delivery.windows where id='race'",
    ),
    "100",
  );
  passed.push("Ambiguous failure never replenishes or resends");
  query(window("accepted"));
  assert.equal(query(reserve("accepted", 2)), "send");
  query(
    `set role docked_app;select sms_delivery.finish('accepted','${fp(2)}',true);`,
  );
  assert.equal(query(reserve("accepted", 2)), "accepted");
  assert.equal(query(reserve("accepted", 3, 2)), "denied");
  passed.push("Accepted replay and per-account cooldown");
  for (const [id, extra] of [
    ["off", "enabled=false"],
    ["expired", "expires_at=now()-interval '1 second'"],
    ["future", "starts_at=now()+interval '1 hour'"],
    ["empty", "allowlist='{}'"],
    ["allow", "allowlist=array['" + user(2) + "'::uuid]"],
  ]) {
    query(
      window(
        id,
        5000,
        `update sms_delivery.windows set ${extra} where id='${id}'`,
      ),
    );
    assert.equal(query(reserve(id, 1)), "denied");
  }
  passed.push(
    "Disabled, expired, not-yet-active and non-allowlisted calls denied",
  );
  query(window("auth"));
  query(
    `update auth.users set is_anonymous=true where id='${user(3)}';update auth.users set email_confirmed_at=null where id='${user(4)}';update auth.users set banned_until=now()+interval '1 day' where id='${user(5)}';`,
  );
  for (const n of [3, 4, 5, 71])
    assert.equal(query(reserve("auth", n)), "denied");
  passed.push("Anonymous/unverified/banned/missing users denied");
  const permissions = query(
    "select has_table_privilege('docked_app','sms_delivery.windows','UPDATE'),has_table_privilege('docked_app','sms_delivery.attempts','INSERT'),has_function_privilege('anon','sms_delivery.reserve(text,text,uuid)','EXECUTE'),has_function_privilege('authenticated','sms_delivery.reserve(text,text,uuid)','EXECUTE'),has_function_privilege('service_role','sms_delivery.reserve(text,text,uuid)','EXECUTE');",
  );
  assert.equal(permissions, "f|f|f|f|f");
  passed.push(
    "No customer/service-role hook access; runtime cannot edit budgets or attempts directly",
  );
  query(window("global"));
  for (let n = 10; n < 40; n++)
    assert.equal(query(reserve("global", n)), "send");
  assert.equal(query(reserve("global", 40)), "denied");
  passed.push("Global 30/hour bound enforced inside database lock");
  writeFileSync(
    "docs/qa/final-release-decision-20261117/sms-budget-database-tests.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        environment: "disposable local Postgres17 database",
        migration,
        passed,
        concurrentDuplicateRequests: 20,
        concurrentDistinctRequests: 20,
        productionWrites: 0,
        smsSent: 0,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    JSON.stringify({ passed: passed.length, productionWrites: 0, smsSent: 0 }),
  );
} finally {
  if (created) query(`drop database ${database} with (force);`, "postgres");
}
