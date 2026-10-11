-- LOCAL DISPOSABLE FINANCIAL SANDBOX ONLY. Never migrate into friends/production.
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
