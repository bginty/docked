/** Exact SQL rehearsal in the network-none encrypted Production restore only. */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import {
  validatePriorCommunication,
  communicationAction,
} from "./clean-transition-authority.ts";
const installed = process.argv.includes("--installed-attestation");
const target = installed
    ? "docked-commercial-restore-20261117d"
    : "docked-commercial-restore-20261117b",
  dir = installed
    ? "private-data/clean-retirement-attestation-20261117"
    : "private-data/clean-transition-20261117";
mkdirSync(dir, { recursive: true });
const run = (s) =>
  execFileSync(
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
      "-X",
      "-qAt",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    {
      input: s,
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 20 * 1024 * 1024,
    },
  );
const inspect = JSON.parse(
  execFileSync("docker", ["inspect", target], {
    encoding: "utf8",
    windowsHide: true,
  }),
)[0];
assert.equal(inspect.HostConfig.NetworkMode, "none");
assert.equal(Object.keys(inspect.HostConfig.PortBindings ?? {}).length, 0);
const p = JSON.parse(
  readFileSync(
    "private-data/clean-transition-20261117/plan.private.json",
    "utf8",
  ),
);
const manifest = p.accounts
  .map((a) => ({
    id: a.id,
    kind: a.kind,
    emailSha256: createHash("sha256")
      .update(a.email.toLowerCase())
      .digest("hex"),
    originalRole: a.originalAuth.beta_roles?.[0]?.role ?? "none",
  }))
  .sort((a, b) => a.id.localeCompare(b.id));
writeFileSync(
  dir + "/manifest.private.json",
  JSON.stringify(manifest, null, 2) + "\n",
  { mode: 0o600 },
);
const q = (s) => "'" + s.replaceAll("'", "''") + "'";
const manifestSql = q(JSON.stringify(manifest)) + "::jsonb";
const body = installed
  ? ""
  : readFileSync(
      "supabase/migrations/20261117001019_clean_commercial_account_transition.sql",
      "utf8",
    ) +
    "\n" +
    readFileSync(
      "config/operations/clean-commercial-transition.prepared.sql",
      "utf8",
    );
let communicationSql = "";
if (installed) {
  assert.equal(
    run("select count(*) from launch_transition.batches").trim(),
    "0",
    "Fresh uncontained restore required",
  );
  const bytes = readFileSync(
    "docs/qa/clean-retirement-attestation-20261117/FOUNDER_ATTESTATION.json",
  );
  const sha = (b) => createHash("sha256").update(b).digest("hex");
  const detail = validatePriorCommunication(
    {
      schemaVersion: 2,
      source: "isolated-rehearsal",
      accountManifestSha256: sha(JSON.stringify(manifest)),
      communicationRequirement: "founder-attested-prior-direct-communication",
      communicationEvidence: { path: "rehearsal", sha256: sha(bytes) },
    },
    manifest,
    bytes,
  );
  communicationSql = `
insert into launch_transition.events(batch,action,detail)select batch,${q(communicationAction)},${q(JSON.stringify(detail))}::jsonb from result;
select pg_temp.assert_true((select count(*)=1 from launch_transition.events where action=${q(communicationAction)} and detail=${q(JSON.stringify(detail))}::jsonb),'Communication checkpoint not exact');
select pg_temp.assert_true(pg_temp.denied('update launch_transition.events set detail=''{}'' where action=''${communicationAction}'''),'Communication evidence mutable');
select pg_temp.assert_true(not exists(select 1 from launch_transition.events where detail ? 'noticeDelivered'),'Invented delivery marker');
`;
}
const owners = p.accounts.filter((a) => a.kind === "owner"),
  customers = p.accounts.filter((a) => a.kind === "customer");
