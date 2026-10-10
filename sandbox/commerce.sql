-- Disposable local test database ONLY. Not in migrations and not deployed.
create schema commerce_sandbox;
revoke all on schema commerce_sandbox from public;
create table commerce_sandbox.state(id boolean primary key check(id), revision bigint not null, document jsonb not null);
create table commerce_sandbox.history(revision bigint primary key, actor text not null, request text not null, document jsonb not null, created_at timestamptz not null default clock_timestamp());
create function commerce_sandbox.immutable() returns trigger language plpgsql as $$begin raise exception 'Commerce audit history is immutable';end$$;
create trigger immutable before update or delete on commerce_sandbox.history for each row execute function commerce_sandbox.immutable();
alter table commerce_sandbox.state enable row level security;
alter table commerce_sandbox.history enable row level security;
revoke all on all tables in schema commerce_sandbox from public;
revoke all on all functions in schema commerce_sandbox from public;
create table commerce_sandbox.prizes(id boolean primary key check(id), document jsonb not null);
create table commerce_sandbox.prize_history(id bigint generated always as identity primary key, document jsonb not null, created_at timestamptz not null default clock_timestamp());
alter table commerce_sandbox.prizes enable row level security;
alter table commerce_sandbox.prize_history enable row level security;
create trigger immutable before update or delete on commerce_sandbox.prize_history for each row execute function commerce_sandbox.immutable();
revoke all on commerce_sandbox.prizes,commerce_sandbox.prize_history from public;
