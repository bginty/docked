-- Isolated Docked beta post-game evidence. No production inventory changes.
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

-- Only the existing beta server role may execute. No PostgREST/table grants.
create function sports_feed.member_results() returns jsonb
language plpgsql security definer set search_path='' as $$
declare viewer uuid; output jsonb;
begin
 viewer := beta_fantasy.production_eligible();
 if viewer is null or viewer<>auth.uid() or not beta_private.active_member_session() then raise exception 'Admission required'; end if;
 select coalesce(jsonb_agg(item order by created_at desc),'[]'::jsonb) into output from (
  select s.created_at,jsonb_build_object('id',s.id,'purpose',s.purpose,'metadata',s.display_metadata,
   'revision',j.revision,'recordedAt',j.recorded_at,'view',
   (j.calculated-'rows')||jsonb_build_object('rows',(
    select coalesce(jsonb_agg(r-'member'),'[]'::jsonb) from jsonb_array_elements(j.calculated->'rows') r
    where s.purpose='historical-acceptance' or r->>'member'=viewer::text
   ))) item
  from sports_feed.streams s
  join lateral (select * from sports_feed.journal where stream_id=s.id order by revision desc limit 1) j on true
  where (s.purpose='member' and exists(select 1 from sports_feed.stream_members m where m.stream_id=s.id and m.user_id=viewer))
   or (s.purpose='historical-acceptance' and beta_private.owner_gameplay_identity(viewer) and coalesce(auth.jwt()->>'aal','')='aal2')
  order by s.created_at desc limit 30
 ) visible;
 return output;
end$$;
revoke all on function sports_feed.member_results() from public,anon,authenticated;
grant usage on schema sports_feed to docked_beta_app;
grant execute on function sports_feed.member_results() to docked_beta_app;

