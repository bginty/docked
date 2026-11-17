/** Offline rehearsal only. Never connects to a hosted database or Auth API. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
const target = "docked-commercial-restore-20261117g";
const info = JSON.parse(
  execFileSync("docker", ["inspect", target], {
    encoding: "utf8",
    windowsHide: true,
  }),
)[0];
assert.equal(info.HostConfig.NetworkMode, "none");
assert.equal(Object.keys(info.HostConfig.PortBindings ?? {}).length, 0);
assert(info.HostConfig.Tmpfs["/restore"]);
const run = (sql) =>
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
      "-X",
      "-qAt",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    { input: sql, encoding: "utf8", windowsHide: true, maxBuffer: 16e6 },
  ).trim();
const before = run("select launch_transition.source_digest();");
assert.equal(run("select count(*) from launch_transition.accounts;"), "6");
const files = [
  "supabase/migrations/20261116215032_public_sms_budget_guard.sql",
  "supabase/migrations/20261117091440_public_owner_support.sql",
];
const check = (body) => `do $test$ begin ${body} end $test$;`;
const denied = (sql) =>
  check(
    `begin ${sql}; raise exception 'Unexpected acceptance';exception when insufficient_privilege then null;when raise_exception then if sqlerrm='Unexpected acceptance' then raise;end if;end;`,
  );
const installed = run("select to_regnamespace('sms_delivery') is not null;") === 't';
if (installed) {
 for (const file of files) {
  const version = file.split('/').at(-1).split('_')[0];
  const stored = run(`select encode(sha256(convert_to(statements[1],'UTF8')),'hex') from supabase_migrations.schema_migrations where version='${version}';`);
  assert.equal(stored,createHash('sha256').update(readFileSync(file)).digest('hex'));
 }
}
let sql = "begin;\n" + (installed ? "" : files.map((f) => readFileSync(f, "utf8")).join("\n")) + "\n";
sql += check(
  `if has_function_privilege('authenticated','private.admin_search(text,text,integer)','execute') or has_table_privilege('docked_app','private.owner_support_events','select') or has_table_privilege('docked_app','commercial_billing.receipts','select') then raise exception 'Excess runtime grants';end if;`,
);
sql += `insert into auth.users(id,email,email_confirmed_at,created_at,updated_at,role,aud) values('aaaaaaaa-0000-4000-8000-000000000001','public-support-test@synthetic.invalid',now(),now(),now(),'authenticated','authenticated');
insert into public.profiles(id,country,state,age_attested,accepted_version) values('aaaaaaaa-0000-4000-8000-000000000001','AU','NSW',true,'isolated-test');
insert into private.social_profiles(user_id,handle,display_name,bio) values('aaaaaaaa-0000-4000-8000-000000000001','testplayer','Test Player','Preserve customer history');
insert into sms_delivery.windows(id,enabled,starts_at,expires_at,budget_aud_cents,authority_reference,price_evidence_reference) values('isolated-owner-test',true,now()-interval '1 minute',now()+interval '1 hour',200,repeat('a',64),repeat('b',64));
create temp table test_actor as select p.id,s.id session from public.profiles p join private.roles r on r.user_id=p.id join lateral(select id from auth.sessions where user_id=p.id and aal='aal2' and(not_after is null or not_after>now()) limit 1)s on true where r.role='owner';
grant select on test_actor to docked_app;
`;
sql += check(
  `if(select count(*) from test_actor)<>2 then raise exception 'Expected both retained owners';end if;`,
);
sql +=
  `set local role docked_app;` +
  denied("perform private.admin_search('Customer')") +
  `reset role;`;
sql += `do $test$ declare a record; result jsonb; stamp text; begin
for a in select * from test_actor loop
 perform set_config('request.jwt.claim.sub',a.id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a.id,'session_id',a.session,'aal','aal2')::text,true);
 set local role docked_app;
 result:=private.owner_command_centre(now()-interval '1 day',now()+interval '1 minute');
 if result->>'scope'<>'live' or jsonb_array_length(result->'inventory')<>6540 then raise exception 'Public inventory report failed';end if;
 if jsonb_array_length(private.admin_search('Customer','members'))<1 then raise exception 'Commercial customer search failed';end if;
 result:=private.admin_record_detail('members','aaaaaaaa-0000-4000-8000-000000000001');
 if result#>>'{fields,Commercial credits}'<>'0' or result#>>'{fields,Commercial cards}'<>'0' then raise exception 'Inherited beta asset';end if;
 if result::text like '%encrypted_reference%' or result::text like '%@synthetic.invalid%' then raise exception 'Sensitive projection';end if;
 perform private.owner_support_command(jsonb_build_object('request',gen_random_uuid(),'action','note','target','aaaaaaaa-0000-4000-8000-000000000001','expectedDisabledAt',null,'reason','Isolated customer recovery evidence; no identity reset'));
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a.id,'session_id',a.session,'aal','aal1')::text,true);
 begin perform private.admin_search('Customer');raise exception 'AAL1 accepted';exception when raise_exception then if sqlerrm<>'Active Owner MFA required' then raise;end if;end;
 reset role;
end loop;
end $test$;
select set_config('request.jwt.claim.sub',(select id::text from test_actor limit 1),true),set_config('request.jwt.claims',(select jsonb_build_object('sub',id,'session_id',session,'aal','aal2')::text from test_actor limit 1),true);
set local role docked_app;
select private.owner_support_command('{"request":"bbbbbbbb-0000-4000-8000-000000000001","action":"restrict_customer","target":"aaaaaaaa-0000-4000-8000-000000000001","expectedDisabledAt":null,"reason":"Isolated support restriction test"}');
select private.owner_support_command('{"request":"bbbbbbbb-0000-4000-8000-000000000001","action":"restrict_customer","target":"aaaaaaaa-0000-4000-8000-000000000001","expectedDisabledAt":null,"reason":"Isolated support restriction test"}');
`;
sql += denied(
  `perform private.owner_support_command(jsonb_build_object('request',gen_random_uuid(),'action','restore_customer','target','aaaaaaaa-0000-4000-8000-000000000001','expectedDisabledAt',null,'reason','Reject stale customer state'))`,
);
sql +=
  `reset role;` +
  check(
    `if(select count(*) from private.owner_support_events where action='restrict_customer')<>1 then raise exception 'Duplicate action';end if;`,
  );
sql += check(`if launch_transition.identity_allowed('aaaaaaaa-0000-4000-8000-000000000001') or exists(select 1 from public.profiles where id='aaaaaaaa-0000-4000-8000-000000000001' and disabled_at is not null) or not exists(select 1 from private.social_profiles where user_id='aaaaaaaa-0000-4000-8000-000000000001' and bio='Preserve customer history' and status='active') then raise exception 'Restriction is destructive or admission remains open';end if;`);
sql += `select set_config('test.disabled_at',(select to_jsonb(restricted_at)#>>'{}' from private.owner_customer_restrictions where user_id='aaaaaaaa-0000-4000-8000-000000000001'),true);
set local role docked_app;select private.owner_support_command(jsonb_build_object('request',gen_random_uuid(),'action','restore_customer','target','aaaaaaaa-0000-4000-8000-000000000001','expectedDisabledAt',current_setting('test.disabled_at'),'reason','Isolated reviewed access restoration'));
select private.owner_support_command(jsonb_build_object('request',gen_random_uuid(),'action','emergency_pause','target',null,'expectedDisabledAt',null,'reason','Isolated emergency pause verification'));
reset role;
`;
sql += check(
  `if exists(select 1 from sms_delivery.windows where enabled) or exists(select 1 from commercial_billing.control where sales_enabled or issuance_enabled or transfers_enabled or gameplay_enabled) then raise exception 'Pause incomplete';end if;`,
);
sql += `select set_config('test.owner_id',(select id::text from test_actor limit 1),true);set local role docked_app;`;
sql += denied(`perform private.owner_support_command(jsonb_build_object('request',gen_random_uuid(),'action','restrict_customer','target',current_setting('test.owner_id'),'expectedDisabledAt',null,'reason','Cannot restrict a protected Owner'))`);
sql += denied(`perform private.owner_support_command(jsonb_build_object('request',gen_random_uuid(),'action','enable_sales','target',null,'reason','No enable command exists'))`);
sql += denied(`perform private.owner_support_command(jsonb_build_object('request',gen_random_uuid(),'action','note','target','aaaaaaaa-0000-4000-8000-000000000001','reason','Cannot impersonate another actor','actor',current_setting('test.owner_id')))`);
sql += denied(`perform private.owner_support_command('{"request":"bbbbbbbb-0000-4000-8000-000000000001","action":"note","target":"aaaaaaaa-0000-4000-8000-000000000001","reason":"Changed request cannot mutate"}')`);
sql += `reset role;`;
sql += check(`if not launch_transition.identity_allowed('aaaaaaaa-0000-4000-8000-000000000001') or not exists(select 1 from private.social_profiles where user_id='aaaaaaaa-0000-4000-8000-000000000001' and bio='Preserve customer history' and status='active') then raise exception 'Restoration lost identity or history';end if;`);
sql += denied(`delete from private.owner_support_events`);
sql += `update sms_delivery.windows set enabled=true;`;
sql += `do $test$ declare a record; decision text;begin
for a in select user_id,kind from launch_transition.accounts loop
 decision:=sms_delivery.reserve('isolated-owner-test',encode(extensions.digest(a.user_id::text,'sha256'),'hex'),a.user_id);
 if decision is distinct from (case when a.kind='owner' then 'send' else 'denied' end) then raise exception 'Retired/QA SMS boundary failed';end if;
end loop;end $test$;
rollback;`;
mkdirSync("private-data/public-launch-runtime-20261117", { recursive: true });
try {
  run(sql);
} catch (e) {
  writeFileSync(
    "private-data/public-launch-runtime-20261117/rehearsal-error.private.txt",
    String(e.stderr ?? e),
  );
  throw Error("Isolated rehearsal failed; private diagnostic retained");
}
assert.equal(run("select launch_transition.source_digest();"), before);
assert.equal(run("select to_regnamespace('sms_delivery') is not null;"),installed?'t':'f');
if(installed) assert.equal(run("select (select count(*) from private.owner_customer_restrictions)+(select count(*) from private.owner_support_events)+(select count(*) from sms_delivery.windows);"),'0');
const evidence = {
  at: new Date().toISOString(),
  container: target,
  network: "none",
  productionWrites: 0,
  smsSent: 0,
  existingOwners: 2,
  checks: [
    "public restricted Owner report/search/detail",
    "zero inherited assets",
    "AAL1 and anonymous denied",
    "runtime direct table access denied",
    "support notes audited",
    "non-destructive restriction/restore with live identity denial and optimistic state",
    "request idempotency",
    "immutable support history",
    "Owner restriction, enable command, extra actor and changed-request rejection",
    "emergency pause only",
    "retired and QA SMS denied",
    "rollback preserves original financial/custody/supply digest",
  ],
  files: files.map((path) => ({
    path,
    sha256: createHash("sha256").update(readFileSync(path)).digest("hex"),
  })),
  passed: true,
};
mkdirSync("docs/qa/public-launch-runtime-20261117", { recursive: true });
writeFileSync(
  "docs/qa/public-launch-runtime-20261117/restored-tests.json",
  JSON.stringify(evidence, null, 2) + "\n",
);
console.log(JSON.stringify(evidence));
