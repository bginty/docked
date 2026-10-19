-- Weekly activation retires NEW legacy NFL starter entitlements. Already issued
-- entitlements and saved allocations retain their original contents and replay.
alter table sports_feed.weekly_core_control add column if not exists legacy_closed_at timestamptz;
create or replace function sports_feed.keep_legacy_cutover() returns trigger language plpgsql set search_path='' as $$begin
 new.legacy_closed_at:=coalesce(old.legacy_closed_at,case when new.enabled then clock_timestamp() else null end);
 return new;
end$$;
drop trigger if exists preserve_legacy_cutover on sports_feed.weekly_core_control;
create trigger preserve_legacy_cutover before update on sports_feed.weekly_core_control for each row execute function sports_feed.keep_legacy_cutover();
update sports_feed.weekly_core_control set enabled=enabled where enabled and legacy_closed_at is null;
create or replace function sports_feed.legacy_starter_cutover() returns trigger language plpgsql set search_path='' as $$begin
 if exists(select 1 from sports_feed.weekly_core_control where legacy_closed_at is not null)
 and not exists(select 1 from sports_feed.nfl_starter_entitlements where user_id=new.user_id)
 and not exists(select 1 from sports_feed.nfl_allocations where user_id=new.user_id)
 then return null;end if;
 return new;
end$$;
drop trigger if exists weekly_cutover on sports_feed.nfl_starter_entitlements;
create trigger weekly_cutover before insert on sports_feed.nfl_starter_entitlements for each row execute function sports_feed.legacy_starter_cutover();
do $$begin
 if to_regprocedure('sports_feed.nfl_allocate_before_weekly_cutover(uuid)') is null then
 alter function sports_feed.nfl_allocate(uuid) rename to nfl_allocate_before_weekly_cutover;
 end if;
 if to_regprocedure('beta_fantasy.production_command_before_weekly_cutover(text,jsonb,uuid)') is null then
 alter function beta_fantasy.production_command(text,jsonb,uuid) rename to production_command_before_weekly_cutover;
 execute replace(pg_get_functiondef('beta_fantasy.production_command_before_weekly_cutover(text,jsonb,uuid)'::regprocedure),'production_command.request_id','production_command_before_weekly_cutover.request_id');
 end if;
 if to_regprocedure('beta_fantasy.production_read_state_before_weekly_cutover()') is null then
 alter function beta_fantasy.production_read_state() rename to production_read_state_before_weekly_cutover;
 end if;
end$$;
create or replace function sports_feed.nfl_allocate(u uuid) returns jsonb language plpgsql set search_path='' as $$begin
 perform pg_advisory_xact_lock(71820342);
 if exists(select 1 from sports_feed.weekly_core_control where legacy_closed_at is not null)
 and not exists(select 1 from sports_feed.nfl_starter_entitlements where user_id=u)
 and not exists(select 1 from sports_feed.nfl_allocations where user_id=u)
 then raise exception 'New Core cards are available through weekly starter packs';end if;
 return sports_feed.nfl_allocate_before_weekly_cutover(u);
end$$;
create or replace function beta_fantasy.production_command(action text,p jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;begin
 if action in('claim_starter','open_nfl_starter') and exists(select 1 from sports_feed.nfl_control where enabled)
 and exists(select 1 from sports_feed.weekly_core_control where legacy_closed_at is not null) then
 perform pg_advisory_xact_lock(71820342);
 u:=beta_fantasy.production_eligible();
 if not beta_private.active_member_session() then raise exception 'Active session required';end if;
 if not exists(select 1 from sports_feed.nfl_starter_entitlements where user_id=u)
 and not exists(select 1 from sports_feed.nfl_allocations where user_id=u)
 then raise exception 'Your free Core cards are in Weekly starter pack under My Packs';end if;
 end if;
 return beta_fantasy.production_command_before_weekly_cutover(action,p,request_id);
end$$;
create or replace function beta_fantasy.production_read_state() returns jsonb language plpgsql security definer set search_path='' as $$
declare s jsonb;u uuid;begin
 s:=beta_fantasy.production_read_state_before_weekly_cutover();
 if s->>'nfl_beta'='true' and exists(select 1 from sports_feed.weekly_core_control where legacy_closed_at is not null) then
 u:=beta_fantasy.production_eligible();
 s:=jsonb_set(s,'{rewards,starter_entitled}',to_jsonb(exists(select 1 from sports_feed.nfl_starter_entitlements where user_id=u) or exists(select 1 from sports_feed.nfl_allocations where user_id=u)));
 end if;
 return s;
end$$;
revoke all on function sports_feed.keep_legacy_cutover(),sports_feed.legacy_starter_cutover(),sports_feed.nfl_allocate(uuid),sports_feed.nfl_allocate_before_weekly_cutover(uuid),beta_fantasy.production_command_before_weekly_cutover(text,jsonb,uuid),beta_fantasy.production_read_state_before_weekly_cutover() from public,anon,authenticated,service_role,docked_app,docked_beta_app;
revoke all on function beta_fantasy.production_command(text,jsonb,uuid),beta_fantasy.production_read_state() from public,anon,authenticated,service_role,docked_app;
grant execute on function beta_fantasy.production_command(text,jsonb,uuid),beta_fantasy.production_read_state() to docked_beta_app;
