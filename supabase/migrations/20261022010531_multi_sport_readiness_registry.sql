-- Readiness evidence only. No public sports, packs, cards, balances or competition
-- flags are changed by this migration or by an owner approval below.
create table sports_feed.canonical_mappings (
 stream_id text not null references sports_feed.streams,
 fixture_id text not null,
 mapping_hash text not null check(mapping_hash ~ '^[a-f0-9]{64}$'),
 mapping jsonb not null,
 primary key(stream_id,fixture_id)
);
create table sports_feed.player_identities (
 sport text not null check(sport in ('afl','football','basketball','nrl')),
 player_id text not null check(length(player_id) between 1 and 160),
 created_at timestamptz not null default clock_timestamp(),
 primary key(sport,player_id)
);
create table sports_feed.player_aliases (
 sport text not null,
 provider text not null,
 provider_player_id text not null,
 player_id text not null,
 evidence_hash text not null check(evidence_hash ~ '^[a-f0-9]{64}$'),
 recorded_at timestamptz not null default clock_timestamp(),
 primary key(sport,provider,provider_player_id),
 unique(sport,provider,player_id),
 foreign key(sport,player_id) references sports_feed.player_identities(sport,player_id)
);
create table sports_feed.roster_observations (
 id bigint generated always as identity primary key,
 batch_hash text not null check(batch_hash ~ '^[a-f0-9]{64}$'),
 row_index integer not null check(row_index>=0),
 sport text not null check(sport in ('afl','football','basketball','nrl')),
 season text not null,
 provider text not null,
 player_id text,
 observed_at timestamptz not null,
 expires_at timestamptz not null check(expires_at>observed_at),
 status text not null check(status in ('ready-for-review','quarantined')),
 reasons jsonb not null check(jsonb_typeof(reasons)='array'),
 candidate jsonb,
 recorded_at timestamptz not null default clock_timestamp(),
 unique(batch_hash,row_index)
);
create index roster_observation_latest on sports_feed.roster_observations(sport,season,provider,player_id,observed_at desc,id desc);
create table sports_feed.activation_packages (
 package_hash text primary key check(package_hash ~ '^[a-f0-9]{64}$'),
 sport text not null check(sport in ('afl','football','basketball','nrl')),
 season text not null,
 mode text not null check(mode in ('OPEN','SALARY_CAP')),
 body jsonb not null,
 recorded_at timestamptz not null default clock_timestamp(),
 check(body->>'sport'=sport and body->>'season'=season and body->>'mode'=mode)
);
create index activation_package_context on sports_feed.activation_packages(sport,season,mode,recorded_at desc);
create table sports_feed.activation_decisions (
 id bigint generated always as identity primary key,
 package_hash text not null references sports_feed.activation_packages,
 actor uuid not null,
 action text not null check(action in ('approve','suspend')),
 reason text not null check(length(btrim(reason)) between 10 and 1000),
 request_id uuid not null unique,
 recorded_at timestamptz not null default clock_timestamp()
);
create index activation_decision_latest on sports_feed.activation_decisions(package_hash,id desc);
do $$declare t text;begin
 foreach t in array array['canonical_mappings','player_identities','player_aliases','roster_observations','activation_packages','activation_decisions'] loop
  execute format('alter table sports_feed.%I enable row level security',t);
  execute format('revoke all on sports_feed.%I from public,anon,authenticated,docked_app,docked_beta_app',t);
  execute format('create trigger immutable before update or delete on sports_feed.%I for each row execute function sports_feed.immutable()',t);
 end loop;
end$$;

-- Existing session, admission, role and MFA checks remain authoritative.
create function beta_private.sport_readiness_owner() returns void
language plpgsql security definer set search_path='' as $$begin
 if not beta_private.active_member_session() or auth.jwt()->>'aal' is distinct from 'aal2'
 or not exists(select 1 from beta_private.roles where user_id=auth.uid() and role='owner')
 or not beta_private.owner_gameplay_identity(auth.uid()) then raise exception 'Owner MFA required';end if;
