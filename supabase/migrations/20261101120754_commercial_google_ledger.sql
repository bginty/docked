-- Additive, dormant commercial accounting. No beta/test table is changed or copied.
-- Runtime has no login credential or membership until a separately approved rollout.
create schema if not exists commercial_billing;
revoke all on schema commercial_billing from public,anon,authenticated,service_role;
do $$begin
 if not exists(select 1 from pg_roles where rolname='docked_commercial_app') then
  create role docked_commercial_app nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
 end if;
end$$;
create table if not exists commercial_billing.control(
 id boolean primary key default true check(id),
 environment text not null default 'commercial' check(environment in('commercial','acceptance')),
 sales_enabled boolean not null default false,
 issuance_enabled boolean not null default false,
 transfers_enabled boolean not null default false,
 policy_version text not null default 'commercial-launch-awaiting-approval-v1',
 approvals jsonb not null default '{}',
 updated_at timestamptz not null default clock_timestamp()
);
insert into commercial_billing.control(id) values(true) on conflict do nothing;
create table if not exists commercial_billing.products(
 id text primary key, credits bigint not null check(credits>0 and credits<=1000000),
 aud_cents bigint not null check(aud_cents>0), version text not null,
 approved boolean not null default false
);
insert into commercial_billing.products values
 ('docked_credits_4900_v1',4900,4900,'owner-credit-packages-2026-10-31-v1',false),
 ('docked_credits_9900_v1',9900,9900,'owner-credit-packages-2026-10-31-v1',false)
 on conflict do nothing;
