-- Audited retirement of authorised test assets, never serial reuse or wallet adjustment.
-- Rows are written only by the operator in the same transaction as removal.
create table nfl_roster.retired_test_cards(card_id text primary key,allocation jsonb not null,ownership jsonb not null,history jsonb not null,approval jsonb not null,at timestamptz not null default now());
create table nfl_roster.cleanup_runs(id text primary key,manifest jsonb not null,preimage jsonb not null,post_hash text not null,at timestamptz not null default now());
alter table nfl_roster.retired_test_cards enable row level security;
alter table nfl_roster.cleanup_runs enable row level security;
revoke all on nfl_roster.retired_test_cards,nfl_roster.cleanup_runs from public,anon,authenticated,service_role,docked_beta_app;
grant select on nfl_roster.retired_test_cards to docked_beta_app;
create policy runtime_read on nfl_roster.retired_test_cards for select to docked_beta_app using(true);
create trigger immutable before update or delete on nfl_roster.retired_test_cards for each row execute function nfl_roster.immutable();
create trigger immutable before update or delete on nfl_roster.cleanup_runs for each row execute function nfl_roster.immutable();
create trigger no_truncate before truncate on nfl_roster.retired_test_cards for each statement execute function nfl_roster.immutable();
create trigger no_truncate before truncate on nfl_roster.cleanup_runs for each statement execute function nfl_roster.immutable();
-- Keep immutable card_instances and pack_receipts as the original issuance ledger.
-- Only the active ownership projection is removed. Its full preimage is archived.
create or replace function credits_sandbox.guard_economy_state() returns trigger language plpgsql security invoker set search_path='' as $$
declare e jsonb:=new.document->'economy'; previous jsonb:=old.document->'economy'; item record; d jsonb; config jsonb; registered jsonb; cnt int;begin
 if previous is not null and e is null then raise exception 'Economy history cannot be removed';end if;
 if e is null then return new;end if;
 if e->>'id' is distinct from 'invited-nfl-test-v2' or new.document->'policy'->>'liveEnabled' is distinct from 'false'
 or new.document->'policy'->>'purchasedWithdrawable' is distinct from 'false' then raise exception 'Isolated nonwithdrawable economy required';end if;
 if previous is null and current_user='docked_beta_app' then raise exception 'Operator migration required';end if;
 if current_user='docked_beta_app' and previous->'enabled' is distinct from e->'enabled' then raise exception 'Operator activation required';end if;
 if e->>'enabled'='true' and exists(select 1 from jsonb_object_keys(new.document->'commerce'->'orders') k where not coalesce(old.document->'commerce'->'orders','{}') ? k) then raise exception 'Legacy single-card purchases retired';end if;
 select document into config from credits_sandbox.rarity_configuration where version=e->>'rarityVersion';
 if config is null then raise exception 'Unknown rarity version';end if;
 for item in select key,value from jsonb_each(e->'players') loop
  select identity into registered from credits_sandbox.permanent_players where id=item.key;
  if registered is null or item.value->>'id'<>item.key or item.value->>'providerId'<>registered->>'providerId'
   or item.value->>'provider'<>registered->>'provider' or item.value->>'sport'<>registered->>'sport'
   or item.value->>'assetKind'<>registered->>'assetKind' then raise exception 'Permanent player identity mismatch';end if;
 end loop;
 for item in select key,value from jsonb_each(e->'products') loop
  select document into registered from credits_sandbox.pack_configuration where version=item.value->>'version';
  if registered is distinct from item.value or item.key<>item.value->>'id' or (item.value->>'cards')::int<>9
    or item.value->>'status'<>'TEST_ONLY' or (item.value->'weights'->>'ICON')::int<1
    or item.value->'weights' ? 'CORE' then raise exception 'Unregistered nine-card product';end if;
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
  insert into credits_sandbox.card_definitions values(item.key,item.value->>'playerId',item.value->>'rarity',e->>'rarityVersion',(config->'rarities'->(item.value->>'rarity')->>'lifetimeCap')::int) on conflict do nothing;
 end loop;
 for item in select key,value from jsonb_each(e->'instances') order by (value->>'serial')::int loop
  select document into registered from credits_sandbox.card_instances where id=item.key::uuid;
  if registered is null then
   insert into credits_sandbox.card_instances values(item.key::uuid,item.value->>'definition',(item.value->>'serial')::int,item.value);
  elsif registered is distinct from item.value then raise exception 'Serial already issued';end if;
  if new.document->'commerce'->'cards'->item.key->>'tier' is distinct from item.value->>'rarity'
    or new.document->'commerce'->'cards'->item.key->>'owner' is null
    or new.document->'cards'->item.key->'history'->-1->>'to' is distinct from new.document->'commerce'->'cards'->item.key->>'owner'
    or not coalesce(e->'packs'->(item.value->>'source')->'cards','[]') ? item.key then raise exception 'Owned rarity required';end if;
 end loop;
 if (select count(*) from credits_sandbox.card_instances)<>(select count(*) from jsonb_each(coalesce(e->'retiredTestInstances','{}') || (e->'instances'))) then raise exception 'Historical issuance missing';end if;
 for item in select key,value from jsonb_each(e->'packs') loop
  select document into registered from credits_sandbox.pack_configuration where version=item.value->'product'->>'version';
  if registered is null or registered is distinct from item.value->'product' then raise exception 'Unregistered pack receipt configuration';end if;
  if jsonb_array_length(item.value->'cards')<>9 or
    (select count(distinct x) from jsonb_array_elements_text(item.value->'cards')x)<>9 then raise exception 'Exactly nine unique cards required';end if;
  for d in select value from jsonb_array_elements(item.value->'cards') loop
   if (coalesce(e->'retiredTestInstances','{}') || (e->'instances'))->(d#>>'{}')->>'source' is distinct from item.key then raise exception 'Pack allocation mismatch';end if;
  end loop;
  select document into registered from credits_sandbox.pack_receipts where id=item.key;
  if registered is null then insert into credits_sandbox.pack_receipts values(item.key,item.value-'openedAt');
  elsif registered is distinct from item.value-'openedAt' then raise exception 'Confirmed pack cannot be rerolled';end if;
  if previous->'packs'->item.key->>'openedAt' is not null and previous->'packs'->item.key->'openedAt' is distinct from item.value->'openedAt' then raise exception 'Opening receipt immutable';end if;
 end loop;
 if (select count(*) from credits_sandbox.pack_receipts)<>(select count(*) from jsonb_each(e->'packs')) then raise exception 'Pack history missing';end if;
 return new;
end$$;
