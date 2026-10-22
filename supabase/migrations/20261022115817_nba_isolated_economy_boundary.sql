-- Isolated synthetic inventory only; no permanent NBA issuance or activation.
-- Shared wallet/state transaction and immutable receipt history remain authoritative.
-- Existing permanent-player sport constraint, definitions and instances are unchanged.
create table credits_sandbox.nba_fixture_players(
 id text primary key check(id like 'nba-fixture-%'), identity jsonb not null,
 check(coalesce(identity->>'id'=id and identity->>'sport'='basketball'
  and identity->>'provider'='fixture' and identity->>'providerId' like 'nba-fixture-%'
  and identity->'synthetic'='true'::jsonb and identity->>'assetKind'='player'
  and identity->>'position' in ('PG','SG','SF','PF','C'),false))
);
create table credits_sandbox.nba_fixture_definitions(
 id text primary key, player_id text not null references credits_sandbox.nba_fixture_players,
 rarity text not null check(rarity in ('RARE','ELITE','ULTRA_RARE','LEGENDARY','ICON')),
 rarity_version text not null references credits_sandbox.rarity_configuration,
 lifetime_cap integer not null check(lifetime_cap>0),unique(player_id,rarity)
);
create table credits_sandbox.nba_fixture_instances(
 id uuid primary key,definition text not null references credits_sandbox.nba_fixture_definitions,
 serial integer not null check(serial>0),document jsonb not null,unique(definition,serial)
);
-- Reuse authenticated NBA admission; only admitted, confirmed allowlisted peers
-- may receive or transfer fixtures. User-editable metadata is not consulted.
create function credits_sandbox.assert_nba_fixture_member(member text) returns void
language plpgsql security definer set search_path='' as $$begin
 perform sports_feed.nba_beta_identity();
 if not exists(select 1 from sports_feed.nba_beta_access b join auth.users u on u.id=b.user_id
  where b.user_id=member::uuid and b.enabled and b.expires_at>clock_timestamp()
   and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
   and coalesce(u.banned_until,'-infinity')<=clock_timestamp()
   and beta_private.admitted(u.id)) then raise exception 'NBA fixture counterparty unavailable';end if;
end$$;
revoke all on function credits_sandbox.assert_nba_fixture_member(text) from public,anon,authenticated,service_role;
grant execute on function credits_sandbox.assert_nba_fixture_member(text) to docked_beta_app;
create function credits_sandbox.check_nba_fixture_instance() returns trigger
language plpgsql security invoker set search_path='' as $$
declare d credits_sandbox.nba_fixture_definitions;begin
 select * into d from credits_sandbox.nba_fixture_definitions where id=new.definition;
 if d.id is null or new.serial>d.lifetime_cap
  or new.serial<>(select coalesce(max(serial),0)+1 from credits_sandbox.nba_fixture_instances where definition=new.definition)
  or new.document->>'id' is distinct from new.id::text
  or new.document->>'definition' is distinct from d.id
  or new.document->>'playerId' is distinct from d.player_id
  or new.document->>'rarity' is distinct from d.rarity
  or (new.document->>'serial')::int is distinct from new.serial
  or (new.document->>'lifetimeCap')::int is distinct from d.lifetime_cap
  or exists(select 1 from credits_sandbox.card_instances where id=new.id)
 then raise exception 'NBA fixture serial/cap violation';end if;
 return new;
end$$;
create trigger definition_guard before insert on credits_sandbox.nba_fixture_definitions
 for each row execute function credits_sandbox.check_definition();
create trigger instance_guard before insert on credits_sandbox.nba_fixture_instances
 for each row execute function credits_sandbox.check_nba_fixture_instance();
do $$declare t text;begin
 foreach t in array array['nba_fixture_players','nba_fixture_definitions','nba_fixture_instances'] loop
  execute format('alter table credits_sandbox.%I enable row level security',t);
  execute format('revoke all on credits_sandbox.%I from public,anon,authenticated,service_role,docked_beta_app',t);
  execute format('create trigger immutable before update or delete on credits_sandbox.%I for each row execute function credits_sandbox.immutable()',t);
  execute format('create trigger no_truncate before truncate on credits_sandbox.%I for each statement execute function credits_sandbox.immutable()',t);
  execute format('grant select on credits_sandbox.%I to docked_beta_app',t);
  execute format('create policy read_runtime on credits_sandbox.%I for select to docked_beta_app using(true)',t);
 end loop;
 -- No runtime insertion grants. A later reviewed activation migration must
 -- finish API admission, ownership projection and transaction acceptance first.