-- Pseudonymous stable member reference deliberately survives Auth deletion.
create table if not exists commercial_billing.accounts(
 member_id uuid primary key, created_at timestamptz not null default clock_timestamp()
);
create table if not exists commercial_billing.receipts(
 key text primary key check(key~'^[a-f0-9]{64}$'),
 member_id uuid not null references commercial_billing.accounts,
 account_binding text not null check(account_binding~'^[a-f0-9]{64}$'),
 environment text not null check(environment in('commercial','acceptance')),
 product jsonb not null, state text not null check(state in('PENDING','PURCHASED','CANCELLED','REVOKED','REVIEW')),
 order_id text unique, encrypted_reference text not null,
 gross_cents bigint check(gross_cents>=0), tax_cents bigint check(tax_cents>=0),
 refunded_cents bigint not null default 0 check(refunded_cents>=0),
 credited boolean not null default false, money_recorded boolean not null default false,
 next_reconcile_at timestamptz not null default clock_timestamp(),
 provider_at timestamptz, created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp()
);
create index if not exists commercial_receipt_reconcile on commercial_billing.receipts(next_reconcile_at,key) where state in('PENDING','PURCHASED','REVIEW');
create index if not exists commercial_receipts_member on commercial_billing.receipts(member_id,created_at desc,key);
create table if not exists commercial_billing.receipt_events(
 id bigint generated always as identity primary key,
 receipt text not null references commercial_billing.receipts,
 state text not null, fingerprint text not null, observed_at timestamptz not null default clock_timestamp(),
 unique(receipt,fingerprint)
);
create table if not exists commercial_billing.lots(
 id uuid primary key default gen_random_uuid(), member_id uuid not null references commercial_billing.accounts,
 receipt text not null references commercial_billing.receipts,
 source text not null unique, original bigint not null check(original>0),
 remaining bigint not null check(remaining>=0 and remaining<=original),
 refund_removed bigint not null default 0 check(refund_removed>=0 and refund_removed+remaining<=original),
 created_at timestamptz not null default clock_timestamp()
);
create index if not exists commercial_lot_fifo on commercial_billing.lots(member_id,created_at,id) where remaining>0;
create table if not exists commercial_billing.journals(
 id text primary key, unit text not null check(unit in('CREDITS','AUD_CENTS')),
 actor text not null, reason text not null, receipt text references commercial_billing.receipts,
 created_at timestamptz not null default clock_timestamp(), transaction_id bigint not null default txid_current()
);
create table if not exists commercial_billing.lines(
 journal text not null references commercial_billing.journals,
 n integer not null, account text not null, amount bigint not null check(amount<>0), primary key(journal,n)
);
create index if not exists commercial_line_account on commercial_billing.lines(account,journal);
create table if not exists commercial_billing.recovery_cases(
 id text primary key, receipt text not null unique references commercial_billing.receipts,
 member_id uuid not null references commercial_billing.accounts,
 exposure_credits bigint not null check(exposure_credits>=0),
 reason text not null, state text not null default 'OPEN' check(state in('OPEN','WAIVED')),
 revision integer not null default 1, created_at timestamptz not null default clock_timestamp()
);
create table if not exists commercial_billing.support_events(
 id uuid primary key default gen_random_uuid(), case_id text not null references commercial_billing.recovery_cases,
 reviewer uuid not null, expected_revision integer not null, reason text not null check(length(reason) between 12 and 600),
 action text not null check(action='WAIVE_RECOVERY'), created_at timestamptz not null default clock_timestamp(),
 unique(case_id,expected_revision)
);
create table if not exists commercial_billing.jobs(
 id text primary key, receipt text, kind text not null check(kind in('verify','consume','test')),
 state text not null default 'pending' check(state in('pending','working','done','attention')),
 attempts integer not null default 0, lease uuid, lease_until timestamptz,
 next_attempt_at timestamptz not null default clock_timestamp(), last_error text,
 created_at timestamptz not null default clock_timestamp(), completed_at timestamptz
);
create index if not exists commercial_job_due on commercial_billing.jobs(state,next_attempt_at,lease_until);
create table if not exists commercial_billing.definitions(
 id uuid primary key default gen_random_uuid(), player_id uuid not null,
 sport text not null check(sport in('nfl','afl','nrl')),
 rarity text not null check(rarity in('RARE','ELITE','ULTRA_RARE','LEGENDARY','ICON')),
 lifetime_cap integer not null check(lifetime_cap>0), issued integer not null default 0 check(issued>=0 and issued<=lifetime_cap),
 legacy_issued integer not null default 0 check(legacy_issued>=0 and legacy_issued<=issued),
 approved boolean not null default false, rights_reference text not null, snapshot jsonb not null,
 unique(sport,player_id,rarity)
);
create table if not exists commercial_billing.packs(
 id uuid primary key default gen_random_uuid(), member_id uuid not null references commercial_billing.accounts,
 request uuid not null, product jsonb not null, price bigint not null check(price>0),
 funding jsonb not null, draw_evidence jsonb not null, policy_version text not null,
 created_at timestamptz not null default clock_timestamp(), opened_at timestamptz,
 unique(member_id,request)
);
create table if not exists commercial_billing.cards(
 id uuid primary key default gen_random_uuid(), definition uuid not null references commercial_billing.definitions,
 serial integer not null check(serial>0), owner_id uuid not null references commercial_billing.accounts,
 pack uuid not null references commercial_billing.packs, slot integer not null check(slot between 0 and 8),
 locked boolean not null default false, created_at timestamptz not null default clock_timestamp(),
 unique(definition,serial),unique(pack,slot)
);
create index if not exists commercial_cards_owner on commercial_billing.cards(owner_id,created_at desc,id);
create table if not exists commercial_billing.ownership_events(
 id uuid primary key default gen_random_uuid(), card uuid not null references commercial_billing.cards,
 from_member uuid, to_member uuid not null, reference text not null,
 created_at timestamptz not null default clock_timestamp(),unique(card,reference)
);
create table if not exists commercial_billing.listings(
 id uuid primary key default gen_random_uuid(), card uuid not null references commercial_billing.cards,
 seller uuid not null references commercial_billing.accounts, price bigint not null check(price between 1 and 1000000000),
 revision integer not null default 1, state text not null default 'OPEN' check(state in('OPEN','SOLD','CANCELLED')),
 buyer uuid, fee bigint, net bigint, sold_at timestamptz, funding jsonb
);
create index if not exists commercial_owned_acquired on commercial_billing.ownership_events(card,to_member,created_at desc);
create index if not exists commercial_packs_member on commercial_billing.packs(member_id,created_at desc,id desc);
create unique index if not exists commercial_open_listing on commercial_billing.listings(card) where state='OPEN';
create table if not exists commercial_billing.audit(
 id bigint generated always as identity primary key, actor text not null, action text not null,
 reference text not null, details jsonb not null, created_at timestamptz not null default clock_timestamp()
);
create or replace function commercial_billing.environment_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if new.environment<>old.environment and exists(select 1 from commercial_billing.accounts) then raise exception 'Cannot convert an existing billing environment'; end if;
 return new;
