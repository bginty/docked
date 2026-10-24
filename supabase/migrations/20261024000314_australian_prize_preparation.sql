-- Inert preparation only: no published schedules, payouts, entries or inventory changes.
-- Narrow exception to immutable competition rules: approved salary-version adoption
-- on empty future rounds only. Both existing guards retain their old behaviour otherwise.
create function sports_feed.australian_salary_transition_allowed(previous jsonb, proposed jsonb) returns boolean
language plpgsql security definer set search_path='' as $$declare cid uuid:=(previous->>'id')::uuid;begin
 if not coalesce(beta_private.active_member_session(),false) or auth.jwt()->>'aal' is distinct from 'aal2'
 or not exists(select 1 from beta_private.roles where user_id=auth.uid() and role='owner')
 or length(coalesce(current_setting('docked.australian_salary_reason',true),''))<12
 or previous->>'sport' not in ('afl','nrl') or previous->>'scored_at' is not null
 or (previous->>'locks_at')::timestamptz<=clock_timestamp()
 or (previous-'rules') is distinct from (proposed-'rules')
 or ((previous->'rules')-'lineup_version') is distinct from ((proposed->'rules')-'lineup_version')
 or proposed->'rules'->>'lineup_version' is distinct from 'docked-australian-owner-2026-10-24-v1-'||(previous->>'sport')
 then return false;end if;
 perform pg_advisory_xact_lock(71820342);
 return not exists(select 1 from beta_fantasy.entries where competition_id=cid)
 and not exists(select 1 from beta_fantasy.round_drafts where competition_id=cid)
 and not exists(select 1 from beta_fantasy.slot_locks where competition_id=cid);
end$$;
revoke all on function sports_feed.australian_salary_transition_allowed(jsonb,jsonb) from public,anon,authenticated,service_role,docked_app,docked_beta_app;
do $$declare fn text;definition text;begin
 foreach fn in array array['beta_fantasy.competition_guard()','sports_feed.seven_competition_guard()'] loop
  definition:=pg_get_functiondef(fn::regprocedure);
  if position('begin' in definition)=0 then raise exception 'Expected immutable competition guard missing';end if;
  execute regexp_replace(definition,'begin','begin if sports_feed.australian_salary_transition_allowed(to_jsonb(old),to_jsonb(new)) then return new;end if;','i');
 end loop;
end$$;
alter table beta_fantasy.prize_schedules drop constraint prize_schedules_sport_check;
alter table beta_fantasy.prize_schedules add constraint prize_schedules_sport_check check(sport in ('nfl','football','afl','nrl'));
create or replace function beta_fantasy.validate_prizes(items jsonb) returns void
language plpgsql set search_path='' as $$declare item jsonb;other jsonb;seen jsonb:='[]';begin
 if items is null or jsonb_typeof(items)<>'array' or jsonb_array_length(items) not between 1 and 100 then raise exception 'Add 1 to 100 prize ranges';end if;
 for item in select value from jsonb_array_elements(items) loop
  if not(item ?& array['from','to','description','type','amount'])
   or jsonb_typeof(item->'from')<>'number' or jsonb_typeof(item->'to')<>'number'
   or jsonb_typeof(item->'description')<>'string' or jsonb_typeof(item->'type')<>'string'
   or (item->>'from')::numeric<>trunc((item->>'from')::numeric) or (item->>'to')::numeric<>trunc((item->>'to')::numeric)
   or (item->>'from')::integer<1 or (item->>'to')::integer<(item->>'from')::integer
   or (item->>'to')::integer>100000 or length(btrim(item->>'description')) not between 1 and 240
   or item->>'type' not in('credits','card','pack','other')
   or jsonb_typeof(item->'amount')<>'number' or (item->>'amount')::numeric<=0
   or (item->>'amount')::numeric>1000000000 or (item->>'amount')::numeric<>trunc((item->>'amount')::numeric)
  then raise exception 'Invalid prize range';end if;
  for other in select value from jsonb_array_elements(seen) loop
   if (item->>'from')::int<=(other->>'to')::int and (other->>'from')::int<=(item->>'to')::int
   and not(item->'from'=other->'from' and item->'to'=other->'to' and item->>'type'<>other->>'type')
    then raise exception 'overlapping prize ranges';end if;
  end loop;
  seen:=seen||jsonb_build_array(item);
 end loop;
end$$;
-- Reuse the existing optimistic revision, audit and publication service.
-- New sports may save drafts; publication requires a separately approved saved policy.
do $$declare definition text;needle text;replacement text;begin
 definition:=pg_get_functiondef('beta_fantasy.save_prize_schedule(uuid,text,jsonb,boolean,integer,text)'::regprocedure);
 needle:='if c.sport not in (''nfl'',''football'')';
 if position(needle in definition)=0 then raise exception 'Expected prize service version missing';end if;
 definition:=replace(definition,needle,'if c.sport not in (''nfl'',''football'',''afl'',''nrl'')');
 needle:='wanted_week:=case when p_scope=';
 replacement:=$guard$if c.sport in ('afl','nrl') then
   if c.scored_at is not null or c.locks_at<=clock_timestamp() then raise exception 'Historical prize rules are immutable';end if;
   if p_publish and (not coalesce((c.rules->'round_reward_policy'->>'active')::boolean,false)
    or c.rules->'round_reward_policy'->>'tiePolicy' is null
    or c.rules->'round_reward_policy'->'items' is distinct from p_items)
   then raise exception 'Approved activation and saved tie policy required; draft only';end if;
   if exists(select 1 from jsonb_array_elements(p_items) i where i->>'type'='pack' and
    coalesce(i->>'productVersion','') not in ('standard-9-'||c.sport||'-real-roster-beta-v1','premium-9-'||c.sport||'-real-roster-beta-v1'))
   then raise exception 'Correct sport-specific reward product required';end if;
  end if;
  wanted_week:=case when p_scope=$guard$;
 if position(needle in definition)=0 then raise exception 'Expected prize service statement missing';end if;
 execute replace(definition,needle,replacement);
end$$;
alter function beta_fantasy.admin_prizes() rename to admin_prizes_before_australian;
revoke all on function beta_fantasy.admin_prizes_before_australian() from public,anon,authenticated,service_role,docked_app,docked_beta_app;
create function beta_fantasy.admin_prizes() returns jsonb language plpgsql security definer set search_path='' as $$declare answer jsonb;begin
 perform beta_fantasy.member_release_admin();
 answer:=beta_fantasy.admin_prizes_before_australian();
 return answer||jsonb_build_object(
  'templates',coalesce((select jsonb_agg(configuration order by version) from sports_feed.australian_prize_rules),'[]'),
  'rewardAudit',coalesce((select jsonb_agg(r.value) from credits_sandbox.state s cross join lateral jsonb_each(coalesce(s.document->'roundRewards','{}')) r where s.id),'[]'));
end$$;
revoke all on function beta_fantasy.admin_prizes() from public,anon,authenticated,service_role,docked_app;
grant execute on function beta_fantasy.admin_prizes() to docked_beta_app;
