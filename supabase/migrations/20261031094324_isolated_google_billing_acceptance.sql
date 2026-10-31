-- Independent synthetic ledger. No customer, wallet or account rows are updated.
-- Runtime login/expiry is provisioned separately; no secrets belong in migrations.
DO $$ BEGIN
 IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='docked_billing_test') THEN
  CREATE ROLE docked_billing_test NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
 END IF;
END $$;

create schema store_billing_acceptance;
revoke all on schema store_billing_acceptance from public;
create table store_billing_acceptance.state(id boolean primary key check(id), revision bigint not null, document jsonb not null check(document->>'mode'='financial-sandbox-only'));
create table store_billing_acceptance.history(revision bigint primary key, actor text not null, request text not null, document jsonb not null, created_at timestamptz not null default clock_timestamp(), unique(actor,request));
create table store_billing_acceptance.journal(id text primary key, document jsonb not null, created_at timestamptz not null default clock_timestamp());
create table store_billing_acceptance.lines(journal text references store_billing_acceptance.journal(id), ordinal integer not null, account text not null, credits bigint not null, primary key(journal,ordinal));
create index lines_account on store_billing_acceptance.lines(account);
create function store_billing_acceptance.immutable() returns trigger language plpgsql security invoker set search_path=pg_catalog as $$begin raise exception 'Financial sandbox journal is immutable';end$$;
create function store_billing_acceptance.balanced() returns trigger language plpgsql security invoker set search_path=pg_catalog as $$begin
 if (select coalesce(sum(credits),0) from store_billing_acceptance.lines where journal=new.journal)<>0 then raise exception 'Unbalanced journal';end if;
 return null;end$$;
create constraint trigger balanced after insert on store_billing_acceptance.lines deferrable initially deferred for each row execute function store_billing_acceptance.balanced();
create trigger immutable before update or delete on store_billing_acceptance.history for each row execute function store_billing_acceptance.immutable();
create trigger immutable before update or delete on store_billing_acceptance.journal for each row execute function store_billing_acceptance.immutable();
create trigger immutable before update or delete on store_billing_acceptance.lines for each row execute function store_billing_acceptance.immutable();
create trigger no_truncate before truncate on store_billing_acceptance.history for each statement execute function store_billing_acceptance.immutable();
create trigger no_truncate before truncate on store_billing_acceptance.journal for each statement execute function store_billing_acceptance.immutable();
create trigger no_truncate before truncate on store_billing_acceptance.lines for each statement execute function store_billing_acceptance.immutable();
alter table store_billing_acceptance.state enable row level security;
alter table store_billing_acceptance.history enable row level security;
alter table store_billing_acceptance.journal enable row level security;
alter table store_billing_acceptance.lines enable row level security;
revoke all on all tables in schema store_billing_acceptance from public;
revoke all on all functions in schema store_billing_acceptance from public;


create table store_billing_acceptance.store_receipts (
 provider text not null check(provider in ('google','apple')),
 receipt_key text not null,
 member_id text not null,
 product jsonb not null,
 status text not null check(status in ('PENDING','PURCHASED','CANCELLED','REVOKED')),
 encrypted_reference text not null,
 updated_at timestamptz not null default clock_timestamp(),
 primary key(provider,receipt_key)
);
create table store_billing_acceptance.store_events (
 provider text not null, receipt_key text not null, status text not null,
 created_at timestamptz not null default clock_timestamp(),
 primary key(provider,receipt_key,status),
 foreign key(provider,receipt_key) references store_billing_acceptance.store_receipts
);
create table store_billing_acceptance.store_outbox (
 provider text not null, receipt_key text not null,
 state text not null default 'pending' check(state in ('pending','working','done','cancelled')),
 attempts integer not null default 0,
 lease_until timestamptz,
 updated_at timestamptz not null default clock_timestamp(),
 primary key(provider,receipt_key),
 foreign key(provider,receipt_key) references store_billing_acceptance.store_receipts
);
alter table store_billing_acceptance.store_receipts enable row level security;
alter table store_billing_acceptance.store_events enable row level security;
alter table store_billing_acceptance.store_outbox enable row level security;
revoke all on store_billing_acceptance.store_receipts,store_billing_acceptance.store_events,store_billing_acceptance.store_outbox from public;
create trigger immutable before update or delete on store_billing_acceptance.store_events for each row execute function store_billing_acceptance.immutable();

create table store_billing_acceptance.control(id boolean primary key check(id), purpose text not null check(purpose='google-test-only-no-customer-wallet'), calls integer not null default 0);
insert into store_billing_acceptance.control(id,purpose) values(true,'google-test-only-no-customer-wallet');
alter table store_billing_acceptance.control enable row level security;
revoke all on schema store_billing_acceptance from public,anon,authenticated,service_role;
revoke all on all tables in schema store_billing_acceptance from public,anon,authenticated,service_role;
revoke all on all functions in schema store_billing_acceptance from public,anon,authenticated,service_role;
grant usage on schema store_billing_acceptance to docked_billing_test;
grant select,insert,update on all tables in schema store_billing_acceptance to docked_billing_test;
grant execute on all functions in schema store_billing_acceptance to docked_billing_test;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['state','history','journal','lines','store_receipts','store_events','store_outbox','control'] LOOP
  EXECUTE format('CREATE POLICY acceptance_role ON store_billing_acceptance.%I TO docked_billing_test USING (true) WITH CHECK (true)', t);
 END LOOP;
END $$;