end$$;
create or replace function commercial_billing.receipt_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if (new.key,new.member_id,new.account_binding,new.environment,new.product) is distinct from (old.key,old.member_id,old.account_binding,old.environment,old.product)
 or (old.order_id is not null and new.order_id is distinct from old.order_id)
 or (old.gross_cents is not null and new.gross_cents is distinct from old.gross_cents)
 or (old.money_recorded and not new.money_recorded) or (old.credited and not new.credited)
 or new.refunded_cents<old.refunded_cents then raise exception 'Commercial receipt binding and accounting evidence immutable'; end if;
 return new;
end$$;
create or replace function commercial_billing.lot_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if (new.id,new.member_id,new.receipt,new.source,new.original,new.created_at) is distinct from (old.id,old.member_id,old.receipt,old.source,old.original,old.created_at)
 or new.remaining>old.remaining or new.refund_removed<old.refund_removed then raise exception 'Credit provenance immutable'; end if;
 return new;
end$$;
create or replace function commercial_billing.pack_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if (to_jsonb(new)-'opened_at')<>(to_jsonb(old)-'opened_at') or (old.opened_at is not null and new.opened_at is distinct from old.opened_at) then raise exception 'Purchased pack immutable'; end if;
 return new;
end$$;
create or replace function commercial_billing.immutable() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Immutable commercial audit record'; end$$;
create or replace function commercial_billing.check_journal() returns trigger language plpgsql set search_path='' as $$
begin
 if (select coalesce(sum(amount),0) from commercial_billing.lines where journal=new.journal)<>0 then raise exception 'Unbalanced commercial journal'; end if;
 if exists(select 1 from commercial_billing.lines l join commercial_billing.journals j on j.id=l.journal where j.unit='CREDITS' and l.account=new.account and l.account like 'member:%' group by l.account having sum(l.amount)<0) then raise exception 'Negative commercial credit balance'; end if;
 return null;
end$$;
create or replace function commercial_billing.line_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from commercial_billing.journals where id=new.journal and transaction_id=txid_current()) then raise exception 'Cannot append to a committed journal'; end if;
 return new;
end$$;
create or replace function commercial_billing.card_guard() returns trigger language plpgsql set search_path='' as $$
declare d commercial_billing.definitions;
begin
 if tg_op='UPDATE' then
  if (to_jsonb(new)-array['owner_id','locked'])<>(to_jsonb(old)-array['owner_id','locked']) then raise exception 'Permanent card identity immutable'; end if;
 else
  select * into strict d from commercial_billing.definitions where id=new.definition for update;
  if not d.approved or new.serial<>d.issued+1 or new.serial>d.lifetime_cap then raise exception 'Supply exhausted or definition not approved'; end if;
  update commercial_billing.definitions set issued=new.serial where id=d.id;
 end if; return new;
