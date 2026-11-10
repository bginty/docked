-- Prepared only. No Production apply/activation/import. Exact founder caps.
-- Fail before DDL if prior records disagree; never repair ownership implicitly.
do $$begin
 if exists(select 1 from commercial_billing.definitions where lifetime_cap is distinct from
  case rarity when 'RARE' then 5000 when 'ELITE' then 2500 when 'ULTRA_RARE' then 400 when 'LEGENDARY' then 50 when 'ICON' then 1 end)
 then raise exception 'Existing lifetime cap differs: reconcile before migration'; end if;
 if exists(select 1 from commercial_billing.definitions d where issued<>legacy_issued+(select count(*) from commercial_billing.cards c where c.definition=d.id))
 then raise exception 'Existing lifetime counter differs: reconcile before migration'; end if;
end$$;
alter table commercial_billing.definitions drop constraint if exists approved_lifetime_cap;
alter table commercial_billing.definitions add constraint approved_lifetime_cap check(lifetime_cap=
 case rarity when 'RARE' then 5000 when 'ELITE' then 2500 when 'ULTRA_RARE' then 400 when 'LEGENDARY' then 50 when 'ICON' then 1 end);
create unique index if not exists commercial_provider_lifetime_identity
 on commercial_billing.definitions(sport,(snapshot->>'provider'),(snapshot->>'providerId'),rarity)
 where snapshot->>'provider' is not null and snapshot->>'providerId' is not null;
-- Minting is possible only in the transaction that creates a purchased pack.
alter table commercial_billing.packs add column if not exists issuance_txid bigint not null default txid_current();

create or replace function commercial_billing.card_guard() returns trigger language plpgsql set search_path='' as $$
declare d commercial_billing.definitions; p commercial_billing.packs; c commercial_billing.control;
begin
 if tg_op='UPDATE' then
  if (to_jsonb(new)-array['owner_id','locked'])<>(to_jsonb(old)-array['owner_id','locked']) then raise exception 'Permanent card identity immutable'; end if;
 else
  select * into strict c from commercial_billing.lock_control();
  if not c.issuance_enabled then raise exception 'Permanent issuance disabled'; end if;
  if c.policy_version<>'commercial-closed-loop-2026-11-01-v1'
   or coalesce((c.approvals->>'validUntil')::timestamptz,'-infinity')<=clock_timestamp()
   or exists(select 1 from unnest(array['owner','legal','googlePlay','privacy','retention','refundRecovery','playerRights','supplyReconciliation']) k where coalesce(length(c.approvals->>k),0)<8)
   or exists(select 1 from unnest(array['withdrawals','prizes','paidEntry','nba']) k where c.approvals->k is distinct from 'false'::jsonb)
  then raise exception 'Commercial approvals required'; end if;
  select * into strict p from commercial_billing.packs where id=new.pack for update;
  select * into strict d from commercial_billing.definitions where id=new.definition for update;
  if p.issuance_txid<>txid_current() or p.opened_at is not null or p.member_id<>new.owner_id
   or p.product->>'sport' is distinct from d.sport or new.slot>=(p.product->>'cards')::int
   or p.draw_evidence->new.slot->>'rarity' is distinct from d.rarity
   then raise exception 'Card must match the current purchased pack and committed draw'; end if;
  if exists(select 1 from commercial_billing.cards x join commercial_billing.definitions y on y.id=x.definition where x.pack=p.id and y.player_id=d.player_id)
   then raise exception 'Duplicate pack player'; end if;
  if not d.approved or new.serial<>d.issued+1 or new.serial>d.lifetime_cap then raise exception 'Supply exhausted or definition not approved'; end if;
  update commercial_billing.definitions set issued=new.serial where id=d.id;
 end if; return new;
end$$;
-- A reserved capacity is not a newly minted card. Initial imports must explicitly
-- account for every historical copy; subsequent counter changes need actual cards.
create or replace function commercial_billing.supply_balanced() returns trigger language plpgsql set search_path='' as $$
declare target uuid; d commercial_billing.definitions;
begin
 if tg_table_name='cards' then target:=new.definition; else target:=new.id; end if;
 select * into strict d from commercial_billing.definitions where id=target;
 if d.issued<>d.legacy_issued+(select count(*) from commercial_billing.cards where definition=target)
 then raise exception 'Lifetime counter must equal preserved legacy issuance plus minted cards'; end if;
 return null;
end$$;
create or replace function commercial_billing.pack_complete() returns trigger language plpgsql set search_path='' as $$
begin
 if coalesce((new.product->>'cards')::int,0) not in(1,3,9)
  or jsonb_typeof(new.draw_evidence) is distinct from 'array'
  or jsonb_array_length(new.draw_evidence) is distinct from (new.product->>'cards')::int
  or (select count(*) from commercial_billing.cards where pack=new.id)<>(new.product->>'cards')::int
 then raise exception 'A purchased pack must atomically contain every awarded card'; end if;
 return null;
end$$;
drop trigger if exists commercial_supply_balanced on commercial_billing.definitions;
create constraint trigger commercial_supply_balanced after insert or update on commercial_billing.definitions
 deferrable initially deferred for each row execute function commercial_billing.supply_balanced();
