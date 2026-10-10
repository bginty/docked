-- Local acceptance schema. Deploy only after source storage rights and activation review.
-- No web/member grants. Does not change existing simulated or production records.
create schema sports_feed;
revoke all on schema sports_feed from public;
create table sports_feed.budget(provider text not null, day date not null, used integer not null check(used>0), primary key(provider,day));
create table sports_feed.jobs(id text primary key, provider text not null, request jsonb not null, state text not null default 'queued' check(state in('queued','leased','done','blocked')), attempts integer not null default 0, available_at timestamptz not null default clock_timestamp(), lease uuid, lease_until timestamptz, error_code text, last_success timestamptz);
create table sports_feed.raw_revisions(id bigint generated always as identity primary key, provider text not null, resource text not null, body_hash text not null, body jsonb, observed_at timestamptz not null, rights_evidence text not null, expires_at timestamptz not null, purged_at timestamptz, check((body is null)=(purged_at is not null)));
create unique index retained_raw_identity on sports_feed.raw_revisions(provider,resource,body_hash) where body is not null;
create table sports_feed.streams(id text primary key check(id like 'beta-real:%'), created_at timestamptz not null default clock_timestamp());
create table sports_feed.journal(stream_id text not null references sports_feed.streams, revision integer not null, previous_hash text not null, state_hash text not null, body jsonb not null check(body->>'scope'='authorised-free-beta'), calculated jsonb not null, raw_id bigint references sports_feed.raw_revisions, recorded_at timestamptz not null default clock_timestamp(), primary key(stream_id,revision), unique(stream_id,state_hash));
create function sports_feed.immutable() returns trigger language plpgsql set search_path='' as $$begin raise exception 'Append only sports evidence';end$$;
create trigger immutable before update or delete on sports_feed.journal for each row execute function sports_feed.immutable();
-- Raw payloads expire under source licence; hashes/provenance survive in journal.
create function sports_feed.raw_retention_guard() returns trigger language plpgsql set search_path='' as $$begin
 if tg_op='UPDATE' and old.expires_at<=clock_timestamp() and old.body is not null and new.body is null and new.purged_at is not null and new.purged_at<=clock_timestamp() and new.purged_at>=old.expires_at
 and (to_jsonb(new)-'body'-'purged_at')=(to_jsonb(old)-'body'-'purged_at') then return new;end if;
 raise exception 'Raw evidence immutable except expired payload purge';end$$;
create trigger immutable before update or delete on sports_feed.raw_revisions for each row execute function sports_feed.raw_retention_guard();
alter table sports_feed.journal enable row level security;
alter table sports_feed.streams enable row level security;
alter table sports_feed.raw_revisions enable row level security;
alter table sports_feed.jobs enable row level security;
alter table sports_feed.budget enable row level security;
revoke all on all tables in schema sports_feed from public;
revoke all on all functions in schema sports_feed from public;
