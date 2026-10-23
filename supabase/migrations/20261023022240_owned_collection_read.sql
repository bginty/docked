-- Read-only collection projection over the TWO existing authoritative ledgers.
-- No inventory writes, entitlement changes, new ownership table or RLS changes.
-- SECURITY DEFINER follows collection_export_legacy's existing private read boundary:
-- session/admission/MFA are checked inside; only the server runtime may execute.
create or replace function beta_fantasy.owned_collection_page(f jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare u uuid; sport_id text:=coalesce(f->>'sport','nfl'); result jsonb;
begin
 u:=beta_fantasy.production_eligible();
 if u is null or not coalesce(beta_private.active_member_session(),false) then raise exception 'Active admitted session required' using errcode='42501';end if;
 if sport_id not in ('nfl','basketball','afl','nrl') then raise exception 'Unsupported collection sport';end if;
 if sport_id<>'nfl' then
  if current_setting('docked.private_beta_sport',true) is distinct from sport_id
    or sports_feed.private_beta_sport_identity() is distinct from u then raise exception 'Private sport access required' using errcode='42501';end if;
 end if;
 if coalesce((f->>'offset')::int,0)<0 or coalesce((f->>'offset')::int,0)>100000
 or coalesce(f->>'sort','recent') not in ('recent','rarity','name','serial')
 or length(coalesce(f->>'search',''))>80 then raise exception 'Invalid collection query';end if;

 with ledger as materialized(select document->'commerce'->'cards' commerce,
   document->'cards' cards,document->'economy'->'instances' instances,
   document->'economy'->'players' players,document->'entitlements' entitlements
   from credits_sandbox.state where id),
 beta_owned as materialized(
  select c.key id,c.value commerce,l.instances->c.key instance,
    l.cards->c.key card,l.players->(l.instances->c.key->>'playerId') player
  from ledger l cross join lateral jsonb_each(l.commerce) c
  where c.value->>'owner'=u::text and c.value->>'sport'=sport_id and l.cards ? c.key
  and (l.instances->c.key->>'source' is null
       or l.entitlements->(l.instances->c.key->>'source')->>'status'='OPENED')
 ),
 beta_rows as (
  select b.id,coalesce(b.player->>'name','Test Player '||split_part(b.id,'-',4)) name,
   coalesce(b.player->>'currentTeam','Docked Test Squad') team,coalesce(b.player->>'position','') position,
   coalesce(b.instance->>'rarity',b.commerce->>'tier') tier,coalesce((b.instance->>'serial')::bigint,0) serial,
   coalesce((select max((h->>'at')::numeric) from jsonb_array_elements(b.card->'history')h where h->>'to'=u::text),0) acquired,
   jsonb_build_object('id',b.id,'inventory','beta','commerce',b.commerce-'owner'-'reserved','instance',b.instance,'player',b.player) payload
  from beta_owned b
 ),
 legacy_rows as (
  select c.id::text id,p.name,coalesce(np.current_team,p.team) team,p.position,e.tier,c.serial,
   extract(epoch from coalesce((select max(o.created_at) from beta_fantasy.ownership_events o where o.card_id=c.id and o.to_user=u),c.created_at))*1000 acquired,
   jsonb_build_object('id',c.id,'inventory','collectible','card',jsonb_build_object('id',c.id,'player_id',p.id,'canonical_player_id',cp.id,'name',p.name,'sport',p.sport,'team',coalesce(np.current_team,p.team),'position',p.position,'tier',e.tier,'serial',c.serial,'max_supply',case when e.tier='CORE' and cp.id is not null then 0 else e.max_supply end,'season',e.season,'edition_id',e.id,'kind',e.kind,'colour',p.colour,'shirt',p.shirt,'status',p.status,'tradeable',c.tradeable)) payload
  from beta_fantasy.cards c join beta_fantasy.editions e on e.id=c.edition_id join beta_fantasy.players p on p.id=e.player_id
  left join sports_feed.nfl_players np on np.player_id=p.id and p.sport='nfl'
  left join credits_sandbox.permanent_players cp on cp.provider='nflverse' and cp.provider_id=np.provider_id and cp.sport='nfl'
  where c.owner_id=u and p.sport=sport_id
   and not exists(select 1 from beta_fantasy.pack_items pi join beta_fantasy.packs pa on pa.id=pi.pack_id where pi.card_id=c.id and pa.opened_at is null)
   -- A transferred current-ledger identity must never fall back to a stale legacy owner.
   and not exists(select 1 from ledger l where l.commerce ? c.id::text)
 ),
 owned as materialized(select * from beta_rows union all select * from legacy_rows),
 summary as (
  select count(*) total,md5(coalesce(string_agg(payload::text||acquired::text,',' order by id),'')) revision,
   coalesce(jsonb_agg(distinct team order by team)filter(where team<>''),'[]') teams,
   coalesce(jsonb_agg(distinct position order by position)filter(where position<>''),'[]') positions from owned
 ),
 filtered as materialized(
  select *,array_position(array['CORE','RARE','ELITE','ULTRA_RARE','LEGENDARY','ICON'],tier) rarity_order
  from owned where (coalesce(f->>'rarity','ALL')='ALL' or tier=f->>'rarity')
   and (coalesce(f->>'team','')='' or team=f->>'team') and (coalesce(f->>'position','')='' or position=f->>'position')
   and (coalesce(f->>'search','')='' or position(lower(f->>'search') in lower(name||' '||team))>0
    or (f->'search_teams') ? team
    or ltrim(replace(f->>'search','#',''),'0')=serial::text or position(lower(f->>'search') in serial::text)>0)
 ),
 page as (
  select * from filtered
  where coalesce(f->>'revision','')='' or f->>'revision'=(select revision from summary)
  order by case when coalesce(f->>'sort','recent')='recent' then acquired end desc,
    case when f->>'sort'='rarity' then rarity_order end desc,
    case when f->>'sort'='name' then lower(name) end,
    case when f->>'sort'='serial' then serial end,id
  limit 18 offset coalesce((f->>'offset')::int,0)
 )
 select jsonb_build_object('total',s.total,'revision',s.revision,'teams',s.teams,'positions',s.positions,
  'counts',coalesce((select jsonb_object_agg(tier,n)from(select tier,count(*) n from owned group by tier)c),'{}'),
  'filtered',(select count(*) from filtered),
  'changed',coalesce(f->>'revision','')<>'' and f->>'revision'<>s.revision,
  'rows',coalesce((select jsonb_agg(payload||jsonb_build_object('acquired_at',case when acquired>0 then to_timestamp(acquired/1000)end))from page),'[]')) into result from summary s;
 return result;
end $$;
revoke all on function beta_fantasy.owned_collection_page(jsonb) from public,anon,authenticated,service_role,docked_app;
grant execute on function beta_fantasy.owned_collection_page(jsonb) to docked_beta_app;
comment on function beta_fantasy.owned_collection_page(jsonb) is 'Session-scoped owned collectibles only, 18 per page. No catalogue/Core-selection inference. Revision-checked stable pagination across existing ledgers.';
