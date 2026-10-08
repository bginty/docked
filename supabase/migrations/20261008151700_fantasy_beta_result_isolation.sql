-- Dormant in Preview. Release history is append-only and operator-only.
create table fantasy.production_releases(
  id bigint generated always as identity primary key,
  channel text not null check(channel in('beta','stable')),
  created_at timestamptz not null default clock_timestamp()
);
alter table fantasy.production_releases enable row level security;
revoke all on fantasy.production_releases from public,anon,authenticated,docked_app;
create trigger immutable before update or delete on fantasy.production_releases
  for each row execute function fantasy.immutable();
create function fantasy.release_insert_guard() returns trigger language plpgsql set search_path='' as $$ begin
  perform pg_advisory_xact_lock(71820341);
  return new;
end $$;
create trigger release_lock before insert on fantasy.production_releases
  for each row execute function fantasy.release_insert_guard();
insert into fantasy.production_releases(channel) values('beta');
create function fantasy.production_channel() returns text language sql stable set search_path='' as $$
  select channel from fantasy.production_releases order by id desc limit 1
$$;

-- Existing records remain explicitly legacy; never relabel prior results beta/official.
alter table fantasy.production_rounds add column release_channel text not null default 'legacy'
  check(release_channel in('legacy','beta','stable'));
alter table fantasy.production_rounds alter column release_channel set default fantasy.production_channel();
alter table fantasy.daily_claims add column release_channel text not null default 'legacy'
  check(release_channel in('legacy','beta','stable'));
alter table fantasy.daily_claims alter column release_channel set default fantasy.production_channel();

alter function fantasy.production_eligible() rename to production_eligible_v1;
create function fantasy.production_eligible() returns uuid language plpgsql set search_path='' as $$ begin
  if current_setting('docked.fantasy_channel',true) is distinct from fantasy.production_channel() then
    raise exception 'Production release channel mismatch';
  end if;
  return fantasy.production_eligible_v1();
end $$;
alter function fantasy.production_command(text,jsonb,uuid) rename to production_command_v1;
do $$ begin
  execute replace(pg_get_functiondef('fantasy.production_command_v1(text,jsonb,uuid)'::regprocedure),
    'production_command.request_id','production_command_v1.request_id');
end $$;
create function fantasy.production_command(action text,p jsonb,request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$ declare u uuid; begin
  perform pg_advisory_xact_lock(71820341);
  u:=fantasy.production_eligible();
  -- Recover a committed result after a release transition. The original entry
  -- point still checks current membership/MFA and exact action/payload identity.
  if exists(select 1 from fantasy.requests q where q.user_id=u and q.request_id=production_command.request_id) then
    return fantasy.production_command_v1(action,p,request_id);
  end if;
  if action in('save_lineup','admin_stats','admin_simulate') and not exists(
    select 1 from fantasy.production_rounds where competition_id=(p->>'competition_id')::uuid
      and release_channel=fantasy.production_channel()) then
    raise exception 'Current release round required';
  end if;
  return fantasy.production_command_v1(action,p,request_id);
end $$;

alter function fantasy.production_read_state() rename to production_read_state_v1;
create function fantasy.production_read_state() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid; ch text; state jsonb; board jsonb; sid uuid; begin
  perform pg_advisory_xact_lock(71820341);
  u:=fantasy.production_eligible(); ch:=fantasy.production_channel();
  state:=fantasy.production_read_state_v1();
  select id into sid from private.social_profiles where user_id=u and status='active';
  with visible as (
    select u user_id,u display_id,'You'::text name
    union all
    select sp.user_id,sp.id,sp.display_name
    from private.social_profiles sp
    join fantasy.members m on m.user_id=sp.user_id and m.revoked_at is null and m.expires_at>clock_timestamp()
    join public.profiles p on p.id=sp.user_id and p.disabled_at is null
    where sp.user_id<>u and sid is not null and sp.status='active' and sp.visibility='members'
      and private.community_feature_allowed(u,'community_social')
      and private.community_feature_allowed(sp.user_id,'community_social')
      and private.community_feature_allowed(u,'leaderboards')
      and private.community_feature_allowed(sp.user_id,'leaderboards')
      and private.community_feature_allowed(u,'public_profiles')
      and private.community_feature_allowed(sp.user_id,'public_profiles')
      and private.social_profile_visible(sid,sp.id,false)
  ), totals as (
    select v.display_id id,v.name,coalesce(sum(r.championship_points),0)::bigint points
    from visible v left join (fantasy.results r join fantasy.production_rounds pr
      on pr.competition_id=r.competition_id and pr.release_channel=ch) on r.user_id=v.user_id
    group by v.display_id,v.name
  ), ranked as (
    select *,dense_rank() over(order by points desc) rank from totals
  ) select coalesce(jsonb_agg(to_jsonb(x) order by x.points desc,x.id),'[]') into board
    from (select * from ranked order by points desc,id limit 100) x;
  state:=state || jsonb_build_object(
    'release_channel',ch,
    'my_championship_points',coalesce((select sum(r.championship_points) from fantasy.results r
      join fantasy.production_rounds pr on pr.competition_id=r.competition_id
      where r.user_id=u and pr.release_channel=ch),0),
    'leaderboard',jsonb_build_object('scope','visible_members_current_release','rows',board),
    'competitions',coalesce((select jsonb_agg(to_jsonb(x)-'prize') from (
      select c.*,pr.release_channel from fantasy.competitions c join fantasy.production_rounds pr on pr.competition_id=c.id
      where pr.release_channel=ch order by c.locks_at desc,c.id limit 50) x),'[]'),
    'entries',coalesce((select jsonb_agg(to_jsonb(x)) from (
      select e.* from fantasy.entries e join fantasy.production_rounds pr on pr.competition_id=e.competition_id
      where e.user_id=u and pr.release_channel=ch order by e.updated_at desc,e.id limit 50) x),'[]'),
    'results',coalesce((select jsonb_agg(to_jsonb(x)) from (
      select r.competition_id,r.user_id,r.score,r.rank,r.championship_points,pr.release_channel
      from fantasy.results r join fantasy.production_rounds pr on pr.competition_id=r.competition_id
      join fantasy.competitions c on c.id=r.competition_id where r.user_id=u and pr.release_channel=ch
      order by c.locks_at desc,r.competition_id limit 100) x),'[]'));
  state:=jsonb_set(state,'{rewards}',(state->'rewards') || jsonb_build_object(
    'release_channel',ch,
    'points',coalesce((select sum(points) from fantasy.daily_claims where user_id=u and release_channel=ch),0),
    'history',coalesce((select jsonb_agg(to_jsonb(x)) from (
      select period,points,policy_version,pack_id,card_outcome,created_at,release_channel
      from fantasy.daily_claims where user_id=u order by period desc limit 90) x),'[]')));
  return state;
end $$;
-- Renaming must not leave the previous public entry points callable by runtime.
revoke all on all functions in schema fantasy from public,anon,authenticated,docked_app;
grant execute on function fantasy.command(text,jsonb,uuid),fantasy.read_state(),fantasy.production_command(text,jsonb,uuid),fantasy.production_read_state() to docked_app;