end$$;
create or replace function commercial_billing.definition_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if (to_jsonb(new)-array['issued','approved'])<>(to_jsonb(old)-array['issued','approved']) or new.issued<old.issued then raise exception 'Lifetime definition immutable'; end if;
 return new;
end$$;
do $$declare t text; begin
 foreach t in array array['journals','lines','receipt_events','ownership_events','support_events','audit'] loop
  if not exists(select 1 from pg_trigger where tgname='commercial_immutable' and tgrelid=('commercial_billing.'||t)::regclass) then
   execute format('create trigger commercial_immutable before update or delete on commercial_billing.%I for each row execute function commercial_billing.immutable()',t);
  end if;
 end loop;
 if not exists(select 1 from pg_trigger where tgname='commercial_balanced') then
  create constraint trigger commercial_balanced after insert on commercial_billing.lines deferrable initially deferred for each row execute function commercial_billing.check_journal();
  create trigger commercial_environment before update on commercial_billing.control for each row execute function commercial_billing.environment_guard();
  create trigger commercial_receipt_identity before update on commercial_billing.receipts for each row execute function commercial_billing.receipt_guard();
  create trigger commercial_lot_identity before update on commercial_billing.lots for each row execute function commercial_billing.lot_guard();
  create trigger commercial_pack_identity before update on commercial_billing.packs for each row execute function commercial_billing.pack_guard();
  create trigger commercial_line_transaction before insert on commercial_billing.lines for each row execute function commercial_billing.line_guard();
  create trigger commercial_card_supply before insert or update on commercial_billing.cards for each row execute function commercial_billing.card_guard();
  create trigger commercial_definition_identity before update on commercial_billing.definitions for each row execute function commercial_billing.definition_guard();
 end if;
 foreach t in array array['control','products','accounts','receipts','receipt_events','lots','journals','lines','recovery_cases','support_events','jobs','definitions','packs','cards','ownership_events','listings','audit'] loop
  execute format('alter table commercial_billing.%I enable row level security',t);
  execute format('revoke all on commercial_billing.%I from public,anon,authenticated,service_role',t);
  if not exists(select 1 from pg_policies where schemaname='commercial_billing' and tablename=t and policyname='commercial_server') then
   execute format('create policy commercial_server on commercial_billing.%I to docked_commercial_app using(true) with check(true)',t);
  end if;
 end loop;
end$$;
grant usage on schema commercial_billing to docked_commercial_app;
grant select on all tables in schema commercial_billing to docked_commercial_app;
grant usage,select on all sequences in schema commercial_billing to docked_commercial_app;
grant insert,update on commercial_billing.accounts,commercial_billing.receipts,commercial_billing.lots,commercial_billing.recovery_cases,commercial_billing.jobs,commercial_billing.packs,commercial_billing.cards,commercial_billing.listings to docked_commercial_app;
grant update(issued) on commercial_billing.definitions to docked_commercial_app;
grant insert on commercial_billing.journals,commercial_billing.lines,commercial_billing.receipt_events,commercial_billing.ownership_events,commercial_billing.support_events,commercial_billing.audit to docked_commercial_app;
revoke all on all functions in schema commercial_billing from public,anon,authenticated,service_role;
-- Row locks require UPDATE privilege in PostgreSQL. These narrowly scoped
-- functions obtain shared locks without granting runtime activation privileges.
create or replace function commercial_billing.lock_control() returns setof commercial_billing.control
language sql security definer set search_path='' as $$select * from commercial_billing.control where id for share$$;
create or replace function commercial_billing.lock_product(p_id text) returns setof commercial_billing.products
language sql security definer set search_path='' as $$select * from commercial_billing.products where id=p_id for share$$;
revoke all on function commercial_billing.lock_control(),commercial_billing.lock_product(text) from public,anon,authenticated,service_role;
grant execute on function commercial_billing.lock_control(),commercial_billing.lock_product(text) to docked_commercial_app;
-- No credential, runtime role membership, active product, card definition or job is provisioned.
