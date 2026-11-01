-- Public customer preparation. No existing programme, account or round is changed.
-- Created with the CLI, sequenced after the two pending commercial migrations.
create schema if not exists public_gameplay;
revoke all on schema public_gameplay from public,anon,authenticated,service_role;
create table if not exists public_gameplay.policy(
 id boolean primary key default true check(id), enabled boolean not null default false,
 terms_version text, privacy_version text, valid_until timestamptz,
 authority text, version text not null default 'au-adult-free-play-v1' check(version='au-adult-free-play-v1')
);
insert into public_gameplay.policy(id) values(true) on conflict do nothing;
create table if not exists public_gameplay.sports(
 sport text primary key check(sport in('nfl','afl','nrl')),
 visible boolean not null default false, play_enabled boolean not null default false
);
insert into public_gameplay.sports(sport) values('nfl'),('afl'),('nrl') on conflict do nothing;
create table if not exists public_gameplay.rounds(
 competition_id uuid primary key references beta_fantasy.competitions,
 sport text not null references public_gameplay.sports,
 enabled boolean not null default false,
 rules_hash text not null check(rules_hash ~ '^[a-f0-9]{32}$'),
 fixtures jsonb not null check(jsonb_typeof(fixtures)='array' and jsonb_array_length(fixtures)>0),
 fixture_kind text not null check(fixture_kind in('practice','verified')),
 source_reference text not null check(length(source_reference)>10),
 created_at timestamptz not null default clock_timestamp()
);
do $$declare t text;begin foreach t in array array['policy','sports','rounds'] loop
 execute format('alter table public_gameplay.%I enable row level security',t);
 execute format('revoke all on public_gameplay.%I from public,anon,authenticated,service_role,docked_app,docked_beta_app,docked_commercial_app',t);
end loop;end$$;

-- Current DB state, never editable JWT metadata. Ordinary members need AAL1;
-- staff always need AAL2. A later unapproved regional policy supersedes an older one.
create or replace function public_gameplay.identity() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid();begin
 if current_setting('docked.public_gameplay',true) is distinct from 'enabled' or u is null
 or not private.active_member_session() or not exists(
  select 1 from public_gameplay.policy g join public.profiles p on p.id=u
  join auth.users a on a.id=p.id
  join lateral(select r.* from private.region_policies r where r.country=p.country and r.state=p.state
   and r.effective_from<=clock_timestamp() and r.effective_to>clock_timestamp() order by r.effective_from desc,r.id desc limit 1) r on true
  where g.id and g.enabled and g.valid_until>clock_timestamp() and length(g.authority)>10
   and g.terms_version is not null and g.privacy_version is not null
   and p.country='AU' and p.state in('ACT','NSW','NT','QLD','SA','TAS','VIC','WA')
   and p.age_attested and p.disabled_at is null and p.accepted_version=g.terms_version
   and r.approved and r.minimum_age=18 and not r.preview_community_only and r.review_at>clock_timestamp()
   and a.email_confirmed_at is not null and not coalesce(a.is_anonymous,false)
   and (a.banned_until is null or a.banned_until<=clock_timestamp())
   and exists(select 1 from private.consent_events c where c.user_id=u and c.purpose='privacy' and c.granted and c.version=g.privacy_version
    and c.id=(select id from private.consent_events where user_id=u and purpose='privacy' order by created_at desc,id desc limit 1))
   and (not exists(select 1 from private.roles where user_id=u) or auth.jwt()->>'aal'='aal2')
 ) then raise exception 'Current Australian adult account, consent and session required';end if;
 return u;
end$$;
create or replace function public_gameplay.session_allowed() returns boolean
language plpgsql stable security definer set search_path='' as $$begin
 if current_setting('docked.public_gameplay',true)='enabled' then perform public_gameplay.identity();return true;end if;
 return beta_private.active_member_session();end$$;
