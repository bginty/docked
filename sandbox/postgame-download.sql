-- Local acceptance only. Apply AFTER sports-feed.sql. No hosted activation.
create table sports_feed.postgame_cache (
 resource text primary key, next_attempt timestamptz not null, lease uuid,
 raw_id bigint references sports_feed.raw_revisions, etag text, source_modified text,
 checked_at timestamptz, completion_evidence text, completion_observed_at timestamptz,
 error_code text
);
alter table sports_feed.postgame_cache enable row level security;
revoke all on sports_feed.postgame_cache from public;
create table sports_feed.postgame_mapping (
 stream_id text not null references sports_feed.streams,
 fixture_id text not null, mapping_hash text not null, mapping jsonb not null,
 actor text not null, recorded_at timestamptz not null default clock_timestamp(),
 primary key(stream_id,fixture_id)
);
create trigger immutable before update or delete on sports_feed.postgame_mapping for each row execute function sports_feed.immutable();
alter table sports_feed.postgame_mapping enable row level security;
revoke all on sports_feed.postgame_mapping from public;
