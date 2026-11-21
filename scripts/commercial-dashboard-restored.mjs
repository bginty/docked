import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {execFileSync} from "node:child_process";
import fs from "node:fs";
const target=process.argv[2];
assert.match(target??"",/^docked-commercial-restore-20[0-9]{6}[a-z]$/);
const inspect=JSON.parse(execFileSync("docker",["inspect",target],{encoding:"utf8"}))[0];
assert.equal(inspect.HostConfig.NetworkMode,"none");
assert.equal(Object.keys(inspect.HostConfig.PortBindings??{}).length,0);
const id=randomUUID(), session=randomUUID();
const migration=fs.readFileSync("supabase/migrations/20261121021000_owner_commercial_summary.sql","utf8");
const sql=`begin;
do $$begin if current_setting('cron.launch_active_jobs') <> 'off' then raise exception 'Scheduled jobs must be disabled';end if;end$$;
${migration}
insert into auth.users(id,email,email_confirmed_at,is_anonymous) values('${id}','owner-report-${id}@example.invalid' ,now(),false);
insert into auth.sessions(id,user_id,created_at,updated_at) values('${session}','${id}',now(),now());
insert into public.profiles(id,country,state,age_attested,accepted_version) values('${id}','AU','NSW',true,'isolated-reporting-test');
insert into private.roles(user_id,role) values('${id}','owner');
create temporary table expected_summary as select
  (select coalesce(sum(l.amount) filter(where l.amount>0),0) from commercial_billing.lines l join commercial_billing.journals j on j.id=l.journal join commercial_billing.receipts r on r.key=j.receipt where l.account='provider:google:receivable' and j.unit='AUD_CENTS' and r.environment='commercial' and r.money_recorded and j.created_at>=now()-interval '30 days' and j.created_at<now()) gross,
  (select count(*) from commercial_billing.packs where created_at>=now()-interval '30 days' and created_at<now()) packs;
grant select on expected_summary to docked_app;
set local role docked_app;
select set_config('request.jwt.claim.sub','${id}',true),set_config('request.jwt.claims','{"sub":"${id}","session_id":"${session}","aal":"aal1"}',true);
do $$begin
  begin perform private.owner_commercial_summary(now()-interval '30 days',now());raise exception 'Missing MFA enforcement';
  exception when others then if sqlerrm <> 'Active Owner MFA required' then raise; end if;end;
end$$;
select set_config('request.jwt.claims','{"sub":"${id}","session_id":"${session}","aal":"aal2"}',true);
do $$declare s jsonb; x expected_summary%rowtype;begin
  select * into strict x from expected_summary;
  s:=private.owner_commercial_summary(now()-interval '30 days',now());
  if (select sum((d->>'sales')::bigint) from jsonb_array_elements(s->'days') d) is distinct from x.gross then raise exception 'Sales mismatch'; end if;
  if (select coalesce(sum((d->>'total')::bigint),0) from jsonb_array_elements(s->'packs') d) is distinct from x.packs then raise exception 'Pack count mismatch'; end if;
  if s->>'verified' is null or s->>'outstanding' is null then raise exception 'Required aggregate missing'; end if;
end$$;
rollback;
`;
execFileSync("docker",["exec","-i",target,"psql","-X","-v","ON_ERROR_STOP=1","-h","/restore","-U","postgres","-q","-o","/dev/null"],{input:sql,stdio:["pipe","ignore","pipe"]});
console.log("PASS restored Production schema, AAL1 denial, synthetic AAL2 Owner, independently reconciled gross charges and packs; transaction rolled back.");