end$$;
revoke all on function credits_sandbox.check_nba_fixture_instance() from public,anon,authenticated,service_role;

create unique index nba_fixture_provider_identity on credits_sandbox.nba_fixture_players ((identity->>'providerId'));

create or replace function credits_sandbox.guard_economy_state() returns trigger language plpgsql security invoker set search_path='' as $$
declare e jsonb:=new.document->'economy'; previous jsonb:=old.document->'economy'; item record; d jsonb; config jsonb; registered jsonb; cnt int; fixture boolean;begin
 if previous is not null and e is null then raise exception 'Economy history cannot be removed';end if;
 if e is null then return new;end if;
 if e->>'id' is distinct from 'invited-nfl-test-v2' or new.document->'policy'->>'liveEnabled' is distinct from 'false'
 or new.document->'policy'->>'purchasedWithdrawable' is distinct from 'false' then raise exception 'Isolated nonwithdrawable economy required';end if;
 if previous is null and current_user='docked_beta_app' then raise exception 'Operator migration required';end if;
 if current_user='docked_beta_app' and previous->'enabled' is distinct from e->'enabled' then raise exception 'Operator activation required';end if;
 if current_user='docked_beta_app' and previous->'nbaTestAllocation' is distinct from e->'nbaTestAllocation' then raise exception 'Operator NBA fixture activation required';end if;
 if e ? 'nbaTestAllocation' and (e->'nbaTestAllocation'->>'scope' is distinct from 'isolated-fixtures-v1' or jsonb_typeof(e->'nbaTestAllocation'->'enabled') is distinct from 'boolean') then raise exception 'Isolated NBA fixture scope required';end if;
 if e->>'enabled'='true' and exists(select 1 from jsonb_object_keys(new.document->'commerce'->'orders') k where not coalesce(old.document->'commerce'->'orders','{}') ? k) then raise exception 'Legacy single-card purchases retired';end if;
 select document into config from credits_sandbox.rarity_configuration where version=e->>'rarityVersion';
 if config is null then raise exception 'Unknown rarity version';end if;
 for item in select key,value from jsonb_each(e->'players') loop
  if item.value->>'sport'='basketball' then
   select identity into registered from credits_sandbox.nba_fixture_players where id=item.key;
   if registered is distinct from item.value then raise exception 'Registered synthetic NBA identity required';end if;
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
  if e->'retiredTestInstances'->item.key=item.value and exists(select 1 from nfl_roster.retired_test_cards a where a.card_id=item.key and a.allocation=item.value and a.ownership=old.document->'commerce'->'cards'->item.key and a.history=old.document->'cards'->item.key) then
   if new.document->'commerce'->'cards' ? item.key or new.document->'cards' ? item.key then raise exception 'Retired ownership remains active';end if;
   continue;
  end if;
  if e->'instances'->item.key is distinct from item.value then raise exception 'Issued identity/serial is immutable';end if;
  if not(new.document->'commerce'->'cards' ? item.key) or not(new.document->'cards' ? item.key) then raise exception 'Ownership evidence required';end if;
  if exists(select 1 from jsonb_array_elements(old.document->'cards'->item.key->'history') with ordinality h(v,n) where new.document->'cards'->item.key->'history'->((h.n-1)::int) is distinct from h.v) then raise exception 'Ownership history append required';end if;
 end loop;
 for item in select key,value from jsonb_each(e->'definitions') loop
  if item.key<>((item.value->>'playerId')||':'||(item.value->>'rarity')) then raise exception 'Lifetime definition key';end if;
  select count(*) into cnt from jsonb_each(coalesce(e->'retiredTestInstances','{}') || (e->'instances')) x where x.value->>'definition'=item.key;
  if cnt<>(item.value->>'issued')::int then raise exception 'Issuance count mismatch';end if;
  if e->'players'->(item.value->>'playerId')->>'sport'='basketball' then
   insert into credits_sandbox.nba_fixture_definitions values(item.key,item.value->>'playerId',item.value->>'rarity',e->>'rarityVersion',(config->'rarities'->(item.value->>'rarity')->>'lifetimeCap')::int) on conflict do nothing;
  else
   insert into credits_sandbox.card_definitions values(item.key,item.value->>'playerId',item.value->>'rarity',e->>'rarityVersion',(config->'rarities'->(item.value->>'rarity')->>'lifetimeCap')::int) on conflict do nothing;
  end if;
 end loop;
 for item in select key,value from jsonb_each(e->'instances') order by (value->>'serial')::int loop
  fixture:=e->'players'->(item.value->>'playerId')->>'sport'='basketball';
  if fixture then
   if e->'packs'->(item.value->>'source')->'product'->>'sport' is distinct from 'basketball' then raise exception 'NBA fixture pack scope mismatch';end if;
   if previous->'instances'->item.key is distinct from item.value
    or old.document->'commerce'->'cards'->item.key is distinct from new.document->'commerce'->'cards'->item.key
    or old.document->'cards'->item.key is distinct from new.document->'cards'->item.key then
    if e->'nbaTestAllocation'->>'enabled' is distinct from 'true' then raise exception 'NBA fixture allocation disabled';end if;
    perform credits_sandbox.assert_nba_fixture_member(new.document->'commerce'->'cards'->item.key->>'owner');
    if old.document->'commerce'->'cards' ? item.key then perform credits_sandbox.assert_nba_fixture_member(old.document->'commerce'->'cards'->item.key->>'owner');end if;
   end if;
   select document into registered from credits_sandbox.nba_fixture_instances where id=item.key::uuid;
  else
   select document into registered from credits_sandbox.card_instances where id=item.key::uuid;
  end if;
  if registered is null then
   if fixture then
    insert into credits_sandbox.nba_fixture_instances values(item.key::uuid,item.value->>'definition',(item.value->>'serial')::int,item.value);
   else
    insert into credits_sandbox.card_instances values(item.key::uuid,item.value->>'definition',(item.value->>'serial')::int,item.value);
   end if;
  elsif registered is distinct from item.value then raise exception 'Serial already issued';end if;
  if new.document->'commerce'->'cards'->item.key->>'tier' is distinct from item.value->>'rarity'
    or new.document->'commerce'->'cards'->item.key->>'owner' is null
    or new.document->'cards'->item.key->'history'->-1->>'to' is distinct from new.document->'commerce'->'cards'->item.key->>'owner'
    or not coalesce(e->'packs'->(item.value->>'source')->'cards','[]') ? item.key then raise exception 'Owned rarity required';end if;
 end loop;
 if ((select count(*) from credits_sandbox.card_instances)+(select count(*) from credits_sandbox.nba_fixture_instances))<>(select count(*) from jsonb_each(coalesce(e->'retiredTestInstances','{}') || (e->'instances'))) then raise exception 'Historical issuance missing';end if;
 for item in select key,value from jsonb_each(e->'packs') loop
  if item.value->'product'->>'sport'='basketball' and previous->'packs'->item.key is distinct from item.value then
   if e->'nbaTestAllocation'->>'enabled' is distinct from 'true' then raise exception 'NBA fixture allocation disabled';end if;
   perform credits_sandbox.assert_nba_fixture_member(item.value->>'member');
  end if;
  select document into registered from credits_sandbox.pack_configuration where version=item.value->'product'->>'version';
  if registered is null or registered is distinct from item.value->'product' then raise exception 'Unregistered pack receipt configuration';end if;
  if jsonb_array_length(item.value->'cards')<>(registered->>'cards')::int or
    (select count(distinct x) from jsonb_array_elements_text(item.value->'cards')x)<>(registered->>'cards')::int then raise exception 'Purchased card count and unique instances required';end if;
  for d in select value from jsonb_array_elements(item.value->'cards') loop
   if (coalesce(e->'retiredTestInstances','{}') || (e->'instances'))->(d#>>'{}')->>'source' is distinct from item.key then raise exception 'Pack allocation mismatch';end if;
   if item.value->'product'->>'sport'='basketball' and e->'players'->(e->'instances'->(d#>>'{}')->>'playerId')->>'sport' is distinct from 'basketball' then raise exception 'NBA fixture pack scope mismatch';end if;
  end loop;
  select document into registered from credits_sandbox.pack_receipts where id=item.key;
  if registered is null then insert into credits_sandbox.pack_receipts values(item.key,item.value-'openedAt');
  elsif registered is distinct from item.value-'openedAt' then raise exception 'Confirmed pack cannot be rerolled';end if;
  if previous->'packs'->item.key->>'openedAt' is not null and previous->'packs'->item.key->'openedAt' is distinct from item.value->'openedAt' then raise exception 'Opening receipt immutable';end if;
 end loop;
 if (select count(*) from credits_sandbox.pack_receipts)<>(select count(*) from jsonb_each(e->'packs')) then raise exception 'Pack history missing';end if;
 return new;
end$$;
