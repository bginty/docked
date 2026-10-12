-- Additive to the isolated TEST wallet. No legacy inventory or scoring rows changed.
create table credits_sandbox.rarity_configuration(version text primary key, document jsonb not null);
create table credits_sandbox.permanent_players(
 id text primary key, sport text not null check(sport in ('nfl','afl')),
 provider text not null, provider_id text not null, asset_kind text not null check(asset_kind in ('player','team-defence')),
 identity jsonb not null, unique(sport,provider,provider_id)
);
create table credits_sandbox.pack_configuration(version text primary key, document jsonb not null);
create table credits_sandbox.card_definitions(
 id text primary key, player_id text not null references credits_sandbox.permanent_players,
 rarity text not null check(rarity in ('RARE','ELITE','ULTRA_RARE','LEGENDARY','ICON')),
 rarity_version text not null references credits_sandbox.rarity_configuration,
 lifetime_cap integer not null check(lifetime_cap>0), unique(player_id,rarity)
);
create table credits_sandbox.card_instances(
 id uuid primary key, definition text not null references credits_sandbox.card_definitions,
 serial integer not null check(serial>0), document jsonb not null, unique(definition,serial)
);
create table credits_sandbox.pack_receipts(id text primary key, document jsonb not null);
create table credits_sandbox.pack_failures(id uuid primary key default gen_random_uuid(),member text not null,request text not null,product text not null,category text not null check(category in ('FUNDS','SUPPLY','CONFIGURATION','TRANSACTION')),recorded_at timestamptz not null default clock_timestamp());

do $$declare t text;begin
 foreach t in array array['rarity_configuration','permanent_players','pack_configuration','card_definitions','card_instances','pack_receipts','pack_failures'] loop
  execute format('alter table credits_sandbox.%I enable row level security',t);
  execute format('create trigger immutable before update or delete on credits_sandbox.%I for each row execute function credits_sandbox.immutable()',t);
  execute format('create trigger no_truncate before truncate on credits_sandbox.%I for each statement execute function credits_sandbox.immutable()',t);
  execute format('grant select on credits_sandbox.%I to docked_beta_app',t);
  execute format('create policy read_runtime on credits_sandbox.%I for select to docked_beta_app using(true)',t);
 end loop;
end$$;
grant insert on credits_sandbox.card_definitions,credits_sandbox.card_instances,credits_sandbox.pack_receipts to docked_beta_app;
grant insert on credits_sandbox.pack_failures to docked_beta_app;
create policy insert_runtime on credits_sandbox.pack_failures for insert to docked_beta_app with check(true);
create policy insert_runtime on credits_sandbox.card_definitions for insert to docked_beta_app with check(true);
create policy insert_runtime on credits_sandbox.card_instances for insert to docked_beta_app with check(true);
create policy insert_runtime on credits_sandbox.pack_receipts for insert to docked_beta_app with check(true);

-- Only permanent allocations in this schema count; legacy test editions are not renamed.
create function credits_sandbox.check_definition() returns trigger language plpgsql security invoker set search_path='' as $$
declare config jsonb;begin
 select document into config from credits_sandbox.rarity_configuration where version=new.rarity_version;
 if new.lifetime_cap is distinct from (config->'rarities'->new.rarity->>'lifetimeCap')::int
 or new.id<>new.player_id||':'||new.rarity then raise exception 'Permanent rarity cap mismatch';end if;
 return new;
end$$;
create trigger definition_guard before insert on credits_sandbox.card_definitions for each row execute function credits_sandbox.check_definition();

create function credits_sandbox.check_instance() returns trigger language plpgsql security invoker set search_path='' as $$
declare d credits_sandbox.card_definitions;begin
 -- The aggregate row is locked by the transaction; the unique serial index also
 -- rejects competing direct inserts. No UPDATE privilege on immutable definitions.
 select * into d from credits_sandbox.card_definitions where id=new.definition;
 if new.serial>d.lifetime_cap or new.serial<>(select coalesce(max(serial),0)+1 from credits_sandbox.card_instances where definition=new.definition)
 or new.document->>'id' is distinct from new.id::text or new.document->>'definition' is distinct from d.id
 or new.document->>'playerId' is distinct from d.player_id or new.document->>'rarity' is distinct from d.rarity
 or (new.document->>'serial')::int is distinct from new.serial or (new.document->>'lifetimeCap')::int is distinct from d.lifetime_cap
 then raise exception 'Permanent serial/cap violation';end if;
 return new;
end$$;
create trigger instance_guard before insert on credits_sandbox.card_instances for each row execute function credits_sandbox.check_instance();

