set local lock_timeout='5s'; set local statement_timeout='60s';
do $$begin if not pg_try_advisory_xact_lock(71820342) then raise exception 'Active settlement: retry maintenance later';end if;end$$;
create temporary table incident_guard_integrity(name text primary key, fingerprint text) on commit drop;
do $$declare tab text; fingerprint text;begin
foreach tab in array array['credits_sandbox.state','credits_sandbox.journal','credits_sandbox.lines','credits_sandbox.card_instances','credits_sandbox.pack_receipts','credits_sandbox.nba_fixture_instances','sports_feed.sport_sandbox_inventory','beta_fantasy.cards','beta_fantasy.ownership_events','private.feature_flags'] loop
execute format('select md5(coalesce(string_agg(h, %L order by h), %L)) from (select md5(to_jsonb(t)::text) h from %s t) q','','',tab) into fingerprint;
insert into incident_guard_integrity values(tab,fingerprint);
end loop;
end$$;
create temporary table incident_guard_permissions on commit drop as
select oid,proowner,proacl,prosecdef,proconfig from pg_proc where oid in
('credits_sandbox.guard_economy_state()'::regprocedure,'credits_sandbox.marketplace_guard()'::regprocedure,'credits_sandbox.project_fixture_inventory()'::regprocedure);
-- Cache an exact, materialised JSONB value once per trigger invocation.
-- The previous code repeatedly detoasted the multi-MB state in card loops.
-- Every original validation, immutable receipt, cap, ownership check and grant is retained.
-- JSONB -> text -> JSONB is value preserving and forces a non-TOAST local value.

