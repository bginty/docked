-- Dormant bridge into the existing lineup validator. No competition opts in,
-- no programme is enabled, and no existing snapshot, wallet or card is rewritten.
alter table commercial_billing.control add column if not exists gameplay_enabled boolean not null default false;

create or replace function commercial_billing.lineup_inventory(u uuid,cid uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 with eligible as materialized (
  select v from jsonb_array_elements(sports_feed.free_core_inventory(u,cid)) v
 ), owned as (
  select e.v || jsonb_build_object('id',i.id,'card_id',i.id,'edition_id',d.id,
   'tier',d.rarity,'serial',i.serial,'max_supply',d.lifetime_cap,'collectible_owned',true,
   'inventory_source','commercial-owned-v1','tradeable',false,
   'listed',exists(select 1 from commercial_billing.listings l where l.card=i.id and l.state='OPEN'),
   'multiplierTenths',(r.document->'rarities'->d.rarity->>'multiplierTenths')::int,
   'multiplier',(r.document->'rarities'->d.rarity->>'multiplierTenths')::numeric/10,
   'rarityVersion',r.version) card
  from commercial_billing.cards i join commercial_billing.definitions d on d.id=i.definition
  join commercial_billing.packs p on p.id=i.pack
  join eligible e on e.v->>'player_id'=d.player_id::text and e.v->>'sport'=d.sport
  join credits_sandbox.rarity_configuration r on r.version='docked-lifetime-rarity-v1'
  where i.owner_id=u and p.opened_at is not null and not i.locked
   and not exists(select 1 from commercial_billing.recovery_cases where member_id=u and state='OPEN')
 )
 select case when u=auth.uid() and beta_private.active_member_session()
  and sports_feed.lineup_scope_allowed(cid) and exists(
   select 1 from beta_fantasy.competitions c,commercial_billing.control g where c.id=cid and g.id and g.gameplay_enabled
    and c.rules->>'commercial_inventory_policy'='commercial-owned-v1'
    and c.rules->>'free_core_policy'='public-free-core-v1'
    and c.sport in('nfl','afl','nrl') and c.scored_at is null and c.locks_at>clock_timestamp()
    and g.policy_version='commercial-closed-loop-2026-11-01-v1'
    and (g.approvals->>'validUntil')::timestamptz>clock_timestamp()
  )
 then coalesce((select jsonb_agg(v) from eligible),'[]') || coalesce((select jsonb_agg(card) from owned),'[]') else '[]' end
$$;
revoke all on function commercial_billing.lineup_inventory(uuid,uuid) from public,anon,authenticated,service_role,docked_app,docked_beta_app,docked_commercial_app;

do $$begin
 if to_regprocedure('sports_feed.lineup_inventory_before_commercial(uuid,uuid)') is null then
  alter function sports_feed.lineup_inventory(uuid,uuid) rename to lineup_inventory_before_commercial;
 end if;
end$$;

-- Private Profile summary uses the same opened/current-owner inclusion as Cards.
-- It cannot be used to inspect another member's inventory.
create or replace function commercial_billing.member_record(sport_id text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare u uuid;answer jsonb;begin
 u:=auth.uid();
 if u is null or sport_id not in('nfl','afl','nrl') or not private.active_member_session() then raise exception 'Authenticated member required';end if;
 with owned as materialized (
  select c.id,d.rarity from commercial_billing.cards c join commercial_billing.definitions d on d.id=c.definition
  join commercial_billing.packs p on p.id=c.pack where c.owner_id=u and d.sport=sport_id and p.opened_at is not null
 ), counts as(select rarity,count(*)::int n from owned group by rarity)
 select jsonb_build_object('member',u,'sport',sport_id,'total',(select count(*) from owned),
  'counts',coalesce((select jsonb_object_agg(rarity,n) from counts),'{}'),
  'entries',(select count(*) from beta_fantasy.entries e join beta_fantasy.competitions c on c.id=e.competition_id where e.user_id=u and c.sport=sport_id),
  'opened',(select count(*) from commercial_billing.packs where member_id=u and product->>'sport'=sport_id and opened_at is not null),
  'revision',md5(coalesce((select string_agg(id::text,',' order by id) from owned),''))) into answer;
 return answer;
end$$;
revoke all on function commercial_billing.member_record(text) from public,anon,authenticated,service_role,docked_beta_app,docked_commercial_app;
grant usage on schema commercial_billing to docked_app;
grant execute on function commercial_billing.member_record(text) to docked_app;
create or replace function sports_feed.lineup_inventory(u uuid,cid uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select case when exists(select 1 from beta_fantasy.competitions where id=cid and rules->>'commercial_inventory_policy'='commercial-owned-v1')
  then commercial_billing.lineup_inventory(u,cid) else sports_feed.lineup_inventory_before_commercial(u,cid) end
$$;
revoke all on function sports_feed.lineup_inventory(uuid,uuid),sports_feed.lineup_inventory_before_commercial(uuid,uuid) from public,anon,authenticated,service_role,docked_app,docked_beta_app;

-- Shared read projection: scope each existing card away from opted-in commercial
-- rounds, then append the exact same inventory used by server save validation.
create or replace function commercial_billing.append_lineup(s jsonb,sport_id text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare cards jsonb;extra jsonb;u uuid;rounds jsonb;begin
 u:=(s->>'user_id')::uuid;rounds:=coalesce(s->'competitions','[]');
 if not exists(select 1 from jsonb_array_elements(rounds) c where c->'rules'->>'commercial_inventory_policy'='commercial-owned-v1') then return s;end if;
 cards:=case when sport_id='nfl' then coalesce(s#>'{seven,inventory}','[]') else coalesce(s->'cards','[]') end;
 select coalesce(jsonb_agg(card || jsonb_build_object('eligible_competition_ids',coalesce((
  select jsonb_agg(c->>'id') from jsonb_array_elements(rounds)c
  where c->'rules'->>'commercial_inventory_policy' is distinct from 'commercial-owned-v1'
   and (not card ? 'eligible_competition_ids' or card->'eligible_competition_ids' ? (c->>'id'))
 ),'[]'))),'[]') into cards from jsonb_array_elements(cards)card;
 select coalesce(jsonb_agg(card || jsonb_build_object('eligible_competition_ids',ids)),'[]') into extra from (
  select v-'eligible_competition_ids' card,jsonb_agg(distinct c->>'id') ids from jsonb_array_elements(rounds)c
  cross join lateral jsonb_array_elements(commercial_billing.lineup_inventory(u,(c->>'id')::uuid))v
  where c->>'sport'=sport_id group by v-'eligible_competition_ids'
 )q;
 -- A free Core ID can be eligible in both programme types; merge by stable ID.
 select coalesce(jsonb_agg(card || jsonb_build_object('eligible_competition_ids',ids)),'[]') into cards from (
  select v-'eligible_competition_ids' card,jsonb_agg(distinct id) ids from jsonb_array_elements(cards||extra)v
  cross join lateral jsonb_array_elements(v->'eligible_competition_ids')id group by v-'eligible_competition_ids'
 )q;
 if sport_id='nfl' then return jsonb_set(s,'{seven,inventory}',cards);end if;
 return jsonb_set(s,'{cards}',cards);
end$$;
revoke all on function commercial_billing.append_lineup(jsonb,text) from public,anon,authenticated,service_role,docked_app,docked_beta_app,docked_commercial_app;
do $$begin
 if to_regprocedure('sports_feed.sport_sandbox_state_before_commercial(text)') is null then
  alter function sports_feed.sport_sandbox_state(text) rename to sport_sandbox_state_before_commercial;
 end if;
 if to_regprocedure('beta_fantasy.production_read_state_before_commercial()') is null then
  alter function beta_fantasy.production_read_state() rename to production_read_state_before_commercial;
 end if;
end$$;
create or replace function sports_feed.sport_sandbox_state(sport_id text) returns jsonb
language sql security definer set search_path='' as $$select commercial_billing.append_lineup(sports_feed.sport_sandbox_state_before_commercial(sport_id),sport_id)$$;
create or replace function beta_fantasy.production_read_state() returns jsonb
language sql security definer set search_path='' as $$select commercial_billing.append_lineup(beta_fantasy.production_read_state_before_commercial(),'nfl')$$;
revoke all on function sports_feed.sport_sandbox_state_before_commercial(text),beta_fantasy.production_read_state_before_commercial(),sports_feed.sport_sandbox_state(text),beta_fantasy.production_read_state() from public,anon,authenticated,service_role,docked_app,docked_beta_app;
grant execute on function sports_feed.sport_sandbox_state(text),beta_fantasy.production_read_state() to docked_beta_app;

create or replace function commercial_billing.lineup_transfer_guard() returns trigger
language plpgsql security definer set search_path='' as $$declare card_id uuid;begin
 perform pg_advisory_xact_lock(71820342);
 if tg_table_name='listings' then card_id:=new.card;
 elsif new.owner_id is distinct from old.owner_id then card_id:=old.id;end if;
 if card_id is not null and sports_feed.card_entry_reserved(card_id) then raise exception 'Card reserved by submitted lineup';end if;
 return new;
end$$;
revoke all on function commercial_billing.lineup_transfer_guard() from public,anon,authenticated,service_role,docked_app,docked_beta_app,docked_commercial_app;
do $$begin
 if not exists(select 1 from pg_trigger where tgname='commercial_lineup_transfer') then
  create trigger commercial_lineup_transfer before update of owner_id on commercial_billing.cards for each row execute function commercial_billing.lineup_transfer_guard();
  create trigger commercial_lineup_listing before insert on commercial_billing.listings for each row execute function commercial_billing.lineup_transfer_guard();
 end if;
end$$;
