-- Private draft continuity only. Never submits entries, reserves cards or awards assets.
create table if not exists beta_fantasy.team_rollovers(
 competition_id uuid references beta_fantasy.competitions,
 user_id uuid references beta_fantasy.members,
 source_competition_id uuid not null references beta_fantasy.competitions,
 selections jsonb not null, omitted jsonb not null,
 created_at timestamptz not null default clock_timestamp(),
 primary key(competition_id,user_id)
);
alter table beta_fantasy.team_rollovers enable row level security;
revoke all on beta_fantasy.team_rollovers from public,anon,authenticated,service_role,docked_beta_app;
create or replace function sports_feed.seven_continue_teams() returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid; target beta_fantasy.competitions; source_id uuid; source_picks jsonb;
 cfg jsonb; inv jsonb; item jsonb; card jsonb; slot jsonb; fixture jsonb;
 picks jsonb; omitted jsonb; reason text; players text[]; slots text[]; total bigint;
 context jsonb; now_at timestamptz:=clock_timestamp();
begin
 u:=beta_fantasy.production_eligible();
 if not beta_private.active_member_session() or not exists(select 1 from credits_sandbox.access where user_id=u and enabled) then raise exception 'Invited test member required'; end if;
 -- Immutable entry revisions keep first setup confirmed even after withdrawal.
 select coalesce(jsonb_object_agg(chain,true),'{}') into context from (
  select distinct c.sport||':'||(c.rules->>'mode') chain
  from beta_fantasy.entry_revisions r join beta_fantasy.competitions c on c.id=r.competition_id
  where r.user_id=u and r.action='seven_enter' and c.rules->>'lineup_version' is not null
 ) established;
 for target in
  select c.* from beta_fantasy.competitions c
  join beta_fantasy.production_rounds pr on pr.competition_id=c.id
  join sports_feed.nfl_rounds nr on nr.competition_id=c.id
  where c.sport='nfl' and c.rules->>'lineup_version' is not null
   and c.rules->>'mode' in ('SALARY_CAP','OPEN') and c.rules->>'inventory_scope'='invited-nfl-test-v2'
   and pr.release_channel=beta_fantasy.production_channel() and nr.purpose='member'
   and c.scored_at is null and c.locks_at>now_at
   and not exists(select 1 from beta_fantasy.round_controls where competition_id=c.id and not enabled)
   and not exists(select 1 from beta_fantasy.round_drafts where competition_id=c.id and user_id=u)
   and not exists(select 1 from beta_fantasy.entries where competition_id=c.id and user_id=u)
   and not exists(select 1 from beta_fantasy.team_rollovers where competition_id=c.id and user_id=u)
  order by c.season,c.round,c.id
 loop
  perform pg_advisory_xact_lock(71820342);
  if exists(select 1 from beta_fantasy.round_drafts where competition_id=target.id and user_id=u)
   or exists(select 1 from beta_fantasy.entries where competition_id=target.id and user_id=u)
   or exists(select 1 from beta_fantasy.team_rollovers where competition_id=target.id and user_id=u) then continue; end if;
  -- Never backfill a week before this chain's first confirmed entry.
  if not exists(select 1 from beta_fantasy.entry_revisions r join beta_fantasy.competitions c on c.id=r.competition_id
   where r.user_id=u and r.action='seven_enter' and c.sport=target.sport and c.rules->>'mode'=target.rules->>'mode'
   and c.rules->>'inventory_scope'=target.rules->>'inventory_scope' and (c.season,c.round)<(target.season,target.round)) then continue; end if;
  select c.id,case when e.id is not null then (select jsonb_agg(jsonb_build_object('slot',s->>'slot','card',s->>'card_id')) from jsonb_array_elements(e.snapshot)s) else d.selections end
   into source_id,source_picks
   from beta_fantasy.competitions c join beta_fantasy.production_rounds pr on pr.competition_id=c.id
   left join beta_fantasy.entries e on e.competition_id=c.id and e.user_id=u
   left join beta_fantasy.round_drafts d on d.competition_id=c.id and d.user_id=u
   where c.sport=target.sport and c.rules->>'mode'=target.rules->>'mode'
    and c.rules->>'inventory_scope'=target.rules->>'inventory_scope'
    and pr.release_channel=beta_fantasy.production_channel()
    and (c.season,c.round)<(target.season,target.round) and (e.id is not null or d.competition_id is not null)
   order by c.season desc,c.round desc limit 1;
  if source_id is null then continue; end if;
  select configuration into cfg from beta_fantasy.lineup_configurations where version=target.rules->>'lineup_version';
  if cfg is null then continue; end if;
  if inv is null then inv:=sports_feed.seven_inventory(u);end if;
  picks:='[]';omitted:='[]';players:='{}';slots:='{}';total:=0;
  -- Keep original slot order/card instances; never optimise or substitute.
  for item in select value from jsonb_array_elements(coalesce(source_picks,'[]')) loop
   reason:=null;fixture:=null;
   select value into slot from jsonb_array_elements(cfg->'slots') where value->>'id'=item->>'slot';
   select value into card from jsonb_array_elements(inv) where value->>'id'=item->>'card';
   if slot is null or item->>'slot'=any(slots) then reason:='Position is not available in this round';
   elsif card is null then reason:='Card is no longer in your eligible collection';
   elsif card->>'status'<>'active' then reason:='Current player eligibility is unavailable';
   elsif coalesce((card->>'listed')::boolean,false) then reason:='Card is listed for sale';
   elsif not(slot->'positions' ? (card->>'position')) then reason:='Player is not eligible for this position';
   elsif card->>'player_id'=any(players) then reason:='Player already selected';
   elsif (select count(*) from sports_feed.nfl_rounds n,jsonb_array_elements(n.fixtures)f where n.competition_id=target.id and f->'playerIds' ? (card->>'player_id'))<>1 then reason:='No reliable unique fixture for this week';
   else
    select f into fixture from sports_feed.nfl_rounds n,jsonb_array_elements(n.fixtures)f where n.competition_id=target.id and f->'playerIds' ? (card->>'player_id');
    if fixture->>'scheduledAt' is null or coalesce(fixture->>'status','scheduled')<>'scheduled' then reason:='Fixture schedule is under review';
    elsif (fixture->>'scheduledAt')::timestamptz<=now_at then reason:='Player game has started';
    elsif cfg->'salaries'->>(card->>'tier') is null or card->>'multiplierTenths' is null then reason:='Card configuration is unavailable';
    elsif target.rules->>'mode'='SALARY_CAP' and total+(cfg->'salaries'->>(card->>'tier'))::bigint>(cfg->>'salaryCap')::bigint then reason:='Review this position to fit the salary cap'; end if;
   end if;
   if reason is null then
    picks:=picks||jsonb_build_array(item);slots:=array_append(slots,item->>'slot');players:=array_append(players,card->>'player_id');total:=total+(cfg->'salaries'->>(card->>'tier'))::bigint;
   else omitted:=omitted||jsonb_build_array(jsonb_build_object('slot',item->>'slot','reason',reason)); end if;
  end loop;
  -- Reuse the authoritative command: eligibility, cap, revision, audit and locks.
  perform sports_feed.seven_command('seven_draft',jsonb_build_object('competition_id',target.id,'revision',0,'selections',picks),gen_random_uuid());
  insert into beta_fantasy.team_rollovers(competition_id,user_id,source_competition_id,selections,omitted) values(target.id,u,source_id,picks,omitted);
 end loop;
 return jsonb_build_object('established',context,'rollovers',coalesce((select jsonb_agg(to_jsonb(r)-'user_id') from beta_fantasy.team_rollovers r where user_id=u),'[]'));
