-- Additive adapter for the existing verified AFL/NRL roster registry. Empty and
-- disabled until separately approved roster/programme/round configuration.
-- No cards, serials, wallet entries or competition snapshots are created here.
create table if not exists sports_feed.free_core_roster_beta (
 provider_player_id text primary key references credits_sandbox.nba_fixture_players(id),
 sport text not null references sports_feed.free_core_programmes(sport) check(sport in ('afl','nrl')),
 season text not null,
 eligible_positions jsonb not null check(jsonb_typeof(eligible_positions)='array' and jsonb_array_length(eligible_positions)>0),
 valid_until timestamptz not null,
 source_hash text not null check(source_hash ~ '^[a-f0-9]{64}$'),
 active boolean not null default false
);
alter table sports_feed.free_core_roster_beta enable row level security;
revoke all on sports_feed.free_core_roster_beta from public,anon,authenticated,service_role,docked_app,docked_beta_app;

-- Retain the original NFL and legacy player-identity path. Guarded rename makes
-- replay safe; the new wrapper is replaced, never wrapped around itself.
do $$begin
 if to_regprocedure('sports_feed.free_core_inventory_before_roster_beta(uuid,uuid)') is null then
  alter function sports_feed.free_core_inventory(uuid,uuid) rename to free_core_inventory_before_roster_beta;
 end if;
end$$;
create or replace function sports_feed.free_core_inventory(u uuid,cid uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(sports_feed.free_core_inventory_before_roster_beta(u,cid),'[]') || coalesce((
 select jsonb_agg(jsonb_build_object(
  'id',md5('public-free-core-v1:'||u::text||':'||(p.identity->>'fixturePlayerId'))::uuid,
  'player_id',p.identity->>'fixturePlayerId','canonical_player_id',p.identity->>'fixturePlayerId','owner_id',u,
  'name',p.identity->>'name','team',p.identity->>'currentTeam','position',p.identity->>'position',
  'eligible_positions',r.eligible_positions,'sport',r.sport,'season',r.season,
  'tier','CORE','serial',null,'tradeable',false,'listed',false,'status','active',
  'multiplier',1,'multiplierTenths',10,'inventory_source','public-free-core-v1','collectible_owned',false,
  'inventory_class','real-roster-beta-v1','roster_source',p.identity->'rosterBeta',
  'verifiedJerseyNumber',p.identity->'verifiedJerseyNumber',
  'availability_reason','Free Core gameplay eligibility; not an owned collectible',
  'eligible_competition_ids',jsonb_build_array(cid),'source_hash',r.source_hash
 ))
 from beta_fantasy.competitions c
 join sports_feed.free_core_programmes g on g.sport=c.sport and g.enabled
 join sports_feed.free_core_roster_beta r on r.sport=c.sport and r.season=c.season and r.active and r.valid_until>clock_timestamp()
 join credits_sandbox.nba_fixture_players p on p.id=r.provider_player_id
 where c.id=cid and u=auth.uid() and beta_private.active_member_session()
 and sports_feed.lineup_scope_allowed(cid) is true
 and c.rules->>'free_core_policy'=g.version
 and c.scored_at is null and c.locks_at>clock_timestamp()
 and not exists(select 1 from beta_fantasy.round_controls where competition_id=cid and not enabled)
 and credits_sandbox.is_roster_beta_player(p.identity)
 and p.identity->>'sport'=r.sport and p.identity->>'status'='active'
 and p.identity->'rosterBeta'->>'sourceHash'=r.source_hash
 and r.eligible_positions ? (p.identity->>'position')
 and not exists(select 1 from jsonb_array_elements_text(r.eligible_positions) pos
   where not coalesce(p.identity->'eligiblePositions' ? pos,false)
   or not exists(select 1 from beta_fantasy.lineup_configurations f,
     jsonb_array_elements(f.configuration->'slots') slot
     where f.version=c.rules->>'lineup_version' and slot->'positions' ? pos))
 -- A canonical player can only use one registry path in a given competition.
 and not exists(select 1 from sports_feed.free_core_roster legacy
   where legacy.player_id=(p.identity->>'fixturePlayerId')::uuid and legacy.sport=r.sport)
 ),'[]')
$$;
revoke all on function sports_feed.free_core_inventory(uuid,uuid),sports_feed.free_core_inventory_before_roster_beta(uuid,uuid)
 from public,anon,authenticated,service_role,docked_app,docked_beta_app;
