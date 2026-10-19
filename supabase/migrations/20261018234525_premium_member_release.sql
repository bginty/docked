-- Inert installation: no prize payout, pack activation, minting or wallet changes.
create table if not exists beta_fantasy.prize_schedules (
 id uuid primary key default gen_random_uuid(),
 sport text not null check(sport in ('nfl','football')),
 mode text not null check(mode in ('SALARY_CAP','OPEN')),
 season text not null,
 scope text not null check(scope in ('weekly','season')),
 week integer not null check(week>=0),
 competition_id uuid not null references beta_fantasy.competitions(id),
 draft jsonb not null,
 published jsonb,
 effective_at timestamptz,
 revision integer not null default 1,
 check((scope='weekly' and week>0) or (scope='season' and week=0)),
 check((published is null)=(effective_at is null)),
 unique(sport,mode,season,scope,week)
);
alter table beta_fantasy.prize_schedules enable row level security;
revoke all on beta_fantasy.prize_schedules from public,anon,authenticated,service_role,docked_app,docked_beta_app;

create or replace function beta_fantasy.member_release_admin() returns void
language plpgsql security definer set search_path='' as $$begin
 if not coalesce(beta_private.active_member_session(),false) or coalesce(auth.jwt()->>'aal','')<>'aal2'
 or not exists(select 1 from beta_private.roles where user_id=auth.uid() and role in ('owner','admin')) then
 raise exception 'Administrator MFA required';end if;
end$$;
create or replace function beta_fantasy.validate_prizes(items jsonb) returns void
language plpgsql set search_path='' as $$declare item jsonb; previous_end integer:=0;begin
 if items is null or jsonb_typeof(items)<>'array' or jsonb_array_length(items) not between 1 and 100 then raise exception 'Add 1 to 100 prize ranges';end if;
 for item in select value from jsonb_array_elements(items) order by (value->>'from')::integer loop
  if not (item ?& array['from','to','description','type','amount'])
   or jsonb_typeof(item->'from')<>'number' or jsonb_typeof(item->'to')<>'number'
   or jsonb_typeof(item->'description')<>'string' or jsonb_typeof(item->'type')<>'string'
   or (item->>'from')::numeric<>trunc((item->>'from')::numeric) or (item->>'to')::numeric<>trunc((item->>'to')::numeric)
   or (item->>'from')::integer<=previous_end or (item->>'to')::integer<(item->>'from')::integer
   or (item->>'to')::integer>100000 or length(btrim(item->>'description')) not between 1 and 240
   or item->>'type' not in ('credits','card','pack','other')
   or jsonb_typeof(item->'amount')<>'number' or (item->>'amount')::numeric<=0
   or (item->>'amount')::numeric>1000000000
   or (item->>'amount')::numeric<>trunc((item->>'amount')::numeric)
   then raise exception 'Invalid or overlapping prize ranges';end if;
  previous_end:=(item->>'to')::integer;
 end loop;
end$$;
create or replace function beta_fantasy.save_prize_schedule(p_competition uuid,p_scope text,p_items jsonb,p_publish boolean,p_revision integer,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c beta_fantasy.competitions;s beta_fantasy.prize_schedules; old_value jsonb;wanted_week integer;begin
 perform beta_fantasy.member_release_admin();
 if p_reason is null or length(btrim(p_reason)) not between 1 and 500 or p_scope not in ('weekly','season') or p_scope is null or p_publish is null then raise exception 'Scope and reason required';end if;
 perform beta_fantasy.validate_prizes(p_items);
 select * into strict c from beta_fantasy.competitions where id=p_competition;
 if c.sport not in ('nfl','football') or coalesce(c.rules->>'mode','') not in ('SALARY_CAP','OPEN') then raise exception 'Unsupported competition';end if;
 wanted_week:=case when p_scope='weekly' then c.round else 0 end;
 perform pg_advisory_xact_lock(hashtextextended('prizes:'||c.sport||':'||(c.rules->>'mode')||':'||c.season||':'||p_scope||':'||wanted_week,762));
 select * into s from beta_fantasy.prize_schedules where sport=c.sport and mode=c.rules->>'mode' and season=c.season and scope=p_scope and week=wanted_week for update;
 if coalesce(s.revision,0) is distinct from p_revision then raise exception 'Schedule changed; refresh before saving';end if;
 old_value:=case when s.id is null then null else to_jsonb(s) end;
 insert into beta_fantasy.prize_schedules(sport,mode,season,scope,week,competition_id,draft,published,effective_at)
 values(c.sport,c.rules->>'mode',c.season,p_scope,wanted_week,c.id,p_items,case when p_publish then p_items end,case when p_publish then clock_timestamp() end)
 on conflict(sport,mode,season,scope,week) do update set draft=excluded.draft,
 published=case when p_publish then excluded.draft else beta_fantasy.prize_schedules.published end,
 effective_at=case when p_publish then clock_timestamp() else beta_fantasy.prize_schedules.effective_at end,
 revision=beta_fantasy.prize_schedules.revision+1 returning * into s;
 insert into beta_private.audit_events(actor,action,subject,details) values(auth.uid()::text,case when p_publish then 'prize_schedule_published' else 'prize_schedule_drafted' end,s.id::text,jsonb_build_object('previous',old_value,'resulting',to_jsonb(s),'reason',btrim(p_reason)));
 return to_jsonb(s);
end$$;
create or replace function beta_fantasy.member_prizes() returns jsonb language plpgsql security definer set search_path='' as $$begin
 if not coalesce(beta_private.active_member_session(),false) then raise exception 'Active admitted session required';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'sport',sport,'mode',mode,'season',season,'scope',scope,'week',week,'items',published)) from beta_fantasy.prize_schedules where published is not null and effective_at<=clock_timestamp()),'[]');
