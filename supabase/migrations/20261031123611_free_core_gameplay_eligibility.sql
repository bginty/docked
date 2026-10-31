-- Disabled-by-default gameplay eligibility, never collectible issuance.
-- Existing competitions do not opt in, and existing snapshots are untouched.
create table sports_feed.free_core_programmes (
 sport text primary key check(sport in ('nfl','afl','nrl')),
 enabled boolean not null default false,
 version text not null default 'public-free-core-v1' check(version='public-free-core-v1')
);
insert into sports_feed.free_core_programmes(sport) values('nfl'),('afl'),('nrl');
-- References existing player identities. Operator-reviewed roster evidence only;
-- this is eligibility, not a card, edition, serial, supply or ownership ledger.
create table sports_feed.free_core_roster (
 player_id uuid primary key references beta_fantasy.players(id),
 sport text not null references sports_feed.free_core_programmes(sport),
 season text not null,
 eligible_positions jsonb not null check(jsonb_typeof(eligible_positions)='array' and jsonb_array_length(eligible_positions)>0),
 valid_until timestamptz not null,
 source_url text not null check(source_url like 'https://%'),
 source_hash text not null check(source_hash ~ '^[a-f0-9]{64}$'),
 active boolean not null default false
);
alter table sports_feed.free_core_programmes enable row level security;
alter table sports_feed.free_core_roster enable row level security;
revoke all on sports_feed.free_core_programmes,sports_feed.free_core_roster from public,anon,authenticated,service_role,docked_app,docked_beta_app;

create function sports_feed.free_core_inventory(u uuid,cid uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object(
 'id',md5('public-free-core-v1:'||u::text||':'||p.id::text)::uuid,
 'player_id',p.id,'canonical_player_id',p.id,'owner_id',u,
 'name',p.name,'team',p.team,'colour',p.colour,'season',r.season,'position',p.position,'eligible_positions',r.eligible_positions,
 'sport',r.sport,'tier','CORE','serial',null,'tradeable',false,'listed',false,'status','active',
 'multiplier',1,'multiplierTenths',10,'inventory_source','public-free-core-v1',
 'collectible_owned',false,'availability_reason','Free Core gameplay eligibility; not an owned collectible',
 'eligible_competition_ids',jsonb_build_array(cid),'source_hash',r.source_hash
 )), '[]')
 from beta_fantasy.competitions c
 join sports_feed.free_core_programmes g on g.sport=c.sport and g.enabled
 join sports_feed.free_core_roster r on r.sport=c.sport and r.season=c.season and r.active and r.valid_until>clock_timestamp()
 join beta_fantasy.players p on p.id=r.player_id and p.sport=r.sport
 where c.id=cid and u=auth.uid() and beta_private.active_member_session() and p.status='active'
 and sports_feed.lineup_scope_allowed(cid) is true
 and c.rules->>'free_core_policy'=g.version
 and c.scored_at is null and c.locks_at>clock_timestamp()
 and not exists(select 1 from beta_fantasy.round_controls where competition_id=cid and not enabled)
 and r.eligible_positions ? p.position
 and not exists(select 1 from jsonb_array_elements_text(r.eligible_positions) pos
   where not exists(select 1 from beta_fantasy.lineup_configurations f,
   jsonb_array_elements(f.configuration->'slots') slot
   where f.version=c.rules->>'lineup_version' and slot->'positions' ? pos))
$$;
revoke all on function sports_feed.free_core_inventory(uuid,uuid) from public,anon,authenticated,service_role,docked_app,docked_beta_app;

alter function sports_feed.lineup_inventory(uuid,uuid) rename to lineup_inventory_before_free_core;
create function sports_feed.lineup_inventory(u uuid,cid uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(sports_feed.lineup_inventory_before_free_core(u,cid),'[]')||sports_feed.free_core_inventory(u,cid)
$$;
revoke all on function sports_feed.lineup_inventory_before_free_core(uuid,uuid),sports_feed.lineup_inventory(uuid,uuid) from public,anon,authenticated,service_role,docked_app,docked_beta_app;

-- Read projection uses the same competition-scoped eligibility as save validation.
-- Kept out of My Cards, marketplace, packs, collection counts and permanent supply.
create function sports_feed.append_free_core(s jsonb,sport_id text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare extra jsonb;u uuid;begin
 u:=(s->>'user_id')::uuid;
 select coalesce(jsonb_agg(card || jsonb_build_object('eligible_competition_ids',ids)),'[]') into extra from (
 select v - 'eligible_competition_ids' card,jsonb_agg(distinct c->>'id') ids from jsonb_array_elements(coalesce(s->'competitions','[]')) c
 cross join lateral jsonb_array_elements(sports_feed.free_core_inventory(u,(c->>'id')::uuid)) v
 where c->>'sport'=sport_id group by v - 'eligible_competition_ids'
 ) q;
 if extra='[]' then return s;end if;
 if sport_id='nfl' then
  return jsonb_set(s,'{seven,inventory}',coalesce(s#>'{seven,inventory}','[]')||extra);
 end if;
 return jsonb_set(s,'{cards}',coalesce(s->'cards','[]')||extra);
end$$;
revoke all on function sports_feed.append_free_core(jsonb,text) from public,anon,authenticated,service_role,docked_app,docked_beta_app;
alter function sports_feed.sport_sandbox_state(text) rename to sport_sandbox_state_before_free_core;
create function sports_feed.sport_sandbox_state(sport_id text) returns jsonb
language sql security definer set search_path='' as $$
 select sports_feed.append_free_core(sports_feed.sport_sandbox_state_before_free_core(sport_id),sport_id)
$$;
revoke all on function sports_feed.sport_sandbox_state_before_free_core(text),sports_feed.sport_sandbox_state(text) from public,anon,authenticated,service_role,docked_app,docked_beta_app;
grant execute on function sports_feed.sport_sandbox_state(text) to docked_beta_app;
alter function beta_fantasy.production_read_state() rename to production_read_state_before_free_core;
create function beta_fantasy.production_read_state() returns jsonb
language sql security definer set search_path='' as $$
 select sports_feed.append_free_core(beta_fantasy.production_read_state_before_free_core(),'nfl')
$$;
revoke all on function beta_fantasy.production_read_state_before_free_core(),beta_fantasy.production_read_state() from public,anon,authenticated,service_role,docked_app,docked_beta_app;
grant execute on function beta_fantasy.production_read_state() to docked_beta_app;
