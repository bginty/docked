-- DISPOSABLE LOCAL TEST DATABASE ONLY. Not a production migration.
create table credits_sandbox.store_receipts (
 provider text not null check(provider in ('google','apple')),
 receipt_key text not null,
 member_id text not null,
 product jsonb not null,
 status text not null check(status in ('PENDING','PURCHASED','CANCELLED','REVOKED')),
 encrypted_reference text not null,
 updated_at timestamptz not null default clock_timestamp(),
 primary key(provider,receipt_key)
);
create table credits_sandbox.store_events (
 provider text not null, receipt_key text not null, status text not null,
 created_at timestamptz not null default clock_timestamp(),
 primary key(provider,receipt_key,status),
 foreign key(provider,receipt_key) references credits_sandbox.store_receipts
);
create table credits_sandbox.store_outbox (
 provider text not null, receipt_key text not null,
 state text not null default 'pending' check(state in ('pending','working','done','cancelled')),
 attempts integer not null default 0,
 lease_until timestamptz,
 updated_at timestamptz not null default clock_timestamp(),
 primary key(provider,receipt_key),
 foreign key(provider,receipt_key) references credits_sandbox.store_receipts
);
alter table credits_sandbox.store_receipts enable row level security;
alter table credits_sandbox.store_events enable row level security;
alter table credits_sandbox.store_outbox enable row level security;
revoke all on credits_sandbox.store_receipts,credits_sandbox.store_events,credits_sandbox.store_outbox from public;
create trigger immutable before update or delete on credits_sandbox.store_events for each row execute function credits_sandbox.immutable();