end$$;
create or replace function beta_fantasy.admin_prizes() returns jsonb language plpgsql security definer set search_path='' as $$begin
 perform beta_fantasy.member_release_admin();
 return jsonb_build_object('schedules',coalesce((select jsonb_agg(to_jsonb(s)) from beta_fantasy.prize_schedules s),'[]'),
 'competitions',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'sport',sport,'season',season,'week',round,'mode',rules->>'mode')) from beta_fantasy.competitions where rules->>'mode' in ('SALARY_CAP','OPEN')),'[]'),
 'names',coalesce((select jsonb_agg(jsonb_build_object('user',user_id,'name',name)) from beta_fantasy.team_names),'[]'),
 'audit',coalesce((select jsonb_agg(to_jsonb(a)) from (select actor,action,subject,details,created_at from beta_private.audit_events where action in ('prize_schedule_drafted','prize_schedule_published','team_name_admin_changed') order by created_at desc limit 100)a),'[]'));
end$$;
revoke all on function beta_fantasy.member_release_admin(),beta_fantasy.validate_prizes(jsonb),beta_fantasy.save_prize_schedule(uuid,text,jsonb,boolean,integer,text),beta_fantasy.member_prizes(),beta_fantasy.admin_prizes() from public,anon,authenticated,service_role,docked_app,docked_beta_app;
grant execute on function beta_fantasy.save_prize_schedule(uuid,text,jsonb,boolean,integer,text),beta_fantasy.member_prizes(),beta_fantasy.admin_prizes() to docked_beta_app;

-- team_names contains only explicit name_team saves, never generated profile labels.
-- Existing rows are preserved exactly and become established names.
create or replace function beta_fantasy.name_team(p_name text,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;prior beta_fantasy.requests;answer jsonb;payload jsonb;begin
 u:=beta_fantasy.production_eligible();
 if u is null or not beta_private.active_member_session() or not exists(select 1 from sports_feed.nfl_control where enabled) then raise exception 'Active NFL member required';end if;
 if p_request is null or p_name is null or p_name<>btrim(p_name) or length(p_name) not between 2 and 40 or p_name !~ '^[A-Za-z0-9][A-Za-z0-9 .''-]*$' then raise exception 'Use 2 to 40 letters, numbers, spaces or simple punctuation';end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,761));
 payload:=jsonb_build_object('name',p_name);
 select * into prior from beta_fantasy.requests where user_id=u and request_id=p_request;
 if found then if prior.action<>'name_team' or prior.payload<>payload then raise exception 'Request ID reused';end if;return prior.result;end if;
 if exists(select 1 from beta_fantasy.team_names where user_id=u) then raise exception 'Your team name is permanent. Contact an administrator for a correction.';end if;
 insert into beta_fantasy.members(user_id,expires_at) values(u,'infinity') on conflict do nothing;
 insert into beta_fantasy.team_names(user_id,name) values(u,p_name);
 answer:=jsonb_build_object('saved',true,'name',p_name);
 insert into beta_private.audit_events(actor,action,subject,details) values(u::text,'beta_team_named',u::text,jsonb_build_object('previous',null,'resulting',p_name,'request',p_request));
 insert into beta_fantasy.requests values(u,p_request,'name_team',payload,answer);
 return answer;
end$$;
create or replace function beta_fantasy.established_name_guard() returns trigger language plpgsql security definer set search_path='' as $$declare reason text;begin
 if tg_op='DELETE' then raise exception 'Established team names cannot be deleted';end if;
 perform beta_fantasy.member_release_admin();
 reason:=current_setting('docked.team_name_reason',true);
 if reason is null or length(btrim(reason)) not between 1 and 500 or new.user_id<>old.user_id then raise exception 'Audited administrator change required';end if;
 if new.name is null or new.name<>btrim(new.name) or length(new.name) not between 2 and 40 or new.name !~ '^[A-Za-z0-9][A-Za-z0-9 .''-]*$' then raise exception 'Invalid team name';end if;
 insert into beta_private.audit_events(actor,action,subject,details) values(auth.uid()::text,'team_name_admin_changed',old.user_id::text,jsonb_build_object('previous',old.name,'resulting',new.name,'reason',btrim(reason)));
 new.updated_at:=clock_timestamp();return new;
