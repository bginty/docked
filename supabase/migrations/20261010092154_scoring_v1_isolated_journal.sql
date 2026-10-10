-- New isolated simulation journal only. No grants to browser/application roles,
-- no official tables touched, no hosted ingestion job or SECURITY DEFINER.
create schema scoring_beta;
revoke all on schema scoring_beta from public, anon, authenticated;
create table scoring_beta.rules (
 version text primary key,
 sport text not null check (sport in ('epl','nfl','afl')),
 rules_hash text not null check (rules_hash ~ '^[a-f0-9]{64}$'),
 configuration jsonb not null
);
create table scoring_beta.streams (
 id text primary key check (id like 'sim:%'),
 sport text not null check (sport in ('epl','nfl','afl')),
 rules_version text not null references scoring_beta.rules(version),
 created_at timestamptz not null default clock_timestamp()
);
create table scoring_beta.journal (
 stream_id text not null references scoring_beta.streams(id),
 revision integer not null check (revision > 0),
 previous_hash text not null,
 state_hash text not null check (state_hash ~ '^[a-f0-9]{64}$'),
 body jsonb not null check (body->>'scope'='simulated-beta'),
 calculated jsonb not null,
 recorded_at timestamptz not null default clock_timestamp(),
 primary key (stream_id,revision), unique (stream_id,state_hash)
);
alter table scoring_beta.streams enable row level security;
alter table scoring_beta.rules enable row level security;
alter table scoring_beta.journal enable row level security;
revoke all on all tables in schema scoring_beta from public, anon, authenticated;
create function scoring_beta.immutable() returns trigger language plpgsql security invoker set search_path='' as $$
begin raise exception 'Scoring journal is append only'; end $$;
revoke all on function scoring_beta.immutable() from public, anon, authenticated;
create trigger scoring_stream_immutable before update or delete on scoring_beta.streams for each row execute function scoring_beta.immutable();
create trigger scoring_rules_immutable before update or delete on scoring_beta.rules for each row execute function scoring_beta.immutable();
create trigger scoring_journal_immutable before update or delete on scoring_beta.journal for each row execute function scoring_beta.immutable();
create function scoring_beta.check_append() returns trigger language plpgsql security invoker set search_path='' as $$
declare last_revision integer; last_hash text; stream_sport text;
begin
 select sport into stream_sport from scoring_beta.streams where id=new.stream_id for update;
 select revision,state_hash into last_revision,last_hash from scoring_beta.journal where stream_id=new.stream_id order by revision desc limit 1;
 if new.revision<>coalesce(last_revision,0)+1 or new.previous_hash<>coalesce(last_hash,'')
 or new.body->'period'->>'id'<>new.stream_id or new.body->'period'->>'sport'<>stream_sport then
   raise exception 'Invalid scoring journal chain';
 end if;
 return new;
end $$;
revoke all on function scoring_beta.check_append() from public, anon, authenticated;
create trigger scoring_journal_chain before insert on scoring_beta.journal for each row execute function scoring_beta.check_append();