drop trigger if exists commercial_cards_balanced on commercial_billing.cards;
create constraint trigger commercial_cards_balanced after insert on commercial_billing.cards
 deferrable initially deferred for each row execute function commercial_billing.supply_balanced();
drop trigger if exists commercial_pack_complete on commercial_billing.packs;
create constraint trigger commercial_pack_complete after insert on commercial_billing.packs
 deferrable initially deferred for each row execute function commercial_billing.pack_complete();
do $$declare t text;begin
 foreach t in array array['definitions','cards','packs'] loop
  execute format('drop trigger if exists preserve_lifetime_records on commercial_billing.%I',t);
  execute format('create trigger preserve_lifetime_records before delete on commercial_billing.%I for each row execute function commercial_billing.immutable()',t);
  execute format('drop trigger if exists preserve_lifetime_truncate on commercial_billing.%I',t);
  execute format('create trigger preserve_lifetime_truncate before truncate on commercial_billing.%I for each statement execute function commercial_billing.immutable()',t);
 end loop;
end$$;
revoke all on function commercial_billing.supply_balanced(),commercial_billing.pack_complete() from public,anon,authenticated,service_role;

-- Once the reviewed pool is imported, old TEST mint routes for supported sports
-- cannot continue a second counter (including omitted aliases/rookies). Import
-- approval must include this mint-source handover. Ownership-only changes retain
-- identical instance keys and are unaffected. No source is imported here.
create or replace function commercial_billing.prevent_parallel_mint() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from commercial_billing.definitions) and exists(
  select 1 from jsonb_each(new.document->'economy'->'instances') i
  where coalesce(new.document->'economy'->'players'->(i.value->>'playerId')->>'sport','unknown') not in('basketball','nba')
   and i.value->>'rarity' in('RARE','ELITE','ULTRA_RARE','LEGENDARY','ICON')
   and not coalesce(to_jsonb(old)->'document'->'economy'->'instances','{}'::jsonb)?i.key)
 then raise exception 'Player rarity already bound to permanent lifetime ledger; parallel issuance denied'; end if;
 return new;
end$$;
do $$begin
 if to_regclass('credits_sandbox.state') is not null then
  execute 'drop trigger if exists commercial_no_parallel_mint on credits_sandbox.state';
  execute 'create trigger commercial_no_parallel_mint before insert or update on credits_sandbox.state for each row execute function commercial_billing.prevent_parallel_mint()';
 end if;
end$$;
revoke all on function commercial_billing.prevent_parallel_mint() from public,anon,authenticated,service_role,docked_commercial_app;

-- Cover direct legacy/admin inserts as well as the JSON wallet write path.
-- Existing mirror copies may be projected/transferred; a new identity may not.
create or replace function commercial_billing.prevent_parallel_inventory() returns trigger
language plpgsql security definer set search_path='' as $$
declare state jsonb; item jsonb; items jsonb; player jsonb; pid text; cid text; sport_id text;
begin
 if not exists(select 1 from commercial_billing.definitions) then return new;end if;
 select document into state from credits_sandbox.state limit 1;
 if tg_table_schema='sports_feed' then items:=new.cards;
 else
  if jsonb_typeof(new.document)is distinct from 'object' or new.document->>'playerId'is null then raise exception 'unrecorded inventory denied: trusted player identity required';end if;
  items:=jsonb_build_array(new.document||jsonb_build_object('id',new.id::text));
 end if;
 for item in select value from jsonb_array_elements(items) loop
  pid:=coalesce(item->>'player_id',item->>'playerId'); cid:=coalesce(item->>'id',item->>'card_id');
  player:=state->'economy'->'players'->pid;
  sport_id:=coalesce(to_jsonb(new)->>'sport',player->>'sport');
  if coalesce(sport_id,'unknown')not in('basketball','nba') and item->>'rarity' in('RARE','ELITE','ULTRA_RARE','LEGENDARY','ICON')
   and not coalesce(state->'economy'->'instances','{}'::jsonb)?coalesce(cid,'')
   and not exists(select 1 from commercial_billing.cards c where c.id::text=cid)
   and not exists(select 1 from jsonb_array_elements(coalesce(to_jsonb(old)->'cards','[]')) v where coalesce(v->>'id',v->>'card_id')=cid)
  then raise exception 'Player rarity bound to permanent lifetime ledger; unrecorded inventory denied';end if;
 end loop;
 return new;
end$$;
do $$declare t text;begin
 foreach t in array array['credits_sandbox.card_instances','credits_sandbox.nba_fixture_instances','sports_feed.sport_sandbox_inventory']loop
  if to_regclass(t)is not null then
   execute format('drop trigger if exists commercial_no_parallel_inventory on %s',t);
   execute format('create trigger commercial_no_parallel_inventory before insert or update on %s for each row execute function commercial_billing.prevent_parallel_inventory()',t);
  end if;
 end loop;
end$$;
revoke all on function commercial_billing.prevent_parallel_inventory() from public,anon,authenticated,service_role,docked_commercial_app;
