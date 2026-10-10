-- Additive private source evidence. No member writes, no production inventory.
create table sports_feed.completions(game_id text primary key,first_observed_at timestamptz not null,first_raw_id bigint not null references sports_feed.raw_revisions);
create trigger immutable before update or delete on sports_feed.completions for each row execute function sports_feed.immutable();
create table sports_feed.completion_observations(game_id text not null,raw_id bigint not null references sports_feed.raw_revisions,completed boolean not null,marker jsonb,observed_at timestamptz not null default clock_timestamp(),primary key(game_id,raw_id));
create trigger immutable before update or delete on sports_feed.completion_observations for each row execute function sports_feed.immutable();
alter table sports_feed.streams add column purpose text not null default 'member' check(purpose in('member','historical-acceptance'));
alter table sports_feed.streams add column display_metadata jsonb not null default '{}';
create table sports_feed.bundle_evidence(stream_id text not null references sports_feed.streams,fixture_id text not null,weekly_raw_id bigint not null references sports_feed.raw_revisions,pbp_raw_id bigint not null references sports_feed.raw_revisions,recorded_at timestamptz not null default clock_timestamp(),primary key(stream_id,fixture_id,weekly_raw_id,pbp_raw_id));
create trigger immutable before update or delete on sports_feed.bundle_evidence for each row execute function sports_feed.immutable();
create table sports_feed.stream_members(stream_id text not null references sports_feed.streams,user_id uuid not null,primary key(stream_id,user_id));
alter table sports_feed.completions enable row level security;
alter table sports_feed.completion_observations enable row level security;
alter table sports_feed.bundle_evidence enable row level security;
alter table sports_feed.stream_members enable row level security;
revoke all on all tables in schema sports_feed from public;
create index raw_expiry on sports_feed.raw_revisions(expires_at) where body is not null;
create index stream_members_user on sports_feed.stream_members(user_id,stream_id);
