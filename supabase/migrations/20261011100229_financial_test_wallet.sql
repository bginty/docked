-- Isolated invited test economy. Explicit owner authority 11 Oct 2026; no cash or official assets.
create schema credits_sandbox;
revoke all on schema credits_sandbox from public;
create table credits_sandbox.state(id boolean primary key check(id), revision bigint not null, document jsonb not null check(document->>'mode'='financial-sandbox-only'));
create table credits_sandbox.history(revision bigint primary key, actor text not null, request text not null, document jsonb not null, created_at timestamptz not null default clock_timestamp(), unique(actor,request));
create table credits_sandbox.journal(id text primary key, document jsonb not null, created_at timestamptz not null default clock_timestamp());
create table credits_sandbox.lines(journal text references credits_sandbox.journal(id), ordinal integer not null, account text not null, credits bigint not null, primary key(journal,ordinal));
create index lines_account on credits_sandbox.lines(account);
create function credits_sandbox.immutable() returns trigger language plpgsql security invoker set search_path=pg_catalog as $$begin raise exception 'Financial sandbox journal is immutable';end$$;
create function credits_sandbox.balanced() returns trigger language plpgsql security invoker set search_path=pg_catalog as $$begin
 if (select coalesce(sum(credits),0) from credits_sandbox.lines where journal=new.journal)<>0 then raise exception 'Unbalanced journal';end if;
 return null;end$$;
create constraint trigger balanced after insert on credits_sandbox.lines deferrable initially deferred for each row execute function credits_sandbox.balanced();
create trigger immutable before update or delete on credits_sandbox.history for each row execute function credits_sandbox.immutable();
create trigger immutable before update or delete on credits_sandbox.journal for each row execute function credits_sandbox.immutable();
create trigger immutable before update or delete on credits_sandbox.lines for each row execute function credits_sandbox.immutable();
create trigger no_truncate before truncate on credits_sandbox.history for each statement execute function credits_sandbox.immutable();
create trigger no_truncate before truncate on credits_sandbox.journal for each statement execute function credits_sandbox.immutable();
create trigger no_truncate before truncate on credits_sandbox.lines for each statement execute function credits_sandbox.immutable();
alter table credits_sandbox.state enable row level security;
alter table credits_sandbox.history enable row level security;
alter table credits_sandbox.journal enable row level security;
alter table credits_sandbox.lines enable row level security;
revoke all on all tables in schema credits_sandbox from public;
revoke all on all functions in schema credits_sandbox from public;

create table credits_sandbox.access(user_id uuid primary key references auth.users(id),kind text not null check(kind in ('owner','tester')),label text not null,enabled boolean not null default false,authority_note text not null,created_at timestamptz not null default now());
alter table credits_sandbox.access enable row level security;
revoke all on all tables in schema credits_sandbox from anon,authenticated,service_role;
revoke all on all functions in schema credits_sandbox from anon,authenticated,service_role;
grant usage on schema credits_sandbox to docked_beta_app;
grant select,update on credits_sandbox.state to docked_beta_app;
grant select,insert on credits_sandbox.history,credits_sandbox.journal,credits_sandbox.lines to docked_beta_app;
grant select on credits_sandbox.access to docked_beta_app;
create policy runtime_state_select on credits_sandbox.state for select to docked_beta_app using(true);
create policy runtime_state_update on credits_sandbox.state for update to docked_beta_app using(true) with check(document->>'mode'='financial-sandbox-only' and document->'policy'->>'version'='invited-test-credits-2026-10-11-v1');
create policy runtime_history on credits_sandbox.history to docked_beta_app using(true) with check(true);
create policy runtime_journal on credits_sandbox.journal to docked_beta_app using(true) with check(true);
create policy runtime_lines on credits_sandbox.lines to docked_beta_app using(true) with check(true);
create policy runtime_access on credits_sandbox.access for select to docked_beta_app using(true);
-- No browser role or PostgREST execution grant; server derives actor from verified
-- session and admission. No security-definer functions or official-schema grants.