end$$;
revoke all on function sports_feed.seven_continue_teams() from public,anon,authenticated,service_role,docked_beta_app;

-- Wrap once; reread only drafts after reconciliation, not the expensive inventory projection.
do $$begin
 if to_regprocedure('beta_fantasy.production_read_state_before_continuity()') is null then
  alter function beta_fantasy.production_read_state() rename to production_read_state_before_continuity;
 end if;
end$$;
create or replace function beta_fantasy.production_read_state() returns jsonb language plpgsql security definer set search_path='' as $$
declare s jsonb;context jsonb;u uuid;begin
 s:=beta_fantasy.production_read_state_before_continuity();
 if s->'seven' is null then return s;end if;
 context:=sports_feed.seven_continue_teams();u:=(s->>'user_id')::uuid;
 return s||jsonb_build_object('seven',(s->'seven')||context||jsonb_build_object('drafts',coalesce((select jsonb_agg(to_jsonb(d)-'user_id') from beta_fantasy.round_drafts d where user_id=u),'[]')));
end$$;
revoke all on function beta_fantasy.production_read_state_before_continuity(),beta_fantasy.production_read_state() from public,anon,authenticated,service_role;
revoke all on function beta_fantasy.production_read_state_before_continuity() from docked_beta_app;
grant execute on function beta_fantasy.production_read_state() to docked_beta_app;