let sql = `begin;
create function pg_temp.assert_true(v boolean,m text)returns void language plpgsql as $$begin if v is distinct from true then raise exception '%',m;end if;end$$;
create function pg_temp.denied(s text)returns boolean language plpgsql as $$begin execute s;return false;exception when others then return true;end$$;
create temp table original_hashes(name text primary key,hash text,rows bigint);
create function pg_temp.capture()returns table(name text,hash text,rows bigint)language plpgsql as $$declare r record;begin
 for r in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname not like 'pg_%' and n.nspname<>'information_schema' and not(n.nspname='net'and c.relname in('_http_response','http_request_queue'))loop
  return query execute format('select %L,md5(coalesce(string_agg(h,''''order by h),'''')),count(*)from(select md5(to_jsonb(t)::text)h from %I.%I t)q',r.nspname||'.'||r.relname,r.nspname,r.relname);
 end loop;end$$;
insert into original_hashes select * from pg_temp.capture();
create temp table original_audit as select * from private.audit_events;
create temp table original_events as select * from operations.events;
create temp table original_beta_audit as select * from beta_private.audit_events;
create temp table original_admission_events as select * from beta_private.admission_events;
${body}
select pg_temp.assert_true(not exists(select 1 from pg_temp.capture()a join original_hashes b using(name) where (a.hash,a.rows)is distinct from(b.hash,b.rows)),'Schema preparation changed existing records');
select pg_temp.assert_true((private.commercial_transition_status(null)->>'commercialReady')::boolean=false,'No-batch public participation permitted');
select pg_temp.assert_true(not public_gameplay.signup_allowed('AU','NSW','not-approved','not-approved'),'No-batch public signup permitted');
select pg_temp.assert_true(pg_temp.denied(${q(`select launch_transition.prepare(${manifestSql},'wrong',repeat('a',64),repeat('b',64))`)}),'Source drift was not rejected');
select pg_temp.assert_true(pg_temp.denied(${q(`select launch_transition.prepare(${manifestSql},launch_transition.source_digest(),repeat('a',64),null)`)}),'Missing notice was not rejected');
create temp table result as select launch_transition.prepare(${manifestSql},launch_transition.source_digest(),repeat('a',64),repeat('b',64)) batch;
${communicationSql}
select pg_temp.assert_true(launch_transition.prepare(${manifestSql},'ignored-after-exact-checkpoint',repeat('a',64),repeat('b',64))=(select batch from result),'Idempotent containment retry failed');
select pg_temp.assert_true((select count(*)=2 from public.profiles),'Only retained Owners may be copied');
select pg_temp.assert_true((select count(*)=2 from private.roles where role='owner'),'Two public Owners required');
select pg_temp.assert_true((select count(*)=2 from beta_private.roles where role='owner'),'Two beta Owners required');
select pg_temp.assert_true((select count(*)=3 from launch_transition.accounts where kind='customer'and phase='access_blocked'),'Three customer identities must be blocked');
select pg_temp.assert_true(pg_temp.denied('select beta_private.begin_customer_signup(''retired-fixture@example.invalid'',''not-a-signup-token'')'),'Legacy beta invitations remain open');
select pg_temp.assert_true(not has_function_privilege('docked_signup_worker','beta_private.begin_customer_signup_before_clean_transition(text,text)','execute'),'Legacy signup bypass exposed');
select pg_temp.assert_true(not exists(select 1 from private.consent_events where version not in(select version from beta_private.consent_events)),'Consent was fabricated');
select pg_temp.assert_true(not exists(select 1 from credits_sandbox.access where enabled),'Beta wallets remain available');
select pg_temp.assert_true(not exists(select 1 from credits_sandbox.trading_members where enabled),'Beta market remains available');
select pg_temp.assert_true((select count(*)>0 from launch_transition.historical_cards),'Historical card registry missing');
select pg_temp.assert_true(not exists(select 1 from commercial_billing.definitions d where d.issued<>d.legacy_issued+(select count(*)from beta_packs.issued b where b.definition=d.id)+(select count(*)from commercial_billing.cards c where c.definition=d.id) or d.issued>d.lifetime_cap),'Permanent supply mismatch');
select pg_temp.assert_true(not exists(select 1 from commercial_billing.definitions where lifetime_cap<>case rarity when 'RARE'then 5000 when 'ELITE'then 2500 when 'ULTRA_RARE'then 400 when 'LEGENDARY'then 50 when 'ICON'then 1 end),'Permanent caps changed');
select pg_temp.assert_true(not exists(select definition,serial from(select definition,serial from beta_packs.issued union all select definition,serial from commercial_billing.cards)x group by 1,2 having count(*)>1),'Duplicate serial');
select pg_temp.assert_true(not has_function_privilege('authenticated','launch_transition.prepare(jsonb,text,text,text)','execute'),'Customer can invoke transition');
select pg_temp.assert_true(not has_table_privilege('authenticated','private.roles','INSERT'),'Customer can grant Owner');
select pg_temp.assert_true(not has_function_privilege('docked_beta_app','beta_packs.assert_grant_before_clean_transition(uuid)','execute'),'Historical grant bypass exposed');
select pg_temp.assert_true(not has_function_privilege('docked_beta_app','operations.review_before_clean_transition(text,jsonb)','execute'),'Founder receipt guard bypass exposed');
select pg_temp.assert_true(pg_temp.denied('select launch_transition.complete((select batch from result))'),'Partial Auth retirement was accepted');
select pg_temp.assert_true(pg_temp.denied('update launch_transition.events set action=''FORGED'''),'Audit mutable');
select pg_temp.assert_true(pg_temp.denied('delete from launch_transition.historical_cards'),'Historical card registry mutable');
select pg_temp.assert_true(not exists(select * from original_audit except select * from private.audit_events),'Prior audit modified');
`;
for (const a of customers) {
  sql += `
select pg_temp.assert_true(not beta_private.admitted(${q(a.id)}::uuid),'Retired customer admitted');
select pg_temp.assert_true(not launch_transition.identity_allowed(${q(a.id)}::uuid),'Retired token can access');
select pg_temp.assert_true(pg_temp.denied(${q(`select launch_transition.record_auth_retired((select batch from result),${q(a.id)}::uuid)`)}),'Auth retirement accepted before provider completion');
`;
}
for (const a of owners) {
  sql += `
select set_config('request.jwt.claim.sub',${q(a.id)},true),set_config('request.jwt.claims',jsonb_build_object('sub',${q(a.id)},'session_id',(select id from auth.sessions where user_id=${q(a.id)}::uuid and aal='aal2'and(not_after is null or not_after>now())limit 1),'aal','aal2')::text,true);
select pg_temp.assert_true(beta_private.admitted(${q(a.id)}::uuid),'Owner admission lost');
select pg_temp.assert_true(beta_private.owner_gameplay_identity(${q(a.id)}::uuid),'Full Owner guard denied');
select pg_temp.assert_true(private.active_member_session(),'Owner public session denied');
select pg_temp.assert_true(operations.owner_actor()=${q(a.id)}::uuid,'Owner incidents denied');
select pg_temp.assert_true((operations.review('read')->>'recipient')='support@docked.com.au','Alert recipient changed');
select pg_temp.assert_true((commercial_billing.member_record('nfl')->>'total')::int=0,'Beta commercial collection carried forward');
select pg_temp.assert_true((commercial_billing.member_record('nfl')->>'entries')::int=0,'Beta fantasy carried forward');
select pg_temp.assert_true(not beta_packs.member_allowed(${q(a.id)}::uuid),'Owner beta pack advantage remains');
select pg_temp.assert_true(pg_temp.denied(${q(`select beta_packs.assert_grant(${q(a.id)}::uuid)`)}),'Owner free beta grant remains');
select pg_temp.assert_true((select count(*)=0 from commercial_billing.preserved_collection_rows(${q(a.id)}::uuid,'nfl')),'Historical collection leaked');
select pg_temp.assert_true(pg_temp.denied(${q(`select launch_transition.record_auth_retired((select batch from result),${q(a.id)}::uuid)`)}),'Owner retirement permitted');
select pg_temp.assert_true(beta_private.owner_operations(now()-interval '1 day',now(),null,true)is not null,'Owner reporting denied');
select set_config('request.jwt.claims',(auth.jwt()||'{"aal":"aal1"}')::text,true);
select pg_temp.assert_true(not private.active_member_session(),'Staff AAL1 accepted');
select pg_temp.assert_true(pg_temp.denied('select operations.review(''read'')'),'Incident AAL1 accepted');
`;
}
const barry = owners.find((a) => a.label === "Barry");
sql += `
select set_config('request.jwt.claim.sub',${q(barry.id)},true),set_config('request.jwt.claims',jsonb_build_object('sub',${q(barry.id)},'session_id',(select id from auth.sessions where user_id=${q(barry.id)}::uuid and aal='aal2'and(not_after is null or not_after>now())limit 1),'aal','aal2')::text,true);
select pg_temp.assert_true(pg_temp.denied('select operations.review(''confirm_delivery'',''{}'')'),'Barry attested founder inbox');
select operations.review('drill');
select operations.review('acknowledge',jsonb_build_object('code','support_delivery_drill','revision',(select revision from operations.incidents where code='support_delivery_drill'),'reason','Isolated Barry Owner acceptance'));
select operations.review('resolve',jsonb_build_object('code','support_delivery_drill','revision',(select revision from operations.incidents where code='support_delivery_drill'),'reason','Isolated review completed with no email'));
select pg_temp.assert_true((select count(*)=2 from operations.events where actor=${q(barry.id)}::uuid and reason in('Isolated Barry Owner acceptance','Isolated review completed with no email')),'Owner actor attribution incorrect');
select pg_temp.assert_true(not exists(select * from original_events except select * from operations.events),'Prior incident audit changed');
select pg_temp.assert_true(not exists(select * from original_beta_audit except select * from beta_private.audit_events),'Prior beta audit changed');
select pg_temp.assert_true(not exists(select * from original_admission_events except select * from beta_private.admission_events),'Prior admission history changed');
create temp table after_hashes as select * from pg_temp.capture();
select pg_temp.assert_true(not exists(select 1 from after_hashes a join original_hashes b using(name)where(a.hash,a.rows)is distinct from(b.hash,b.rows)and a.name<>all(array[
'beta_private.admission_control','beta_private.admission_events','beta_private.audit_events','public.profiles','private.roles','private.consent_events','public.notification_preferences','beta_private.roles','beta_public.profiles','beta_private.friends_roster','beta_private.named_tester_exception','credits_sandbox.access','credits_sandbox.trading_members','private.audit_events','operations.incidents','operations.events'${installed ? ", 'launch_transition.batches','launch_transition.accounts','launch_transition.historical_cards','launch_transition.events'" : ""}])),'Unexpected protected table drift: '||(select jsonb_agg(a.name order by a.name)::text from after_hashes a join original_hashes b using(name)where(a.hash,a.rows)is distinct from(b.hash,b.rows)));
select jsonb_build_object('passed',true,'protectedTables',(select count(*)from original_hashes),'expectedChangedTables',(select jsonb_agg(a.name order by a.name)from after_hashes a join original_hashes b using(name)where(a.hash,a.rows)is distinct from(b.hash,b.rows)),
'definitions',(select count(*)from commercial_billing.definitions),'lifetimeLimited',(select sum(issued)from commercial_billing.definitions),'historicalCards',(select count(*)from launch_transition.historical_cards),'copiedOwners',(select count(*)from public.profiles),'customerRetirements',(select count(*)from launch_transition.accounts where kind='customer'),'authDeleted',0,'externalDeliveries',0,'allChangesRolledBack',true);
rollback;
`;
writeFileSync(dir + "/rehearsal.private.sql", sql, { mode: 0o600 });
try {
  const out = run(sql);
  writeFileSync(dir + "/rehearsal-output.private.txt", out, { mode: 0o600 });
  const line = out.split("\n").findLast((l) => l.startsWith('{"passed"'));
  assert(line, "Missing acceptance result");
  const result = JSON.parse(line);
  writeFileSync(
    installed
      ? "docs/qa/clean-retirement-attestation-20261117/restored-database-tests.json"
      : "docs/qa/clean-transition-20261117/restored-database-tests.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        installedSchemaReused: installed,
        founderAttestationCheckpoint: installed,
        ...result,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(JSON.stringify(result));
} catch (e) {
  writeFileSync(
    dir + "/rehearsal-error.private.txt",
    String(e.stderr ?? e.stack),
    { mode: 0o600 },
  );
  console.error("Rehearsal rolled back. " + String(e.stderr ?? e.message));
  process.exitCode = 1;
}