create function credits_sandbox.guard_economy_state() returns trigger language plpgsql security invoker set search_path='' as $$
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
 for item in select key,value from jsonb_each(coalesce(previous->'instances','{}')) loop
  if e->'instances'->item.key is distinct from item.value then raise exception 'Issued identity/serial is immutable';end if;
  if not(new.document->'commerce'->'cards' ? item.key) or not(new.document->'cards' ? item.key) then raise exception 'Ownership evidence required';end if;
  if exists(select 1 from jsonb_array_elements(old.document->'cards'->item.key->'history') with ordinality h(v,n) where new.document->'cards'->item.key->'history'->((h.n-1)::int) is distinct from h.v) then raise exception 'Ownership history append required';end if;
 end loop;
 for item in select key,value from jsonb_each(e->'definitions') loop
  if item.key<>((item.value->>'playerId')||':'||(item.value->>'rarity')) then raise exception 'Lifetime definition key';end if;
  select count(*) into cnt from jsonb_each(e->'instances') x where x.value->>'definition'=item.key;
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
 if (select count(*) from credits_sandbox.card_instances)<>(select count(*) from jsonb_each(e->'instances')) then raise exception 'Historical issuance missing';end if;
 for item in select key,value from jsonb_each(e->'packs') loop
  select document into registered from credits_sandbox.pack_configuration where version=item.value->'product'->>'version';
  if registered is null or registered is distinct from item.value->'product' then raise exception 'Unregistered pack receipt configuration';end if;
  if jsonb_array_length(item.value->'cards')<>9 or
    (select count(distinct x) from jsonb_array_elements_text(item.value->'cards')x)<>9 then raise exception 'Exactly nine unique cards required';end if;
  for d in select value from jsonb_array_elements(item.value->'cards') loop
   if e->'instances'->(d#>>'{}')->>'source' is distinct from item.key then raise exception 'Pack allocation mismatch';end if;
  end loop;
  select document into registered from credits_sandbox.pack_receipts where id=item.key;
  if registered is null then insert into credits_sandbox.pack_receipts values(item.key,item.value-'openedAt');
  elsif registered is distinct from item.value-'openedAt' then raise exception 'Confirmed pack cannot be rerolled';end if;
  if previous->'packs'->item.key->>'openedAt' is not null and previous->'packs'->item.key->'openedAt' is distinct from item.value->'openedAt' then raise exception 'Opening receipt immutable';end if;
 end loop;
 if (select count(*) from credits_sandbox.pack_receipts)<>(select count(*) from jsonb_each(e->'packs')) then raise exception 'Pack history missing';end if;
 return new;
end$$;
create trigger lifetime_economy_guard before update on credits_sandbox.state for each row execute function credits_sandbox.guard_economy_state();
revoke all on all functions in schema credits_sandbox from public,anon,authenticated,service_role;
revoke all on credits_sandbox.rarity_configuration,credits_sandbox.permanent_players,credits_sandbox.pack_configuration,credits_sandbox.card_definitions,credits_sandbox.card_instances,credits_sandbox.pack_receipts,credits_sandbox.pack_failures from public,anon,authenticated,service_role;

-- Narrow projection of approved public roster facts only. This private, barrier
-- view deliberately uses its owner to read the retained payload; the web role
-- receives no raw-payload access. Omitted in disposable DBs without sports_feed.
do $$begin if to_regclass('sports_feed.postgame_cache') is not null then execute $view$
create view credits_sandbox.current_player_status with (security_barrier=true) as
with source as materialized (
 select r.body,c.checked_at,r.id from sports_feed.postgame_cache c
 join sports_feed.raw_revisions r on r.id=c.raw_id
 where r.body->>'dataset'='rosters' and r.body is not null and r.expires_at>clock_timestamp()
), ranked as materialized (
 select v.*,s.checked_at,s.id raw_id,dense_rank() over(partition by v.gsis_id order by (nullif(v.week,'')::int) desc nulls last,s.checked_at desc) precedence
 from source s cross join lateral jsonb_to_recordset(s.body->'rows')
 v(gsis_id text,full_name text,position text,team text,status text,week text)
), roster as materialized (
 select gsis_id,min(full_name) full_name,min(position) position,min(team) team,
 case when count(distinct (full_name,position,team,status))=1 then min(status) else null end status,
 max(checked_at) checked_at,min(raw_id::text) raw_id
 from ranked where precedence=1 group by gsis_id
)
select p.id,r.full_name name,r.position,r.team,r.status,r.checked_at,r.raw_id
from credits_sandbox.permanent_players p left join roster r on r.gsis_id=p.provider_id and p.provider='nflverse'
$view$;
 execute 'revoke all on credits_sandbox.current_player_status from public,anon,authenticated,service_role';
 execute 'grant select on credits_sandbox.current_player_status to docked_beta_app';
end if;end$$;
