-- PREPARED ONLY. Separate founder deployment approval required.
-- Read-only bridge: no copied cards, minting, wallet conversion or custody edits.
-- The trusted server role supplies its already authenticated member ID, exactly
-- as for existing commercial reads. No browser/Auth role can execute this helper.
create or replace function commercial_billing.preserved_collection_rows(u uuid,sport_id text)
returns table(id text,rarity text,serial bigint,snapshot jsonb,acquired_at timestamptz,preserved jsonb)
language sql stable security definer set search_path='' as $$
 with ledger as materialized(select document->'commerce'->'cards' commerce,
   document->'cards' cards,document->'economy'->'instances' instances,
   document->'economy'->'players' players,document->'entitlements' entitlements
   from credits_sandbox.state where id and u is not null and sport_id in('nfl','afl','nrl')),
 beta_owned as materialized(
  select c.key id,c.value commerce,l.instances->c.key instance,
    l.cards->c.key card,l.players->(l.instances->c.key->>'playerId') player
  from ledger l cross join lateral jsonb_each(l.commerce)c
  where c.value->>'owner'=u::text and c.value->>'sport'=sport_id and l.cards ? c.key
   and (l.instances->c.key->>'source' is null
    or l.entitlements->(l.instances->c.key->>'source')->>'status'='OPENED')
 ), beta_rows as (
  select b.id,coalesce(b.instance->>'rarity',b.commerce->>'tier') rarity,
   coalesce((b.instance->>'serial')::bigint,0) serial,
   jsonb_build_object('name',coalesce(b.player->>'name','Test Player '||split_part(b.id,'-',4)),
    'team',coalesce(b.player->>'currentTeam','Docked Test Squad'),'position',coalesce(b.player->>'position','')) snapshot,
   (select to_timestamp(max((h->>'at')::numeric)/1000) from jsonb_array_elements(b.card->'history')h where h->>'to'=u::text) acquired_at,
   jsonb_build_object('id',b.id,'inventory','beta','commerce',b.commerce-'owner'-'reserved','instance',b.instance,'player',b.player) preserved
  from beta_owned b
 ), legacy_rows as (
  select c.id::text id,e.tier rarity,c.serial::bigint serial,
   jsonb_build_object('name',p.name,'team',coalesce(np.current_team,p.team),'position',p.position) snapshot,
   coalesce((select max(o.created_at) from beta_fantasy.ownership_events o where o.card_id=c.id and o.to_user=u),c.created_at) acquired_at,
   jsonb_build_object('id',c.id,'inventory','collectible','card',jsonb_build_object(
    'id',c.id,'player_id',p.id,'canonical_player_id',cp.id,'name',p.name,'sport',p.sport,
    'team',coalesce(np.current_team,p.team),'position',p.position,'tier',e.tier,'serial',c.serial,
    'max_supply',case when e.tier='CORE' and cp.id is not null then 0 else e.max_supply end,
    'season',e.season,'edition_id',e.id,'kind',e.kind,'colour',p.colour,'shirt',p.shirt,'status',p.status,'tradeable',false)) preserved
  from beta_fantasy.cards c join beta_fantasy.editions e on e.id=c.edition_id
  join beta_fantasy.players p on p.id=e.player_id
  left join sports_feed.nfl_players np on np.player_id=p.id and p.sport='nfl'
  left join credits_sandbox.permanent_players cp on cp.provider='nflverse' and cp.provider_id=np.provider_id and cp.sport='nfl'
  where u is not null and sport_id in('nfl','afl','nrl') and c.owner_id=u and p.sport=sport_id
   and not exists(select 1 from beta_fantasy.pack_items pi join beta_fantasy.packs pa on pa.id=pi.pack_id where pi.card_id=c.id and pa.opened_at is null)
   -- Current custody always wins over an obsolete owner in the older ledger.
   and not exists(select 1 from ledger l where l.commerce ? c.id::text)
 )
 select * from beta_rows union all select * from legacy_rows
$$;
revoke all on function commercial_billing.preserved_collection_rows(uuid,text)
 from public,anon,authenticated,service_role,docked_app,docked_beta_app,docked_commercial_app;
grant execute on function commercial_billing.preserved_collection_rows(uuid,text) to docked_commercial_app;
comment on function commercial_billing.preserved_collection_rows(uuid,text) is
 'Read-only historical owner projection for the authenticated commercial server adapter. Never converts beta credits/cards or permits cross-ledger resale. NBA excluded.';

-- Profile counts must describe the same inventory as the paginated Cards view.
create or replace function commercial_billing.member_record(sport_id text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare u uuid;answer jsonb;begin
 u:=auth.uid();
 if u is null or sport_id not in('nfl','afl','nrl') or not private.active_member_session()
 then raise exception 'Authenticated member required';end if;
 with commercial as materialized (
  select c.id::text id,d.rarity from commercial_billing.cards c join commercial_billing.definitions d on d.id=c.definition
  join commercial_billing.packs p on p.id=c.pack where c.owner_id=u and d.sport=sport_id and p.opened_at is not null
 ), owned as materialized (
  select * from commercial union all
  select p.id,p.rarity from commercial_billing.preserved_collection_rows(u,sport_id)p
  where not exists(select 1 from commercial_billing.cards c where c.id::text=p.id)
 ), counts as(select rarity,count(*)::int n from owned group by rarity)
 select jsonb_build_object('member',u,'sport',sport_id,'total',(select count(*) from owned),
  'counts',coalesce((select jsonb_object_agg(rarity,n) from counts),'{}'),
  'entries',(select count(*) from beta_fantasy.entries e join beta_fantasy.competitions c on c.id=e.competition_id where e.user_id=u and c.sport=sport_id),
  'opened',(select count(*) from commercial_billing.packs where member_id=u and product->>'sport'=sport_id and opened_at is not null),
  'revision',md5(coalesce((select string_agg(id,',' order by id) from owned),''))) into answer;
 return answer;
end$$;
revoke all on function commercial_billing.member_record(text) from public,anon,authenticated,service_role,docked_beta_app,docked_commercial_app;
grant execute on function commercial_billing.member_record(text) to docked_app;