create or replace function public_gameplay.round_allowed(cid uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$begin
 perform public_gameplay.identity();
 return exists(select 1 from public_gameplay.rounds r join public_gameplay.sports s on s.sport=r.sport
  join beta_fantasy.competitions c on c.id=r.competition_id
  where c.id=cid and r.enabled and s.visible and s.play_enabled and c.sport=r.sport
  and r.rules_hash=md5(c.rules::text) and c.awards='[]'::jsonb and c.prize='No cash prize'
  and c.rules->>'public_access_policy'='au-adult-free-play-v1' and c.rules->>'entry_fee_credits'='0'
  and c.rules->>'free_core_policy'='public-free-core-v1' and c.rules->>'lock_policy'='round-wide-v1'
  and not exists(select 1 from beta_fantasy.round_controls where competition_id=cid and not enabled));
end$$;
create or replace function public_gameplay.round_guard() returns trigger
language plpgsql security definer set search_path='' as $$declare c beta_fantasy.competitions;begin
 select * into strict c from beta_fantasy.competitions where id=new.competition_id;
 if tg_op='INSERT' and (c.locks_at<=clock_timestamp() or c.scored_at is not null
  or exists(select 1 from beta_fantasy.entries where competition_id=c.id)
  or exists(select 1 from beta_fantasy.round_drafts where competition_id=c.id)) then raise exception 'New unentered future round required';end if;
 if tg_op='UPDATE' and (to_jsonb(new)-'enabled') is distinct from (to_jsonb(old)-'enabled') then raise exception 'Published round binding immutable';end if;
 if c.sport<>new.sport or c.awards<>'[]'::jsonb or c.prize<>'No cash prize'
  or c.rules->>'public_access_policy' is distinct from 'au-adult-free-play-v1'
  or c.rules->>'entry_fee_credits' is distinct from '0' or new.rules_hash<>md5(c.rules::text)
  or c.rules->>'free_core_policy' is distinct from 'public-free-core-v1'
  or c.rules->>'lock_policy' is distinct from 'round-wide-v1'
  or not exists(select 1 from beta_fantasy.lineup_configurations where version=c.rules->>'lineup_version')
  then raise exception 'Explicit free, no-prize, saved public rules required';end if;
 return new;
end$$;
drop trigger if exists public_round_guard on public_gameplay.rounds;
create trigger public_round_guard before insert or update on public_gameplay.rounds for each row execute function public_gameplay.round_guard();

-- Extend the existing engine at its authentication/scope seams; do not copy its
-- salary, ownership, uniqueness, reservation, locking or saved-snapshot code.
do $$declare sig text;begin
 foreach sig in array array['lineup_actor','lineup_actor_allowed','lineup_scope_allowed','lineup_fixtures','lineup_inventory'] loop
  if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='sports_feed' and p.proname=sig||'_before_public') then
   execute format('alter function sports_feed.%I(%s) rename to %I',sig,
    case when sig='lineup_actor' then '' when sig='lineup_inventory' then 'uuid,uuid' else 'uuid' end,sig||'_before_public');
  end if;
 end loop;
end$$;
create or replace function sports_feed.lineup_actor() returns uuid language plpgsql security definer set search_path='' as $$begin
 if current_setting('docked.public_gameplay',true)='enabled' then return public_gameplay.identity();end if;
 return sports_feed.lineup_actor_before_public();end$$;
create or replace function sports_feed.lineup_actor_allowed(u uuid) returns boolean language plpgsql security definer set search_path='' as $$begin
 if current_setting('docked.public_gameplay',true)='enabled' then return u=public_gameplay.identity();end if;
 return sports_feed.lineup_actor_allowed_before_public(u);end$$;
create or replace function sports_feed.lineup_scope_allowed(cid uuid) returns boolean language plpgsql stable security definer set search_path='' as $$begin
 if current_setting('docked.public_gameplay',true)='enabled' then return public_gameplay.round_allowed(cid);end if;
 return sports_feed.lineup_scope_allowed_before_public(cid);end$$;