end$$;
drop trigger if exists established_name_guard on beta_fantasy.team_names;
create trigger established_name_guard before update or delete on beta_fantasy.team_names for each row execute function beta_fantasy.established_name_guard();
create or replace function beta_fantasy.admin_name_team(p_user uuid,p_name text,p_previous text,p_reason text) returns void language plpgsql security definer set search_path='' as $$begin
 perform beta_fantasy.member_release_admin();
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,761));
 if p_reason is null or length(btrim(p_reason)) not between 1 and 500 then raise exception 'Reason required';end if;
 perform set_config('docked.team_name_reason',p_reason,true);
 update beta_fantasy.team_names set name=p_name where user_id=p_user and name=p_previous;
 if not found then raise exception 'Established name changed; refresh before correcting it';end if;
end$$;
revoke all on function beta_fantasy.established_name_guard(),beta_fantasy.admin_name_team(uuid,text,text,text) from public,anon,authenticated,service_role,docked_app,docked_beta_app;
grant execute on function beta_fantasy.admin_name_team(uuid,text,text,text) to docked_beta_app;

create table if not exists sports_feed.weekly_core_job_runs(
 id uuid primary key default gen_random_uuid(),started_at timestamptz not null default clock_timestamp(),
 finished_at timestamptz,issued integer not null default 0,failures integer not null default 0,
 status text not null check(status in ('running','complete','partial','disabled'))
);
create table if not exists sports_feed.weekly_core_job_failures(
 run_id uuid not null references sports_feed.weekly_core_job_runs,user_id uuid not null references auth.users,
 occurred_at timestamptz not null default clock_timestamp(),sqlstate text not null,
 primary key(run_id,user_id)
);
alter table sports_feed.weekly_core_job_runs enable row level security;
alter table sports_feed.weekly_core_job_failures enable row level security;
revoke all on sports_feed.weekly_core_job_runs,sports_feed.weekly_core_job_failures from public,anon,authenticated,service_role,docked_app,docked_beta_app,docked_nfl_worker;
create or replace function sports_feed.weekly_core_job() returns integer language plpgsql security definer set search_path='' as $$
declare r record; run uuid; n integer:=0; failure_count integer:=0;begin
 perform pg_advisory_xact_lock(71820342);
 if not exists(select 1 from sports_feed.weekly_core_control where enabled) then return 0;end if;
 insert into sports_feed.weekly_core_job_runs(status) values('running') returning id into run;
 for r in select a.user_id from credits_sandbox.access a left join sports_feed.weekly_core_schedules s using(user_id)
 where a.enabled and sports_feed.weekly_core_allowed(a.user_id)
 and (s.user_id is null or s.enrolled_at+s.next_period*interval '604800 seconds'<=clock_timestamp())
 order by s.enrolled_at+s.next_period*interval '604800 seconds' nulls first,a.user_id limit 100 loop
  begin n:=n+sports_feed.weekly_core_reconcile(r.user_id);
  exception when others then
   failure_count:=failure_count+1;
   insert into sports_feed.weekly_core_job_failures(run_id,user_id,sqlstate) values(run,r.user_id,sqlstate);
  end;
 end loop;
 update sports_feed.weekly_core_job_runs set finished_at=clock_timestamp(),issued=n,failures=failure_count,status=case when failure_count>0 then 'partial' else 'complete' end where id=run;
 return n;
end$$;
-- Account setup may finish before or after the access row is granted. Reconcile
-- after either transition; the existing eligibility predicate gates all issuance.
create or replace function sports_feed.weekly_core_setup() returns trigger language plpgsql security definer set search_path='' as $$declare u uuid;begin
 u:=case when tg_table_schema='beta_public' then (to_jsonb(new)->>'id')::uuid else (to_jsonb(new)->>'user_id')::uuid end;
 if u is not null then perform sports_feed.weekly_core_reconcile(u);end if;
 return new;
end$$;
drop trigger if exists weekly_core_setup on beta_public.profiles;
create trigger weekly_core_setup after insert or update on beta_public.profiles for each row execute function sports_feed.weekly_core_setup();
drop trigger if exists weekly_core_setup on credits_sandbox.access;
create trigger weekly_core_setup after insert or update on credits_sandbox.access for each row execute function sports_feed.weekly_core_setup();
drop trigger if exists weekly_core_setup on beta_private.admissions;
create trigger weekly_core_setup after insert or update on beta_private.admissions for each row execute function sports_feed.weekly_core_setup();
revoke all on function sports_feed.weekly_core_setup() from public,anon,authenticated,service_role,docked_app,docked_beta_app,docked_nfl_worker;
-- Scheduler installation/activation is a separate operator step. This migration
-- deliberately does not enable weekly_core_control or create active cron jobs.
