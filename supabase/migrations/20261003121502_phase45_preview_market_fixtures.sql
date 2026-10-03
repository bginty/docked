-- Isolated synthetic UX records. Deliberately no canonical event/market/ledger
-- foreign keys and no social-post projection, outcomes, ranking or prize fields.
create table private.preview_market_sessions(
 id uuid primary key, profile_id uuid not null references private.social_profiles(id),
 fixture_id text not null check(fixture_id in ('demo-football','demo-basketball')),
 selection text not null check(length(selection) between 1 and 80),
 observed_at timestamptz not null,expires_at timestamptz not null,
 payload jsonb not null,payload_hash text not null check(payload_hash ~ '^[a-f0-9]{64}$')
);
create table private.preview_fixture_edges(
 id uuid primary key default gen_random_uuid(),profile_id uuid not null references private.social_profiles(id),
 session_id uuid not null references private.preview_market_sessions(id),
 idempotency_key uuid not null,payload_hash text not null check(payload_hash ~ '^[a-f0-9]{64}$'),
 submitted_at timestamptz not null default clock_timestamp(),
 unique(profile_id,idempotency_key),unique(profile_id,session_id)
);
alter table private.preview_market_sessions enable row level security;
alter table private.preview_fixture_edges enable row level security;
revoke all on private.preview_market_sessions,private.preview_fixture_edges from public,anon,authenticated;
create trigger immutable before update or delete on private.preview_market_sessions for each row execute function private.immutable();
create trigger immutable before update or delete on private.preview_fixture_edges for each row execute function private.immutable();

create function private.preview_fixture_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare actor uuid; snapshot private.preview_market_sessions; checked_at timestamptz; source jsonb;
begin
 select p.user_id into actor from private.social_profiles p where p.id=new.profile_id and p.status='active' for share;
 if actor is null or actor is distinct from auth.uid() then raise exception 'Preview fixture owner required'; end if;
 if tg_table_name='preview_fixture_edges' then
  select * into snapshot from private.preview_market_sessions where id=new.session_id and profile_id=new.profile_id for update;
  if not found or new.payload_hash is distinct from snapshot.payload_hash then raise exception 'Preview review mismatch'; end if;
 end if;
 -- Rechecks exact project, expiry/revocation, verified active same-user session
 -- and explicit capability after source/profile locks. No metadata-based grant.
 perform private.assert_preview_tester_capability(actor,'preview_market_fixtures');
 checked_at:=clock_timestamp();
 if tg_table_name='preview_market_sessions' then
  if new.observed_at>checked_at or new.observed_at<checked_at-interval '15 seconds'
   or new.expires_at is distinct from new.observed_at+interval '90 seconds'
   or new.payload->>'evidenceMode' is distinct from 'preview' or new.payload->'fixture' is distinct from 'true'::jsonb
   or new.payload->>'label' is distinct from 'DEMO / PREVIEW PRICE'
   or new.payload->>'fixtureId' is distinct from new.fixture_id or new.payload->>'selection' is distinct from new.selection
   or (new.payload->>'observedAt')::timestamptz is distinct from new.observed_at
   or (new.payload->>'expiresAt')::timestamptz is distinct from new.expires_at
   or (new.payload->>'startAt')::timestamptz is distinct from new.observed_at+interval '2 hours'
   or new.payload#>>'{rules,eventId}' is distinct from 'preview:'||new.id::text
   or new.payload#>>'{reference,evidenceMode}' is distinct from 'preview'
   or new.payload#>'{reference,fixture}' is distinct from 'true'::jsonb
   or new.payload#>>'{reference,label}' is distinct from 'DEMO / PREVIEW PRICE'
   or new.payload#>>'{reference,selection}' is distinct from new.selection
   or jsonb_typeof(new.payload->'sources') is distinct from 'array'
   or jsonb_array_length(new.payload->'sources') is distinct from 4
   or new.payload_hash is distinct from encode(sha256(convert_to(private.reference_canonical_json(new.payload),'UTF8')),'hex')
  then raise exception 'Isolated synthetic preview evidence required'; end if;
  for source in select value from jsonb_array_elements(new.payload->'sources') loop
   if source->>'provenance' is distinct from 'fixture' or source->>'provider' is distinct from 'authored-preview-fixture'
    or source->>'bookmaker' not in ('DEMO-P1','DEMO-P2','DEMO-A1','DEMO-A2')
    or source->>'bookmaker' is null
   then raise exception 'Preview cannot import provider evidence'; end if;
  end loop;
 else
  if snapshot.expires_at<=checked_at or snapshot.observed_at>checked_at then raise exception 'Preview review expired'; end if;
  new.submitted_at:=checked_at;
 end if;
 return new;
end $$;
create trigger preview_fixture_guard before insert on private.preview_market_sessions for each row execute function private.preview_fixture_guard();
create trigger preview_fixture_guard before insert on private.preview_fixture_edges for each row execute function private.preview_fixture_guard();
create function private.preview_fixture_audit() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 insert into private.audit_events(actor,action,subject,details) values(new.profile_id::text,'preview_fixture_submitted',new.id::text,jsonb_build_object('fixture',true,'label','DEMO / PREVIEW PRICE','sessionId',new.session_id));
 return new;
end $$;
create trigger preview_fixture_audit after insert on private.preview_fixture_edges for each row execute function private.preview_fixture_audit();
revoke all on function private.preview_fixture_guard(),private.preview_fixture_audit() from public,anon,authenticated;
