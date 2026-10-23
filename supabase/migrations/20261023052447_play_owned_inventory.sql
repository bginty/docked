-- Owner instruction 23 October: private-beta Play uses settled owned inventory.
-- No cards, grants, drafts, locked snapshots, balances or results are rewritten.
-- Expand the large settled JSON ledger once, before joining individual cards.
-- Previously each card repeatedly detoasted/read the entire ledger document.
create or replace function sports_feed.rarity_inventory(u uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 with ledger as materialized (
  select document#>'{commerce,cards}' cards,document->'listings' listings,
   document#>'{economy,packs}' packs,document#>>'{economy,id}' economy_id,
   (document#>>'{economy,enabled}')::boolean enabled
  from credits_sandbox.state where id
 ), owned as materialized (
  select c.key id from ledger l cross join lateral jsonb_each(l.cards)c
  where c.value->>'owner'=u::text and l.economy_id='invited-nfl-test-v2' and l.enabled
 ), opened as materialized (
  select p.key id from ledger l cross join lateral jsonb_each(l.packs)p where p.value->>'openedAt' is not null
 ), listed as materialized (
  select l.value->>'card' id from ledger s cross join lateral jsonb_each(s.listings)l where l.value->>'status'='OPEN'
 ), roster as materialized (select * from credits_sandbox.current_player_status), limited as (
  select jsonb_build_object('id',i.id,'edition_id',i.definition,'owner_id',u,'serial',i.serial,
   'tradeable',true,'created_at',to_timestamp((i.document->>'mintedAt')::numeric/1000),'acquired_at',to_timestamp((i.document->>'mintedAt')::numeric/1000),
   'name',p.identity->>'name','position',r.position,'tier',d.rarity,'season','lifetime','kind','regular',
   'max_supply',d.lifetime_cap,'player_id',p.id,'team',r.team,'edition_team',i.document->>'printedTeam','provider_id',p.provider_id,
   'colour','#1677FF','shirt',1,'sport','nfl','inventory_scope','invited-nfl-test-v2',
   'status',case when r.status='ACT' and r.checked_at>clock_timestamp()-interval '72 hours' then 'active' else 'unavailable' end,
   'listed',exists(select 1 from listed l where l.id=i.id::text),
   'multiplier',(rc.document->'rarities'->d.rarity->>'multiplierTenths')::numeric/10,
   'multiplierTenths',(rc.document->'rarities'->d.rarity->>'multiplierTenths')::int,'rarityVersion',d.rarity_version) card
  from owned o join credits_sandbox.card_instances i on i.id::text=o.id
  join credits_sandbox.card_definitions d on d.id=i.definition
  join credits_sandbox.permanent_players p on p.id=d.player_id
  join roster r on r.id=p.id join credits_sandbox.rarity_configuration rc on rc.version=d.rarity_version
  where exists(select 1 from opened where id=i.document->>'source')
   and exists(select 1 from credits_sandbox.access where user_id=u and enabled)
 ) select coalesce(jsonb_agg(card),'[]') from limited
$$;
revoke all on function sports_feed.rarity_inventory(uuid) from public,anon,authenticated,service_role,docked_app,docked_beta_app;

create or replace function sports_feed.owned_sport_inventory(u uuid, sport_id text)
returns jsonb language sql stable security definer set search_path='' as $$
 with ledger as materialized (
  select document->'commerce'->'cards' commerce,document->'cards' cards,
   document->'economy'->'instances' instances,document->'entitlements' entitlements
  from credits_sandbox.state where id
 ), owned_ids as materialized (
  select c.key id from ledger l cross join lateral jsonb_each(l.commerce)c
  where c.value->>'owner'=u::text and c.value->>'sport'=sport_id and l.cards ? c.key
   and (l.instances->c.key->>'source' is null or l.entitlements->(l.instances->c.key->>'source')->>'status'='OPENED')
  union all
  select c.id::text from beta_fantasy.cards c join beta_fantasy.editions e on e.id=c.edition_id
   join beta_fantasy.players p on p.id=e.player_id
  where c.owner_id=u and p.sport=sport_id
   and not exists(select 1 from beta_fantasy.pack_items pi join beta_fantasy.packs pa on pa.id=pi.pack_id where pi.card_id=c.id and pa.opened_at is null)
   and not exists(select 1 from ledger l where l.commerce ? c.id::text)
 )
 select coalesce(jsonb_agg(card),'[]')
 from sports_feed.sport_sandbox_inventory i cross join lateral jsonb_array_elements(i.cards)card
 where i.user_id=u and i.sport=sport_id and card->>'owner_id'=u::text and card->>'sport'=sport_id
  and exists(select 1 from owned_ids o where o.id=card->>'id')
$$;
revoke all on function sports_feed.owned_sport_inventory(uuid,text) from public,anon,authenticated,service_role,docked_app,docked_beta_app;

-- The existing caller retains admission/MFA/round guards and row-locks. Keep the
-- isolated, non-production QA harness unchanged; live private beta always sets
-- docked.nba_private_beta after server authorization, never from client input.
create or replace function sports_feed.lineup_inventory(u uuid,cid uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare sport_id text;begin
 select sport into sport_id from beta_fantasy.competitions where id=cid;
 if sport_id='nfl' then return sports_feed.seven_inventory(u);end if;
 if u is distinct from auth.uid() or sports_feed.lineup_scope_allowed(cid) is distinct from true then raise exception 'Isolated sport access required';end if;
 if current_setting('docked.nba_private_beta',true)='enabled' then return sports_feed.owned_sport_inventory(u,sport_id);end if;
 return coalesce((select cards from sports_feed.sport_sandbox_inventory where user_id=u and sport=sport_id),'[]');
end$$;
revoke all on function sports_feed.lineup_inventory(uuid,uuid) from public,anon,authenticated,service_role,docked_app,docked_beta_app;

do $$declare b text;needle text;replacement text;begin
 b:=pg_get_functiondef('sports_feed.sport_sandbox_state(text)'::regprocedure);
 needle:='''cards'',coalesce((select cards from sports_feed.sport_sandbox_inventory where user_id=u and sport=sport_id),''[]'')';
 replacement:='''cards'',case when current_setting(''docked.nba_private_beta'',true)=''enabled'' then sports_feed.owned_sport_inventory(u,sport_id) else coalesce((select cards from sports_feed.sport_sandbox_inventory where user_id=u and sport=sport_id),''[]'') end';
 if position(needle in b)>0 then execute replace(b,needle,replacement);
 elsif position('sports_feed.owned_sport_inventory' in b)=0 then raise exception 'Unexpected sport state projection';end if;
end$$;
