/** Disposable local preservation rehearsal; no real identities/provider access. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const container = "docked-batch1-synthetic-20261116",
  database = "identity_adoption_20261117";
const query = (s, db = database) =>
  execFileSync(
    "docker",
    [
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
    ],
    {
      input: s,
      encoding: "utf8",
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    },
  ).trim();
const proposal = readFileSync(
  "config/operations/public-identity-adoption.prepared.sql",
  "utf8",
);
const bootstrap = `create schema beta_public;create schema beta_private;create schema private;create schema commercial_billing;
create table beta_public.profiles(id uuid primary key,country text,state text,age_attested boolean,accepted_version text,disabled_at timestamptz);
create table public.profiles(like beta_public.profiles including all);
create table beta_private.roles(user_id uuid primary key,role text,assigned_at timestamptz);
create table private.roles(like beta_private.roles including all);
create table beta_private.consent_events(id uuid primary key,user_id uuid,purpose text,granted boolean,version text,actor text,created_at timestamptz);
create table private.consent_events(like beta_private.consent_events including all);
create table beta_public.notification_preferences(user_id uuid primary key,paused boolean);
create table public.notification_preferences(like beta_public.notification_preferences including all);
create table private.audit_events(actor text,action text,subject text,details jsonb);
create table private.feature_flags(key text,enabled boolean);
insert into private.feature_flags values('registration',false);
create table commercial_billing.control(sales_enabled boolean,issuance_enabled boolean,transfers_enabled boolean,gameplay_enabled boolean);
insert into commercial_billing.control values(false,false,false,false);
create table commercial_billing.customer_assets(document jsonb);insert into commercial_billing.customer_assets values(' {"cards":918,"custody":936,"credits":123456,"entitlements":["unopened"]}');
insert into beta_public.profiles select ('00000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,case when i=6 then 'US' else 'AU' end,'original-state',true,'historical-consent',case when i=5 then now() end from generate_series(1,6)i;
insert into beta_private.roles select id,case when row_number()over(order by id)=1 then 'owner' else 'admin' end,now()-interval '1 day' from beta_public.profiles order by id limit 2;
insert into beta_private.consent_events select id,id,'privacy',false,'original-version',id::text,now()-interval '1 day' from beta_public.profiles;
insert into beta_public.notification_preferences select id,true from beta_public.profiles;`;
const source = `with s as(select 'profile'::text kind,id::text key,to_jsonb(p) document from beta_public.profiles p union all select 'role',user_id::text,to_jsonb(p) from beta_private.roles p union all select 'consent',id::text,to_jsonb(p) from beta_private.consent_events p union all select 'notification',user_id::text,to_jsonb(p) from beta_public.notification_preferences p) select encode(sha256(convert_to(jsonb_agg(to_jsonb(s)order by kind,key)::text,'UTF8')),'hex') from s;`;
let created = false;
const passed = [];
try {
  query(`create database ${database}`, "postgres");
  created = true;
  query(bootstrap);
  const hash = query(source),
    assets = query("select document from commercial_billing.customer_assets");
  const run = (h = hash) =>
    query(
      `set docked.public_adoption_approval='${"a".repeat(64)}';set docked.public_adoption_source_sha256='${h}';` +
        proposal,
    );
  assert.throws(() => run("b".repeat(64)));
  assert.equal(query("select count(*) from public.profiles"), "0");
  passed.push("Source drift aborts atomically");
  query("update private.feature_flags set enabled=true");
  assert.throws(() => run());
  query("update private.feature_flags set enabled=false");
  passed.push("Registration-open state aborts");
  query("update commercial_billing.control set issuance_enabled=true");
  assert.throws(() => run());
  query("update commercial_billing.control set issuance_enabled=false");
  passed.push("Issuance-open state aborts");
  run();
  assert.equal(query("select count(*) from public.profiles"), "6");
  assert.equal(query("select count(*) from private.roles"), "2");
  assert.equal(
    query(
      "select count(*) from private.consent_events where not granted and version='original-version'",
    ),
    "6",
  );
  assert.equal(
    query("select count(*) from public.notification_preferences where paused"),
    "6",
  );
  passed.push(
    "Six exact profiles, same owner/admin, original refused consent and opt-outs preserved",
  );
  assert.equal(
    query("select count(*) from public.profiles where country='US'"),
    "1",
  );
  assert.equal(
    query("select count(*) from public.profiles where disabled_at is not null"),
    "1",
  );
  passed.push("US country and disabled account remain unchanged");
  assert.equal(query(source), hash);
  assert.equal(
    query("select document from commercial_billing.customer_assets"),
    assets,
  );
  passed.push("Source and financial/card/entitlement sentinel unchanged");
  assert.throws(() => run());
  assert.equal(query("select count(*) from private.audit_events"), "1");
  passed.push("Repeat cannot overwrite, duplicate consent or replay audit");
  writeFileSync(
    "docs/qa/final-release-decision-20261117/identity-adoption-tests.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        environment:
          "local synthetic Postgres; not a restored Production rehearsal",
        passed,
        productionWrites: 0,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(JSON.stringify({ passed: passed.length, productionWrites: 0 }));
} finally {
  if (created) query(`drop database ${database} with(force)`, "postgres");
}
