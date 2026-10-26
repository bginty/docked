-- Adopt the already-installed approved version, not a conversion of QA units.
-- One atomic migration; no application role gains any transition permission.
do $$
declare original text; temporary text; auth_guard text; c record; v text;
begin
 if session_user not in ('postgres','supabase_admin') then raise exception 'Database migration owner required';end if;
 perform pg_advisory_xact_lock(71820342);
 lock table beta_fantasy.competitions in share row exclusive mode;
 original:=pg_get_functiondef('sports_feed.australian_salary_transition_allowed(jsonb,jsonb)'::regprocedure);
 auth_guard:='not coalesce(beta_private.active_member_session(),false) or auth.jwt()->>''aal'' is distinct from ''aal2''
 or not exists(select 1 from beta_private.roles where user_id=auth.uid() and role=''owner'')';
 if position(auth_guard in original)=0 then raise exception 'Salary guard changed; review migration';end if;
 -- The temporary owner-only guard is invisible outside this transaction and is
 -- restored before commit. All date/entry/draft/lock/config checks remain real.
 temporary:=replace(original,auth_guard,'session_user not in (''postgres'',''supabase_admin'')');
 execute temporary;
 perform set_config('docked.australian_salary_reason','Owner authorised future Traditional salary correction 2026-10-26',true);
 for c in select id,sport,rules from beta_fantasy.competitions target
   where sport in ('afl','nrl') and rules->>'mode'='SALARY_CAP'
   and rules->>'lineup_version' in ('docked-afl-22-v1-qa','docked-nrl-13-v1-qa')
   and locks_at>clock_timestamp() and scored_at is null
   and not exists(select 1 from beta_fantasy.entries e where e.competition_id=target.id)
   and not exists(select 1 from beta_fantasy.round_drafts d where d.competition_id=target.id)
   and not exists(select 1 from beta_fantasy.slot_locks l where l.competition_id=target.id)
   for update
 loop
   v:='docked-australian-owner-2026-10-24-v1-'||c.sport;
   if not exists(select 1 from beta_fantasy.lineup_configurations where version=v) then raise exception 'Approved salary version missing';end if;
   update beta_fantasy.competitions set rules=jsonb_set(rules,'{lineup_version}',to_jsonb(v)) where id=c.id;
   insert into beta_private.audit_events(actor,action,subject,details) values('deployment:owner-authorised-2026-10-26','future_salary_adopted',c.id::text,jsonb_build_object('previous',c.rules->>'lineup_version','version',v,'reason','Approved fantasy dollars; no entries or drafts; prizes unchanged'));
 end loop;
 execute original;
 perform set_config('docked.australian_salary_reason','',true);
end$$;

-- Old generators may still supply the legacy QA template. Only new editable
-- rounds adopt the approved version; explicitly saved historical rounds do not.
create or replace function sports_feed.inherit_australian_salary_rules() returns trigger
language plpgsql security definer set search_path='' as $$
declare v text;
begin
 if new.sport not in ('afl','nrl') or new.locks_at<=clock_timestamp() or new.scored_at is not null
 or new.rules->>'mode' not in ('SALARY_CAP','OPEN')
 or new.rules->>'lineup_version' not in ('docked-afl-22-v1-qa','docked-nrl-13-v1-qa') then return new;end if;
 v:='docked-australian-owner-2026-10-24-v1-'||new.sport;
 if not exists(select 1 from beta_fantasy.lineup_configurations where version=v) then raise exception 'Approved salary version missing';end if;
 new.rules:=jsonb_set(new.rules,'{lineup_version}',to_jsonb(v));
 return new;
end$$;
revoke all on function sports_feed.inherit_australian_salary_rules() from public,anon,authenticated,service_role,docked_app,docked_beta_app;
drop trigger if exists australian_future_approved_salary on beta_fantasy.competitions;
create trigger australian_future_approved_salary before insert on beta_fantasy.competitions
for each row execute function sports_feed.inherit_australian_salary_rules();

