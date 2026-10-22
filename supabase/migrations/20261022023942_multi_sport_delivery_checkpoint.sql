-- Isolated raw delivery only. No ownership, wallet, issuance or result writes.
create table sports_feed.delivery_checkpoints (
 source text not null, sport text not null check(sport in ('epl','nba','afl','nrl')),
 dataset text not null, sequence bigint not null check(sequence>=0), cursor text not null,
 last_success timestamptz not null, primary key(source,sport)
);
create table sports_feed.delivery_records (
 source text not null, sport text not null, kind text not null,
 entity text not null, revision bigint not null check(revision>0),
 payload jsonb not null, payload_hash text not null,
 primary key(source,sport,kind,entity)
);
create table sports_feed.delivery_recalculations (
 source text not null,sport text not null,entity text not null,revision bigint not null,
 state text not null default 'pending_review' check(state in ('pending_review','blocked','applied')),
 reason text,created_at timestamptz not null default clock_timestamp(),
 primary key(source,sport,entity,revision)
);
create table sports_feed.delivery_receipts (
 source text not null,sport text not null,digest text not null,
 cursor text not null,received_at timestamptz not null default clock_timestamp(),
 primary key(source,sport,digest)
);
do $$declare t text;begin
 foreach t in array array['delivery_checkpoints','delivery_records','delivery_recalculations','delivery_receipts'] loop
  execute format('alter table sports_feed.%I enable row level security',t);
  execute format('revoke all on sports_feed.%I from public,anon,authenticated,docked_app,docked_beta_app',t);
 end loop;
end$$;
create trigger immutable before update or delete on sports_feed.delivery_receipts for each row execute function sports_feed.immutable();
-- Provision a dedicated operator role on the isolated host, never an app role.
-- Explicit policies/grants for that role are installed by the reviewed host setup.