end$$;
create function beta_private.sport_readiness_decide(p_hash text,p_action text,p_reason text,p_request uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p jsonb; e jsonb; g text; previous sports_feed.activation_decisions;begin
 perform beta_private.sport_readiness_owner();
 if p_action not in ('approve','suspend') or p_action is null or p_request is null
 or p_reason is null or length(btrim(p_reason)) not between 10 and 1000 then raise exception 'Invalid decision';end if;
 perform pg_advisory_xact_lock(hashtextextended('sport-readiness:'||p_request::text,0));
 select * into previous from sports_feed.activation_decisions where request_id=p_request;
 if found then
  if previous.actor<>auth.uid() or previous.package_hash<>p_hash or previous.action<>p_action or previous.reason<>p_reason then raise exception 'Decision idempotency conflict';end if;
  return jsonb_build_object('id',previous.id,'activated',false);
 end if;
 select body into p from sports_feed.activation_packages where package_hash=p_hash for share;
 if p is null then raise exception 'Package unavailable';end if;
 perform pg_advisory_xact_lock(hashtextextended('sport-package:'||p_hash,0));
 if p_action='approve' then
  if jsonb_typeof(p->'evidence') is distinct from 'array' or jsonb_array_length(p->'evidence')<>10 then raise exception 'Ten independent gates required';end if;
  foreach g in array array['roster-format','scoring-rules','eligible-catalogue','source-rights','operational-ingestion','score-reconciliation','supply-issuance','lockout-privacy','wallet-ownership','hosted-acceptance'] loop
   if (select count(*) from jsonb_array_elements(p->'evidence') x where x->>'gate'=g)<>1 then raise exception 'Missing or duplicate gate: %',g;end if;
   select x into e from jsonb_array_elements(p->'evidence') x where x->>'gate'=g;
   if e->>'outcome' is distinct from 'passed' or (e->>'verifiedAt')::timestamptz>clock_timestamp()
    or (e->>'expiresAt')::timestamptz<=clock_timestamp() or e->>'verifiedAt' is null or e->>'expiresAt' is null
    or e->>'releaseHash' is distinct from p->>'releaseHash' or e->>'catalogueHash' is distinct from p->>'catalogueHash'
    or e->>'rulesHash' is distinct from p->>'rulesHash' or e->>'issuanceHash' is distinct from p->>'issuanceHash'
    or coalesce(e->>'sha256','') !~ '^[a-f0-9]{64}$' or coalesce(length(e->>'reference'),0)=0
    then raise exception 'Gate blocked, expired or superseded: %',g;end if;
  end loop;
  if p->>'mode'='SALARY_CAP' and coalesce((p->>'salaryCap')::numeric,0)<=0 then raise exception 'Approved salary cap required';end if;
  if p->>'mode'='OPEN' and p->>'salaryCap' is not null then raise exception 'All-Star must be uncapped';end if;
 end if;
 insert into sports_feed.activation_decisions(package_hash,actor,action,reason,request_id)
 values(p_hash,auth.uid(),p_action,p_reason,p_request) returning * into previous;
 return jsonb_build_object('id',previous.id,'activated',false);
end$$;

create function beta_private.sport_readiness_report() returns jsonb
language plpgsql security definer set search_path='' as $$declare report jsonb;begin
 perform beta_private.sport_readiness_owner();
 with latest as (
  select distinct on(sport,season,provider,coalesce(player_id,id::text)) * from sports_feed.roster_observations
  order by sport,season,provider,coalesce(player_id,id::text),observed_at desc,id desc
 ), packages as (
  select distinct on(sport,season,mode) * from sports_feed.activation_packages
  order by sport,season,mode,recorded_at desc,package_hash
 ) select jsonb_build_object('generatedAt',clock_timestamp(),
 'catalogue',coalesce((select jsonb_agg(x) from (select sport,position,status,count(*) count from beta_fantasy.players group by 1,2,3)x),'[]'),
 'rosters',coalesce((select jsonb_agg(x) from (select sport,season,provider,count(*) reviewed,
 count(*) filter(where status='ready-for-review' and expires_at>clock_timestamp()) current_reviewed,
 count(*) filter(where status='quarantined') quarantined,
 count(*) filter(where expires_at<=clock_timestamp()) expired,
 count(*) filter(where candidate->>'jerseyNumber' is null) missing_numbers,
 max(observed_at) last_observed from latest group by 1,2,3)x),'[]'),
 'issues',coalesce((select jsonb_agg(x) from (select sport,season,provider,player_id,status,reasons,observed_at,expires_at from latest
 where status='quarantined' or expires_at<=clock_timestamp() or candidate->>'jerseyNumber' is null order by observed_at desc limit 100)x),'[]'),
 'packages',coalesce((select jsonb_agg(jsonb_build_object('hash',p.package_hash,'body',p.body,'decision',
 (select jsonb_build_object('packageHash',d.package_hash,'action',d.action,'at',d.recorded_at) from sports_feed.activation_decisions d where d.package_hash=p.package_hash order by d.id desc limit 1))) from packages p),'[]'),
 'jobs',coalesce((select jsonb_agg(x) from (select provider,state,count(*) count,max(last_success) last_success from sports_feed.jobs group by 1,2)x),'[]'),
 'issueLimit',100,'activatedByThisSystem',false) into report;
 return report;
end$$;
revoke all on function beta_private.sport_readiness_owner(),beta_private.sport_readiness_report(),beta_private.sport_readiness_decide(text,text,text,uuid) from public,anon,authenticated,docked_app,docked_beta_app;
grant execute on function beta_private.sport_readiness_report(),beta_private.sport_readiness_decide(text,text,text,uuid) to docked_beta_app;