create or replace function sports_feed.lineup_fixtures(cid uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if current_setting('docked.public_gameplay',true)='enabled' then
  if not public_gameplay.round_allowed(cid) then raise exception 'Competition unavailable';end if;
  return (select fixtures from public_gameplay.rounds where competition_id=cid);
 end if;
 return sports_feed.lineup_fixtures_before_public(cid);end$$;
-- Only the eligibility readers gain a public session alternative. No beta
-- account, balance, market, issuance, social or administrative guard is relaxed.
do $$declare sig text;b text;begin
 foreach sig in array array['sports_feed.free_core_inventory_before_roster_beta(uuid,uuid)','sports_feed.free_core_inventory(uuid,uuid)','commercial_billing.lineup_inventory(uuid,uuid)'] loop
  b:=pg_get_functiondef(sig::regprocedure);
  execute replace(b,'beta_private.active_member_session()','public_gameplay.session_allowed()');
 end loop;
end$$;
create or replace function sports_feed.lineup_inventory(u uuid,cid uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare inv jsonb;begin
 if current_setting('docked.public_gameplay',true)='enabled' then
  if u is distinct from public_gameplay.identity() or not public_gameplay.round_allowed(cid) then raise exception 'Own competition inventory required';end if;
  inv:=sports_feed.free_core_inventory(u,cid)||commercial_billing.lineup_inventory(u,cid);
  return coalesce((select jsonb_agg(v) from (select distinct on(v->>'id') v from jsonb_array_elements(inv)v order by v->>'id') q),'[]');
 end if;
 return sports_feed.lineup_inventory_before_public(u,cid);
end$$;

create or replace function public_gameplay.capabilities() returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 perform public_gameplay.identity();return coalesce((select jsonb_agg(sport order by case sport when 'nfl' then 1 when 'afl' then 2 else 3 end) from public_gameplay.sports where visible),'[]');end$$;
-- Pre-Auth signup eligibility contains no user or account data. Registration's
-- existing environment AND database switches still have to permit signup.
create or replace function public_gameplay.signup_allowed(country_id text,state_id text,terms_id text,privacy_id text) returns boolean
language sql stable security definer set search_path='' as $$
 select country_id='AU' and state_id in('ACT','NSW','NT','QLD','SA','TAS','VIC','WA') and exists(
 select 1 from public_gameplay.policy g join lateral(select r.* from private.region_policies r
 where r.country=country_id and r.state=state_id and r.effective_from<=clock_timestamp() and r.effective_to>clock_timestamp()
 order by r.effective_from desc,r.id desc limit 1)r on true where g.id and g.enabled and g.valid_until>clock_timestamp()
 and length(g.authority)>10 and g.terms_version=terms_id and g.privacy_version=privacy_id
 and r.approved and r.minimum_age=18 and not r.preview_community_only and r.review_at>clock_timestamp())
$$;
create or replace function public_gameplay.read_state(sport_id text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid;answer jsonb;begin
 u:=public_gameplay.identity();
 if not exists(select 1 from public_gameplay.sports where sport=sport_id and visible and play_enabled) then raise exception 'Sport unavailable';end if;
 with rounds as materialized(select c.*,r.fixture_kind,r.source_reference from beta_fantasy.competitions c join public_gameplay.rounds r on r.competition_id=c.id
  where c.sport=sport_id and public_gameplay.round_allowed(c.id)),
 cards as(select v-'eligible_competition_ids' card,jsonb_agg(distinct c.id) ids from rounds c
  cross join lateral jsonb_array_elements(sports_feed.lineup_inventory(u,c.id))v group by v-'eligible_competition_ids')
 select jsonb_build_object('user_id',u,'sport',sport_id,'server_time',clock_timestamp(),'public_play',true,
  'team_name',(select name from beta_fantasy.team_names where user_id=u),
  'cards',coalesce((select jsonb_agg(card||jsonb_build_object('eligible_competition_ids',ids)) from cards),'[]'),
  'configurations',coalesce((select jsonb_object_agg(version,configuration) from beta_fantasy.lineup_configurations where version in(select rules->>'lineup_version' from rounds)),'{}'),
  'competitions',coalesce((select jsonb_agg(to_jsonb(c) order by c.season,c.round,c.id) from rounds c),'[]'),
  'fixtures',coalesce((select jsonb_object_agg(c.id,r.fixtures) from rounds c join public_gameplay.rounds r on r.competition_id=c.id),'{}'),
  'drafts',coalesce((select jsonb_agg(to_jsonb(d)-'user_id') from beta_fantasy.round_drafts d join rounds c on c.id=d.competition_id where d.user_id=u),'[]'),
  'entries',coalesce((select jsonb_agg(jsonb_build_object('competition_id',e.competition_id,'user_id',e.user_id,'revision',e.lineup_revision,'snapshot',e.snapshot,'updated_at',e.updated_at))
   from beta_fantasy.entries e join rounds c on c.id=e.competition_id
   where e.user_id=u or (c.locks_at<=clock_timestamp() and exists(select 1 from beta_fantasy.entries own where own.competition_id=c.id and own.user_id=u))),'[]'),
  'continuity',jsonb_build_object('established','{}'::jsonb,'rollovers','[]'::jsonb)) into answer;
 return answer;
end$$;
create or replace function public_gameplay.command(sport_id text,action text,p jsonb,request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$declare u uuid;begin
 u:=public_gameplay.identity();
 if action not in('seven_draft','seven_enter','seven_withdraw')
  or not exists(select 1 from public_gameplay.rounds where competition_id=(p->>'competition_id')::uuid and sport=sport_id)
  or not public_gameplay.round_allowed((p->>'competition_id')::uuid) then raise exception 'Public competition unavailable';end if;
 if not exists(select 1 from beta_fantasy.team_names where user_id=u) then raise exception 'Choose a permanent team name first';end if;
 insert into beta_fantasy.members(user_id,expires_at) select u,valid_until from public_gameplay.policy where id on conflict do nothing;
 return sports_feed.seven_command(action,p,request_id);
end$$;
-- The existing permanent-name implementation and trigger remain authoritative.
do $$declare b text;begin
 b:=pg_get_functiondef('beta_fantasy.name_team(text,uuid)'::regprocedure);
 if position('public_gameplay.identity()' in b)=0 then
  b:=replace(b,'u:=beta_fantasy.production_eligible();','if current_setting(''docked.public_gameplay'',true)=''enabled'' then u:=public_gameplay.identity();else u:=beta_fantasy.production_eligible();end if;');
  b:=replace(b,'if u is null or not beta_private.active_member_session() or not exists(select 1 from sports_feed.nfl_control where enabled) then',
   'if current_setting(''docked.public_gameplay'',true) is distinct from ''enabled'' and (u is null or not beta_private.active_member_session() or not exists(select 1 from sports_feed.nfl_control where enabled)) then');execute b;
 end if;
end$$;
create or replace function public_gameplay.name_team(n text,r uuid) returns jsonb language plpgsql security definer set search_path='' as $$begin
 perform public_gameplay.identity();return beta_fantasy.name_team(n,r);end$$;
create or replace function public_gameplay.my_team_name() returns text language plpgsql stable security definer set search_path='' as $$
declare u uuid;begin u:=public_gameplay.identity();return (select name from beta_fantasy.team_names where user_id=u);end$$;

-- Schema not exposed by PostgREST. Runtime gets narrow, guarded entry points.
do $$declare f record;begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public_gameplay' loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role,docked_app,docked_beta_app,docked_commercial_app',f.signature);
 end loop;
end$$;
revoke all on function sports_feed.lineup_actor(),sports_feed.lineup_actor_allowed(uuid),sports_feed.lineup_scope_allowed(uuid),sports_feed.lineup_inventory(uuid,uuid),sports_feed.lineup_fixtures(uuid),
 sports_feed.lineup_actor_before_public(),sports_feed.lineup_actor_allowed_before_public(uuid),sports_feed.lineup_scope_allowed_before_public(uuid),sports_feed.lineup_inventory_before_public(uuid,uuid),sports_feed.lineup_fixtures_before_public(uuid)
 from public,anon,authenticated,service_role,docked_app,docked_beta_app,docked_commercial_app;
grant usage on schema public_gameplay to docked_app;
grant execute on function public_gameplay.capabilities(),public_gameplay.read_state(text),public_gameplay.command(text,text,jsonb,uuid),public_gameplay.name_team(text,uuid) to docked_app;
grant execute on function public_gameplay.signup_allowed(text,text,text,text) to docked_app;
grant execute on function public_gameplay.my_team_name() to docked_app;