CREATE OR REPLACE FUNCTION credits_sandbox.guard_economy_state()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
 _cached_new_document jsonb := new.document::text::jsonb;
 _cached_old_document jsonb := old.document::text::jsonb; e jsonb:=_cached_new_document->'economy'; previous jsonb:=_cached_old_document->'economy'; item record; d jsonb; config jsonb; registered jsonb; cnt int; fixture boolean;fixture_sport text;begin
 if previous is not null and e is null then raise exception 'Economy history cannot be removed';end if;
 if e is null then return new;end if;
 if e->>'id' is distinct from 'invited-nfl-test-v2' or _cached_new_document->'policy'->>'liveEnabled' is distinct from 'false'
 or _cached_new_document->'policy'->>'purchasedWithdrawable' is distinct from 'false' then raise exception 'Isolated nonwithdrawable economy required';end if;
 if previous is null and current_user='docked_beta_app' then raise exception 'Operator migration required';end if;
 if current_user='docked_beta_app' and previous->'enabled' is distinct from e->'enabled' then raise exception 'Operator activation required';end if;
 if current_user='docked_beta_app' and previous->'nbaTestAllocation' is distinct from e->'nbaTestAllocation' then raise exception 'Operator NBA fixture activation required';end if;
 if e ? 'nbaTestAllocation' and (e->'nbaTestAllocation'->>'scope' is distinct from 'isolated-fixtures-v1' or jsonb_typeof(e->'nbaTestAllocation'->'enabled') is distinct from 'boolean') then raise exception 'Isolated NBA fixture scope required';end if;
 if current_user='docked_beta_app' and previous->'fixtureTestAllocation' is distinct from e->'fixtureTestAllocation' then raise exception 'Operator fixture activation required';end if; if e->>'enabled'='true' and exists(select 1 from jsonb_object_keys(_cached_new_document->'commerce'->'orders') k where not coalesce(_cached_old_document->'commerce'->'orders','{}') ? k) then raise exception 'Legacy single-card purchases retired';end if;
 select document into config from credits_sandbox.rarity_configuration where version=e->>'rarityVersion';
 if config is null then raise exception 'Unknown rarity version';end if;
 for item in select key,value from jsonb_each(e->'players') loop
  if (item.value->>'sport' in ('basketball','afl','nrl') and (item.value->'synthetic'='true'::jsonb or credits_sandbox.is_roster_beta_player(item.value))) then
   select identity into registered from credits_sandbox.nba_fixture_players where id=item.key;
   if registered is distinct from item.value then raise exception 'Registered isolated player identity required';end if;
  else
   select identity into registered from credits_sandbox.permanent_players where id=item.key;
  end if;
  if registered is null or item.value->>'id'<>item.key or item.value->>'providerId'<>registered->>'providerId'
   or item.value->>'provider'<>registered->>'provider' or item.value->>'sport'<>registered->>'sport'
   or item.value->>'assetKind'<>registered->>'assetKind' then raise exception 'Permanent player identity mismatch';end if;
 end loop;
 for item in select key,value from jsonb_each(e->'products') loop
  select document into registered from credits_sandbox.pack_configuration where version=item.value->>'version';
  if registered is distinct from item.value or item.key<>item.value->>'id' or (item.value->>'cards')::int not in (1,3,9)
    or item.value->>'status'<>'TEST_ONLY' or (item.value->'weights'->>'ICON')::int<1
    or item.value->'weights' ? 'CORE' then raise exception 'Unregistered pack product';end if;
 end loop;
 for item in select key,value from jsonb_each(coalesce(e->'retiredTestInstances','{}')) loop
  if e->'instances' ? item.key or not exists(select 1 from nfl_roster.retired_test_cards a where a.card_id=item.key and a.allocation=item.value) then raise exception 'Unapproved retirement or resurrection';end if;
 end loop;
 for item in select key,value from jsonb_each(coalesce(previous->'retiredTestInstances','{}')) loop
  if e->'retiredTestInstances'->item.key is distinct from item.value then raise exception 'Retired scarcity cannot change';end if;
 end loop;
 for item in select key,value from jsonb_each(coalesce(previous->'instances','{}')) loop
  if e->'retiredTestInstances'->item.key=item.value and exists(select 1 from nfl_roster.retired_test_cards a where a.card_id=item.key and a.allocation=item.value and a.ownership=_cached_old_document->'commerce'->'cards'->item.key and a.history=_cached_old_document->'cards'->item.key) then
   if _cached_new_document->'commerce'->'cards' ? item.key or _cached_new_document->'cards' ? item.key then raise exception 'Retired ownership remains active';end if;
   continue;
  end if;
  if e->'instances'->item.key is distinct from item.value then raise exception 'Issued identity/serial is immutable';end if;
  if not(_cached_new_document->'commerce'->'cards' ? item.key) or not(_cached_new_document->'cards' ? item.key) then raise exception 'Ownership evidence required';end if;
  if exists(select 1 from jsonb_array_elements(_cached_old_document->'cards'->item.key->'history') with ordinality h(v,n) where _cached_new_document->'cards'->item.key->'history'->((h.n-1)::int) is distinct from h.v) then raise exception 'Ownership history append required';end if;
 end loop;
 for item in select key,value from jsonb_each(e->'definitions') loop
  if item.key<>((item.value->>'playerId')||':'||(item.value->>'rarity')) then raise exception 'Lifetime definition key';end if;
  select count(*) into cnt from jsonb_each(coalesce(e->'retiredTestInstances','{}') || (e->'instances')) x where x.value->>'definition'=item.key;
  if cnt<>(item.value->>'issued')::int then raise exception 'Issuance count mismatch';end if;
  if (e->'players'->(item.value->>'playerId')->>'sport' in ('basketball','afl','nrl') and (e->'players'->(item.value->>'playerId')->'synthetic'='true'::jsonb or credits_sandbox.is_roster_beta_player(e->'players'->(item.value->>'playerId')))) then
   if not exists(select 1 from credits_sandbox.nba_fixture_definitions where id=item.key) then insert into credits_sandbox.nba_fixture_definitions values(item.key,item.value->>'playerId',item.value->>'rarity',e->>'rarityVersion',(config->'rarities'->(item.value->>'rarity')->>'lifetimeCap')::int);end if;
  else
   insert into credits_sandbox.card_definitions values(item.key,item.value->>'playerId',item.value->>'rarity',e->>'rarityVersion',(config->'rarities'->(item.value->>'rarity')->>'lifetimeCap')::int) on conflict do nothing;
  end if;
 end loop;
 for item in select key,value from jsonb_each(e->'instances') order by (value->>'serial')::int loop
  fixture:=(e->'players'->(item.value->>'playerId')->>'sport' in ('basketball','afl','nrl') and (e->'players'->(item.value->>'playerId')->'synthetic'='true'::jsonb or credits_sandbox.is_roster_beta_player(e->'players'->(item.value->>'playerId'))));
  fixture_sport:=e->'players'->(item.value->>'playerId')->>'sport'; if fixture then
   if e->'packs'->(item.value->>'source')->'product'->>'sport' is distinct from fixture_sport then raise exception 'NBA fixture pack scope mismatch';end if;
   if previous->'instances'->item.key is distinct from item.value
    or _cached_old_document->'commerce'->'cards'->item.key is distinct from _cached_new_document->'commerce'->'cards'->item.key
    or _cached_old_document->'cards'->item.key is distinct from _cached_new_document->'cards'->item.key then
    if not credits_sandbox.fixture_allocation_enabled(e,fixture_sport) then raise exception 'NBA fixture allocation disabled';end if;
    perform credits_sandbox.assert_sport_fixture_member(_cached_new_document->'commerce'->'cards'->item.key->>'owner',fixture_sport);
    if _cached_old_document->'commerce'->'cards' ? item.key then perform credits_sandbox.assert_sport_fixture_member(_cached_old_document->'commerce'->'cards'->item.key->>'owner',fixture_sport);end if;
   end if;
   select document into registered from credits_sandbox.nba_fixture_instances where id=item.key::uuid;
  else
   select document into registered from credits_sandbox.card_instances where id=item.key::uuid;
  end if;
  if registered is null then
   fixture_sport:=e->'players'->(item.value->>'playerId')->>'sport'; if fixture then
    insert into credits_sandbox.nba_fixture_instances values(item.key::uuid,item.value->>'definition',(item.value->>'serial')::int,item.value);
   else
    insert into credits_sandbox.card_instances values(item.key::uuid,item.value->>'definition',(item.value->>'serial')::int,item.value);
   end if;
  elsif registered is distinct from item.value then raise exception 'Serial already issued';end if;
  if _cached_new_document->'commerce'->'cards'->item.key->>'tier' is distinct from item.value->>'rarity'
    or _cached_new_document->'commerce'->'cards'->item.key->>'owner' is null
    or _cached_new_document->'cards'->item.key->'history'->-1->>'to' is distinct from _cached_new_document->'commerce'->'cards'->item.key->>'owner'
    or not coalesce(e->'packs'->(item.value->>'source')->'cards','[]') ? item.key then raise exception 'Owned rarity required';end if;
 end loop;
 if ((select count(*) from credits_sandbox.card_instances)+(select count(*) from credits_sandbox.nba_fixture_instances))<>(select count(*) from jsonb_each(coalesce(e->'retiredTestInstances','{}') || (e->'instances'))) then raise exception 'Historical issuance missing';end if;
 for item in select key,value from jsonb_each(e->'packs') loop
  fixture_sport:=item.value->'product'->>'sport'; if fixture_sport in ('basketball','afl','nrl') and previous->'packs'->item.key is distinct from item.value then
   if not credits_sandbox.fixture_allocation_enabled(e,fixture_sport) then raise exception 'NBA fixture allocation disabled';end if;
   perform credits_sandbox.assert_sport_fixture_member(item.value->>'member',fixture_sport);
  end if;
  select document into registered from credits_sandbox.pack_configuration where version=item.value->'product'->>'version';
  if registered is null or registered is distinct from item.value->'product' then raise exception 'Unregistered pack receipt configuration';end if;
  if jsonb_array_length(item.value->'cards')<>(registered->>'cards')::int or
    (select count(distinct x) from jsonb_array_elements_text(item.value->'cards')x)<>(registered->>'cards')::int then raise exception 'Purchased card count and unique instances required';end if;
  for d in select value from jsonb_array_elements(item.value->'cards') loop
   if item.value->'product'->>'inventoryScope'='real-roster-beta-v1' and not credits_sandbox.is_roster_beta_player(e->'players'->(e->'instances'->(d#>>'{}')->>'playerId')) then raise exception 'Real-roster test pack requires verified isolated inventory';end if; if (coalesce(e->'retiredTestInstances','{}') || (e->'instances'))->(d#>>'{}')->>'source' is distinct from item.key then raise exception 'Pack allocation mismatch';end if;
   if fixture_sport in ('basketball','afl','nrl') and e->'players'->(e->'instances'->(d#>>'{}')->>'playerId')->>'sport' is distinct from fixture_sport then raise exception 'NBA fixture pack scope mismatch';end if;
  end loop;
  select document into registered from credits_sandbox.pack_receipts where id=item.key;
  if registered is null then insert into credits_sandbox.pack_receipts values(item.key,item.value-'openedAt');
  elsif registered is distinct from item.value-'openedAt' then raise exception 'Confirmed pack cannot be rerolled';end if;
  if previous->'packs'->item.key->>'openedAt' is not null and previous->'packs'->item.key->'openedAt' is distinct from item.value->'openedAt' then raise exception 'Opening receipt immutable';end if;
 end loop;
 if (select count(*) from credits_sandbox.pack_receipts)<>(select count(*) from jsonb_each(e->'packs')) then raise exception 'Pack history missing';end if;
 return new;
end$function$
;

CREATE OR REPLACE FUNCTION credits_sandbox.marketplace_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 _cached_new_document jsonb := new.document::text::jsonb;
 _cached_old_document jsonb := old.document::text::jsonb; item record; prior jsonb; l jsonb; cid text;begin
 perform pg_advisory_xact_lock(71820342);
 if exists(select 1 from jsonb_each(_cached_new_document->'listings') x where x.value->>'status'='OPEN' group by x.value->>'card' having count(*)>1) then raise exception 'One active listing per card';end if;
 for item in select key,value from jsonb_each(_cached_old_document->'requests') loop
  if _cached_new_document->'requests'->item.key is distinct from item.value then raise exception 'Transaction identity and receipt immutable';end if;
 end loop;
 for item in select key,value from jsonb_each(_cached_new_document->'listings') loop
  l:=item.value;prior:=_cached_old_document->'listings'->item.key; if prior is distinct from l and exists(select 1 from credits_sandbox.nba_fixture_instances where id::text=l->>'card') and not credits_sandbox.fixture_trade_allowed(_cached_new_document,jsonb_build_array(l->>'card'),array[l->>'member']) then raise exception 'Fixture trading disabled or admission revoked';end if;
  if jsonb_typeof(l->'price') is distinct from 'number' or (l->>'price')::numeric not between 0 and 1000000000 or trunc((l->>'price')::numeric)<>(l->>'price')::numeric then raise exception 'Positive integer credit price required';end if;
  if coalesce(l->>'preference','sell') not in ('sell','swap','both') or ((coalesce(l->>'preference','sell')='swap') <> ((l->>'price')::numeric=0)) then raise exception 'Listing preference and price mismatch';end if;
  if l->>'status' is null or l->>'status' not in('OPEN','SOLD','CANCELLED') then raise exception 'Invalid listing status';end if;
  if prior is not null and ((prior-array['status','buyer','receipt','cancelledAt','price','revision','feePolicy']) is distinct from (l-array['status','buyer','receipt','cancelledAt','price','revision','feePolicy']) or (prior->>'status'<>'OPEN' and prior is distinct from l)) then raise exception 'Listing terms and closed history immutable';end if;
  if l->>'status'='OPEN' and (coalesce(l->>'preference','sell')<>'sell' or (l->>'price')::bigint<1) and not credits_sandbox.fixture_trade_allowed(_cached_new_document,jsonb_build_array(l->>'card'),array[l->>'member']) then raise exception 'Only fixed-price credit listings supported';end if;
  if prior is not null and prior->>'status'='OPEN' and l->>'status'<>'OPEN' and (prior->'price' is distinct from l->'price' or prior->'revision' is distinct from l->'revision' or prior->'feePolicy' is distinct from l->'feePolicy') then raise exception 'Closing listing terms immutable';end if;
  if prior is not null and prior->>'status'='OPEN' and l->>'status'='OPEN' and l is distinct from prior then
   if coalesce((l->>'revision')::int,0)<>coalesce((prior->>'revision')::int,0)+1 then raise exception 'Listing revision required';end if;
   if auth.uid() is not null and auth.uid()::text<>l->>'member' then raise exception 'Only the seller may edit this listing';end if;
   if l->>'feePolicy'<>'credit-sale-5pct-cap2000-v2' then raise exception 'Current fee policy required';end if;
  end if;
  if l->>'status'='OPEN' and (_cached_new_document#>>array['commerce','cards',l->>'card','owner'] is distinct from l->>'member' or _cached_new_document#>>array['cards',l->>'card','version'] is distinct from l->>'version') then raise exception 'Listing ownership/version required';end if;
  if prior is null then
   if l->>'feePolicy' is distinct from 'credit-sale-5pct-cap2000-v2' or l->>'revision' is distinct from '1' then raise exception 'Current fee policy and initial revision required';end if;
   if l->>'status'<>'OPEN' or _cached_new_document#>>array['commerce','cards',l->>'card','tier']='CORE' then raise exception 'Eligible limited test card required';end if;
   if sports_feed.card_entry_reserved((l->>'card')::uuid) then raise exception 'Card used by an unlocked submitted team';end if;
   if exists(select 1 from jsonb_each(_cached_new_document->'swaps') x where x.value->>'status'='OPEN' and (x.value->>'expires')::numeric>extract(epoch from clock_timestamp())*1000 and ((x.value->'give')||(x.value->'take')) ? (l->>'card')) then raise exception 'Card reserved by active swap';end if;
  end if;
  if l->>'status'='SOLD' and prior->>'status'='OPEN' then
   if l#>>'{receipt,feePolicy}' is distinct from 'credit-sale-5pct-cap2000-v2' then raise exception 'Recorded fee policy required';end if;
   if jsonb_typeof(l->'receipt') is distinct from 'object' or not (l->'receipt') ?& array['reference','at','price','fee','net'] or (l->'receipt'->>'price')::bigint<>(l->>'price')::bigint or (l->'receipt'->>'fee')::bigint<>least(2000,round((l->>'price')::numeric*0.05)) or (l->'receipt'->>'net')::bigint<>(l->>'price')::bigint-(l->'receipt'->>'fee')::bigint then raise exception 'Exact sale receipt required';end if;
   if _cached_new_document#>>array['commerce','cards',l->>'card','owner'] is distinct from l->>'buyer' or l->>'buyer'=l->>'member' then raise exception 'Sale ownership required';end if;
   if not exists(select 1 from credits_sandbox.journal j where j.id=l->'receipt'->>'reference') then raise exception 'Sale journal required';end if;
  end if;
 end loop;
 if exists(select 1 from jsonb_object_keys(_cached_old_document->'listings') k where not (_cached_new_document->'listings') ? k) then raise exception 'Listing history cannot be removed';end if;
 for item in select key,value from jsonb_each(_cached_new_document->'swaps') where value->>'status'='OPEN' and (value->>'expires')::numeric>extract(epoch from clock_timestamp())*1000 loop
  if _cached_old_document->'swaps'->item.key is null then
   for cid in select jsonb_array_elements_text((item.value->'give')||(item.value->'take')) loop
    if sports_feed.card_entry_reserved(cid::uuid) then raise exception 'Card used by an unlocked submitted team';end if;
   end loop;
  end if;
 end loop;
 for item in select key,value from jsonb_each(coalesce(_cached_new_document->'swaps','{}')) loop
  prior:=_cached_old_document->'swaps'->item.key;
  if (prior is null and item.value->>'status'='OPEN') or (prior->>'status'='OPEN' and item.value->>'status'='ACCEPTED') then if not credits_sandbox.fixture_trade_allowed(_cached_new_document,item.value->'give'||item.value->'take',array[item.value->>'member',item.value->>'other']) then raise exception 'New swaps and swap acceptance disabled';end if;end if;
 end loop;
 for item in select key,value from jsonb_each(coalesce(_cached_new_document->'privateCardOffers','{}')) loop
  prior:=_cached_old_document->'privateCardOffers'->item.key;
  if (prior is null and item.value->>'status'='OPEN') or (prior->>'status'='OPEN' and item.value->>'status'='ACCEPTED') then if not credits_sandbox.fixture_trade_allowed(_cached_new_document,jsonb_build_array(item.value->>'card')||coalesce((select jsonb_agg(x->>'id') from jsonb_array_elements(item.value->'offeredCards') x),'[]'),array[item.value->>'seller',item.value->>'buyer']) then raise exception 'Private offers disabled';end if;end if;
 end loop;
 return new;
end$function$
;

CREATE OR REPLACE FUNCTION credits_sandbox.project_fixture_inventory()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 _cached_new_document jsonb := new.document::text::jsonb;
 _cached_old_document jsonb := old.document::text::jsonb; target record; retained jsonb; owned jsonb; e jsonb:=_cached_new_document->'economy';begin
 if e is null then return new;end if;
 for target in
  select distinct c.value->>'owner' member,p.identity->>'sport' sport
  from jsonb_each(coalesce(_cached_old_document->'commerce'->'cards','{}')||coalesce(_cached_new_document->'commerce'->'cards','{}')) c
  join credits_sandbox.nba_fixture_instances i on i.id::text=c.key
  join credits_sandbox.nba_fixture_players p on p.id=i.document->>'playerId'
  union
  select distinct c.value->>'owner',p.identity->>'sport'
  from jsonb_each(coalesce(_cached_old_document->'commerce'->'cards','{}')) c
  join credits_sandbox.nba_fixture_instances i on i.id::text=c.key
  join credits_sandbox.nba_fixture_players p on p.id=i.document->>'playerId'
 loop
  select coalesce(jsonb_agg(card),'[]') into retained
  from sports_feed.sport_sandbox_inventory inv,jsonb_array_elements(inv.cards) card
  where inv.user_id=target.member::uuid and inv.sport=target.sport and card->>'inventory_source' is distinct from 'credits-fixture-v1';
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',i.id,'card_id',i.id,'player_id',coalesce(p.identity->>'fixturePlayerId',p.id),
    'owner_id',target.member,'name',p.identity->>'name','team',p.identity->>'currentTeam',
    'sport',target.sport,'position',p.identity->>'position','eligible_positions',coalesce(p.identity->'eligiblePositions',jsonb_build_array(p.identity->>'position')),
    'tier',i.document->>'rarity','serial',i.serial,'max_supply',(i.document->>'lifetimeCap')::int,
    'multiplierTenths',10,'status','active','season',case when credits_sandbox.is_roster_beta_player(p.identity) then 'REAL PLAYER · BETA INVENTORY' else 'SYNTHETIC TEST' end,'inventory_class',p.identity->>'inventoryClass','roster_source',p.identity->'rosterBeta','verifiedJerseyNumber',null,
    'inventory_source','credits-fixture-v1','listed',exists(select 1 from jsonb_each(_cached_new_document->'listings') l where l.value->>'card'=i.id::text and l.value->>'status'='OPEN')
  ) order by i.id),'[]') into owned
  from credits_sandbox.nba_fixture_instances i join credits_sandbox.nba_fixture_players p on p.id=i.document->>'playerId'
  where p.identity->>'sport'=target.sport and _cached_new_document->'commerce'->'cards'->i.id::text->>'owner'=target.member
   and e->'packs'->(i.document->>'source')->>'openedAt' is not null;
  if exists(select 1 from sports_feed.sport_sandbox_access where user_id=target.member::uuid) then
   insert into sports_feed.sport_sandbox_inventory(user_id,sport,cards) values(target.member::uuid,target.sport,coalesce(retained,'[]')||owned)
   on conflict(user_id,sport) do update set cards=excluded.cards where sport_sandbox_inventory.cards is distinct from excluded.cards;
  end if;
 end loop;
 return new;
end$function$
;


do $$declare tab text; fingerprint text;begin
foreach tab in array array['credits_sandbox.state','credits_sandbox.journal','credits_sandbox.lines','credits_sandbox.card_instances','credits_sandbox.pack_receipts','credits_sandbox.nba_fixture_instances','sports_feed.sport_sandbox_inventory','beta_fantasy.cards','beta_fantasy.ownership_events','private.feature_flags'] loop
execute format('select md5(coalesce(string_agg(h, %L order by h), %L)) from (select md5(to_jsonb(t)::text) h from %s t) q','','',tab) into fingerprint;
if fingerprint is distinct from (select i.fingerprint from incident_guard_integrity i where name=tab) then raise exception 'Protected data changed during migration';end if;
end loop;
if exists(select 1 from incident_guard_permissions b join pg_proc a using(oid) where row(a.proowner,a.proacl,a.prosecdef,a.proconfig) is distinct from row(b.proowner,b.proacl,b.prosecdef,b.proconfig)) then raise exception 'Function security metadata changed';end if;
end$$;
