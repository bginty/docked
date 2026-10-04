-- Independent football infrastructure only. No model, source, probabilities or publication is activated.
create table private.football_model_versions(
 id text primary key, method text not null check(method='independent-football-model'),
 configuration jsonb not null, config_hash text not null unique check(config_hash ~ '^[a-f0-9]{64}$'),
 code_commit text not null check(code_commit ~ '^[a-f0-9]{40}$'),
 lifecycle text not null default 'DRAFT' check(lifecycle in('DRAFT','RESEARCH','FORWARD_CALIBRATION','APPROVED_FOR_CANDIDATES','APPROVED_FOR_LIVE','RETIRED')),
 created_by uuid not null, created_at timestamptz not null default clock_timestamp(), changed_at timestamptz not null default clock_timestamp()
);
create table private.football_model_transitions(
 id uuid primary key default gen_random_uuid(),model_version text not null references private.football_model_versions(id),
 from_state text not null,to_state text not null,actor uuid not null,reason text not null check(length(btrim(reason)) between 12 and 2000),
 config_hash text not null,code_commit text not null,configuration jsonb not null,evidence jsonb not null,created_at timestamptz not null default clock_timestamp()
);
-- A future reviewed estimator implementation must explicitly register its code/configuration binding.
-- No application endpoint creates these records; today's default provider cannot issue READY predictions.
create table private.football_model_implementations(
 model_version text primary key references private.football_model_versions(id),implementation_id text not null,
 code_commit text not null check(code_commit ~ '^[a-f0-9]{40}$'),config_hash text not null,
 training_data_hash text not null check(training_data_hash ~ '^[a-f0-9]{64}$'),
 reviewed_by uuid not null,evidence text not null check(length(btrim(evidence))>=20),created_at timestamptz not null default clock_timestamp()
);
create table private.football_sporting_sources(
 id text primary key,provider text not null,source_version text not null,rights_reference text not null,
 purposes text[] not null,known_at timestamptz not null,effective_from timestamptz not null,effective_to timestamptz not null,
 approved_by uuid not null,revoked_at timestamptz,created_at timestamptz not null default clock_timestamp(),
 check(effective_from<effective_to),check(purposes @> array['model_training','derived_probabilities','retained_evidence'])
);
create table private.football_sporting_inputs(
 id uuid primary key default gen_random_uuid(),event_id text not null references private.events(id),
 payload jsonb not null,input_hash text not null unique check(input_hash ~ '^[a-f0-9]{64}$'),
 as_of_time timestamptz not null,input_cutoff timestamptz not null,source_ids text[] not null,
 created_by uuid not null,created_at timestamptz not null default clock_timestamp()
);
create table private.football_model_attempts(
 id uuid primary key default gen_random_uuid(),idempotency_key text not null unique,
 job_id uuid not null references private.job_runs(id),event_id text not null references private.events(id),
 requested_model_version text not null,model_version text references private.football_model_versions(id),
 input_snapshot_id uuid references private.football_sporting_inputs(id),
 window_seconds integer not null check(window_seconds>0),status text not null check(status in('READY','ABSTAIN','NOT_CONFIGURED')),
 probabilities jsonb,fair_odds jsonb,quality jsonb not null,reason text,
 config_hash text,input_hash text,code_commit text not null check(code_commit ~ '^[a-f0-9]{40}$'),
 as_of_time timestamptz not null,calculated_at timestamptz not null,input_cutoff timestamptz,event_start_at timestamptz not null,event_participants jsonb not null,
 provenance jsonb not null,recorded_xid xid8 not null,created_at timestamptz not null default clock_timestamp(),
 unique(event_id,requested_model_version,window_seconds),
 check((status='READY' and probabilities is not null and model_version is not null and input_snapshot_id is not null and input_hash is not null and input_cutoff is not null)
 or(status<>'READY' and probabilities is null and reason is not null))
);
create table private.football_model_outcomes(
 id uuid primary key default gen_random_uuid(),prediction_id uuid not null references private.football_model_attempts(id),
 source_id text not null references private.football_sporting_sources(id),source_event_id text not null,revision text not null,sequence integer not null default 1 check(sequence>0),
 result text not null check(result in('home','draw','away','void','manual_review')),
 home_goals integer check(home_goals>=0),away_goals integer check(away_goals>=0),
 observed_at timestamptz not null,evidence jsonb not null,corrects uuid references private.football_model_outcomes(id),
 actor uuid not null,reason text not null check(length(btrim(reason))>=12),created_at timestamptz not null default clock_timestamp(),
 unique(prediction_id,source_id,source_event_id,revision)
);
create unique index football_outcome_initial on private.football_model_outcomes(prediction_id) where corrects is null;
create unique index football_outcome_correction_once on private.football_model_outcomes(corrects) where corrects is not null;
create table private.football_edge_policy_approvals(
 strategy_id text primary key references private.strategy_versions(id),model_version text not null references private.football_model_versions(id),
 config_hash text not null,code_commit text not null,actor uuid not null,reason text not null check(length(btrim(reason))>=12),
 created_at timestamptz not null default clock_timestamp(),revoked_at timestamptz
);
alter table private.strategy_versions add column football_model_version text references private.football_model_versions(id);
alter table private.scanner_candidates add column prediction_id uuid references private.football_model_attempts(id);
alter table private.tip_publications add column prediction_id uuid references private.football_model_attempts(id);
create table private.official_record_boundary(
 singleton boolean primary key default true check(singleton),first_tip_id uuid not null unique references private.tip_publications(id),
 started_at timestamptz not null,actor uuid not null
);
create table private.official_docked_publications(
 tip_id uuid primary key references private.tip_publications(id),event_id text not null unique references private.events(id),
 prediction_id uuid not null references private.football_model_attempts(id),model_version text not null references private.football_model_versions(id),
 published_at timestamptz not null,created_at timestamptz not null default clock_timestamp()
);

create function private.football_json_hash(value jsonb) returns text language sql immutable set search_path='' as $$
 select encode(sha256(convert_to(private.phase5_canonical_json(value),'UTF8')),'hex')
$$;
create function private.football_sport_only(value jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare k text;v jsonb;
begin
 if jsonb_typeof(value)='object' then
  for k,v in select * from jsonb_each(value) loop
   if lower(k) in('odds','prices','price','bookmaker','bookmakers','marketreference','closingodds','probability','probabilities','impliedprobability','referenceodds','marketprice') or not private.football_sport_only(v) then return false;end if;
  end loop;
 elsif jsonb_typeof(value)='array' then
  for v in select * from jsonb_array_elements(value) loop if not private.football_sport_only(v) then return false;end if;end loop;
 end if;return true;
end $$;
create function private.football_version_guard() returns trigger language plpgsql set search_path='' as $$
declare actor uuid;
begin
 actor:=private.scanner_assert_actor(true);
 if tg_op='DELETE' then raise exception 'Model versions are retained';end if;
 if tg_op='INSERT' then
  if new.created_by is distinct from actor or new.lifecycle<>'DRAFT' or new.config_hash is distinct from private.football_json_hash(new.configuration)
  or new.configuration->>'modelVersion' is distinct from new.id then raise exception 'Immutable model configuration binding required';end if;
  new.created_at:=clock_timestamp();new.changed_at:=new.created_at;
 elsif (to_jsonb(new)-array['lifecycle','changed_at']) is distinct from (to_jsonb(old)-array['lifecycle','changed_at'])
 or current_setting('docked.model_transition',true) is distinct from old.id then raise exception 'Create a new model version or use audited transition';end if;
 return new;
end $$;
create trigger football_version_guard before insert or update or delete on private.football_model_versions for each row execute function private.football_version_guard();

create function private.transition_football_model(p_id text,p_to text,p_reason text,p_evidence jsonb) returns text language plpgsql set search_path='' as $$
declare actor uuid;s private.football_model_versions;valid boolean;
begin
 actor:=private.scanner_assert_actor(true);select * into s from private.football_model_versions where id=p_id for update;
 if s.id is null or length(btrim(p_reason))<12 then raise exception 'Model and review reason required';end if;
 valid:=(s.lifecycle='DRAFT' and p_to='RESEARCH') or(s.lifecycle='RESEARCH' and p_to='FORWARD_CALIBRATION')
 or(s.lifecycle='FORWARD_CALIBRATION' and p_to='APPROVED_FOR_CANDIDATES') or(s.lifecycle='APPROVED_FOR_CANDIDATES' and p_to='APPROVED_FOR_LIVE')
 or(s.lifecycle<>'RETIRED' and p_to='RETIRED');
 if not valid then raise exception 'Invalid model lifecycle transition';end if;
 if p_to in('APPROVED_FOR_CANDIDATES','APPROVED_FOR_LIVE') and (
 not exists(select 1 from private.football_model_implementations i where i.model_version=s.id and i.code_commit=s.code_commit and i.config_hash=s.config_hash)
 or not exists(select 1 from private.football_model_attempts p join lateral(select result from private.football_model_outcomes where prediction_id=p.id order by sequence desc limit 1)o on true where p.model_version=s.id and p.status='READY' and o.result in('home','draw','away'))
 or not coalesce(p_evidence @> '{"probabilitySanity":true,"dataQuality":true,"operationalReadiness":true,"prospectiveCalibrationReviewed":true}'::jsonb,false)
 ) then raise exception 'Current implementation, prospective calibration and explicit quality review required';end if;
 perform private.scanner_assert_actor(true);
 perform set_config('docked.model_transition',p_id,true);
 update private.football_model_versions set lifecycle=p_to,changed_at=clock_timestamp() where id=p_id;
 perform set_config('docked.model_transition','',true);
 insert into private.football_model_transitions(model_version,from_state,to_state,actor,reason,config_hash,code_commit,configuration,evidence)
 values(p_id,s.lifecycle,p_to,actor,p_reason,s.config_hash,s.code_commit,s.configuration,p_evidence);
 return p_to;
end $$;

create function private.football_source_guard() returns trigger language plpgsql set search_path='' as $$
declare actor uuid;
begin
 actor:=private.scanner_assert_actor(true);
 if tg_op='DELETE' then raise exception 'Source rights audit retained';end if;
 if tg_op='UPDATE' then
  if old.revoked_at is not null or new.revoked_at is null or new.revoked_at>clock_timestamp()
  or (to_jsonb(old)-'revoked_at') is distinct from(to_jsonb(new)-'revoked_at') then raise exception 'Source approval immutable except revocation';end if;
 elsif new.approved_by is distinct from actor or new.known_at>clock_timestamp() or length(btrim(new.rights_reference))<8 then raise exception 'Current reviewed sporting source required';end if;
 insert into private.audit_events(actor,action,subject,details) values(actor::text,'football_source_review',new.id,jsonb_build_object('revoked',new.revoked_at is not null));
 return new;
end $$;
create trigger football_source_guard before insert or update or delete on private.football_sporting_sources for each row execute function private.football_source_guard();

create function private.football_input_guard() returns trigger language plpgsql set search_path='' as $$
declare e private.events;s private.football_sporting_sources;m jsonb;sid text;actor uuid;checked timestamptz;approval jsonb;
begin
 actor:=private.scanner_assert_actor(true);select * into e from private.events where id=new.event_id for share;
 foreach sid in array new.source_ids loop select * into s from private.football_sporting_sources where id=sid for share;
  if s.id is null or s.revoked_at is not null or s.known_at>new.as_of_time or s.effective_from>new.as_of_time or s.effective_to<=clock_timestamp() then raise exception 'Current dated sporting rights required';end if;
 end loop;
 checked:=clock_timestamp();perform private.scanner_assert_actor(true);
 foreach sid in array new.source_ids loop
  select * into s from private.football_sporting_sources where id=sid;
  if s.revoked_at is not null or s.effective_to<=checked then raise exception 'Sporting authority expired while waiting';end if;
 end loop;
 if e.id is null or e.status<>'scheduled' or e.start_at<=checked or new.created_by is distinct from actor or cardinality(new.source_ids)<1
 or new.as_of_time>checked or new.input_cutoff>new.as_of_time or new.input_hash is distinct from private.football_json_hash(new.payload)
 or not private.football_sport_only(new.payload) or new.payload#>>'{event,eventId}' is distinct from new.event_id
 or new.payload#>>'{event,competitionId}' is distinct from e.competition_id
 or (new.payload#>>'{event,startAt}')::timestamptz is distinct from e.start_at
 or jsonb_typeof(new.payload->'matches') is distinct from 'array' or jsonb_array_length(new.payload->'matches')=0
 or (new.payload->>'asOfTime')::timestamptz is distinct from new.as_of_time
 or new.payload->>'schemaVersion' is distinct from 'football-sporting-input-v1'
 or (new.payload-array['schemaVersion','event','asOfTime','calculatedAt','codeCommit','sourceApprovals','matches','missingRequired','missingOptional'])<>'{}'::jsonb
 or ((new.payload->'event')-array['eventId','competitionId','homeTeamId','awayTeamId','sport','startAt','status','knownAt','sourceId'])<>'{}'::jsonb
 or not coalesce(new.payload#>>'{event,sport}'='football' and new.payload#>>'{event,status}'='scheduled'
 and new.payload#>>'{event,homeTeamId}'<>new.payload#>>'{event,awayTeamId}' and length(new.payload#>>'{event,homeTeamId}')>0 and length(new.payload#>>'{event,awayTeamId}')>0
 and (new.payload#>>'{event,knownAt}')::timestamptz<=new.as_of_time and new.payload#>>'{event,sourceId}'=any(new.source_ids)
 and(new.payload->>'calculatedAt')::timestamptz>=new.as_of_time and(new.payload->>'calculatedAt')::timestamptz<=checked and(new.payload->>'codeCommit')~'^[a-f0-9]{40}$',false)
 or jsonb_typeof(new.payload->'sourceApprovals') is distinct from 'array'
 or jsonb_typeof(new.payload->'missingRequired') is distinct from 'array' or jsonb_array_length(new.payload->'missingRequired')<>0
 or jsonb_typeof(new.payload->'missingOptional') is distinct from 'array'
 or cardinality(new.source_ids)<>(select count(distinct x) from unnest(new.source_ids)x)
 or cardinality(new.source_ids)<>(select count(*) from jsonb_array_elements(new.payload->'sourceApprovals'))
 or (select count(*) from jsonb_array_elements(new.payload->'matches'))<>(select count(distinct x->>'eventId') from jsonb_array_elements(new.payload->'matches')x)
 or (select count(*) from jsonb_array_elements(new.payload->'matches'))<>(select count(distinct x->>'id') from jsonb_array_elements(new.payload->'matches')x)
 then raise exception 'Pre-event sporting-only input evidence required';end if;
 for approval in select * from jsonb_array_elements(new.payload->'sourceApprovals') loop
  select * into s from private.football_sporting_sources where id=approval->>'sourceId';
  if s.id is null or not(s.id=any(new.source_ids)) or approval->>'provider' is distinct from s.provider or approval->>'sourceVersion' is distinct from s.source_version
  or approval->>'rightsReference' is distinct from s.rights_reference or (approval->>'knownAt')::timestamptz is distinct from s.known_at
  or (approval->>'effectiveFrom')::timestamptz is distinct from s.effective_from or (approval->>'effectiveTo')::timestamptz is distinct from s.effective_to
  or not coalesce(approval->'allowedPurposes' @> '["model_training","derived_probabilities","retained_evidence"]'::jsonb,false)
  or (approval-array['sourceId','provider','sourceVersion','rightsReference','allowedPurposes','knownAt','effectiveFrom','effectiveTo'])<>'{}'::jsonb
  then raise exception 'Source approval payload must match reviewed canonical authority';end if;
 end loop;
 for m in select * from jsonb_array_elements(new.payload->'matches') loop
  if m->>'eventId'=e.id or not(m->>'sourceId'=any(new.source_ids)) or m->>'status' is distinct from 'final'
  or not coalesce((m->>'startAt')::timestamptz<(m->>'completedAt')::timestamptz and (m->>'completedAt')::timestamptz<=(m->>'knownAt')::timestamptz
   and (m->>'knownAt')::timestamptz<=(m->>'receivedAt')::timestamptz and (m->>'receivedAt')::timestamptz<=new.input_cutoff,false)
  or m->>'competitionId' is distinct from e.competition_id
  or not coalesce(length(m->>'id')>0 and length(m->>'eventId')>0 and length(m->>'homeTeamId')>0 and length(m->>'awayTeamId')>0 and m->>'homeTeamId'<>m->>'awayTeamId'
   and(m->>'regulationHomeGoals')::integer between 0 and 100 and(m->>'regulationAwayGoals')::integer between 0 and 100 and(m->>'revision')::integer>0,false)
  or(m-array['id','eventId','competitionId','homeTeamId','awayTeamId','startAt','completedAt','knownAt','receivedAt','sourceId','revision','status','regulationHomeGoals','regulationAwayGoals'])<>'{}'::jsonb
  then raise exception 'No look-ahead in sporting results';end if;
 end loop;
 new.created_at:=checked;return new;
end $$;
create trigger football_input_guard before insert on private.football_sporting_inputs for each row execute function private.football_input_guard();

create function private.football_prediction_guard() returns trigger language plpgsql set search_path='' as $$
declare e private.events;v private.football_model_versions;i private.football_sporting_inputs;sid text;checked timestamptz;p numeric;
begin
 perform private.scanner_assert_worker(new.job_id);
 select * into e from private.events where id=new.event_id for share;
 if new.model_version is not null then select * into v from private.football_model_versions where id=new.model_version for share;end if;
 if new.input_snapshot_id is not null then select * into i from private.football_sporting_inputs where id=new.input_snapshot_id for share;end if;
 if new.status='READY' then foreach sid in array coalesce(i.source_ids,'{}') loop perform id from private.football_sporting_sources where id=sid for share;end loop;end if;
 checked:=clock_timestamp();perform private.scanner_assert_worker(new.job_id);
 if e.id is null or e.status<>'scheduled' or e.start_at<=checked or new.as_of_time>checked or new.calculated_at>checked or new.calculated_at<new.as_of_time
 or new.calculated_at<checked-interval '60 seconds' or new.code_commit is distinct from current_setting('docked.scanner_commit',true)
 or (v.id is not null and (v.id<>new.requested_model_version or v.code_commit<>new.code_commit or v.config_hash is distinct from new.config_hash or v.lifecycle not in('RESEARCH','FORWARD_CALIBRATION','APPROVED_FOR_CANDIDATES','APPROVED_FOR_LIVE')))
 then raise exception 'Current pre-event model attempt required';end if;
 if new.status='READY' then
  if v.id is null or i.id is null or i.event_id<>e.id or i.input_hash is distinct from new.input_hash or i.input_cutoff is distinct from new.input_cutoff
   or i.as_of_time>new.as_of_time or i.created_at>new.as_of_time or i.created_at>=checked
   or not exists(select 1 from private.football_model_implementations impl where impl.model_version=v.id and impl.code_commit=new.code_commit and impl.config_hash=new.config_hash)
   or jsonb_typeof(new.probabilities) is distinct from 'object' or (select count(*) from jsonb_object_keys(new.probabilities))<>3
   or not(new.probabilities ?& array['home','draw','away']) then raise exception 'Registered independent estimator and retained sporting input required';end if;
  foreach sid in array i.source_ids loop if not exists(select 1 from private.football_sporting_sources where id=sid and revoked_at is null and effective_from<=new.as_of_time and known_at<=new.as_of_time and effective_to>checked) then raise exception 'Sporting source approval withdrawn';end if;end loop;
  if not coalesce((new.probabilities->>'home')::numeric>=0 and (new.probabilities->>'home')::numeric<=1
   and (new.probabilities->>'draw')::numeric>=0 and (new.probabilities->>'draw')::numeric<=1
   and (new.probabilities->>'away')::numeric>=0 and (new.probabilities->>'away')::numeric<=1
   and (new.probabilities->>'home')::numeric+(new.probabilities->>'draw')::numeric+(new.probabilities->>'away')::numeric=1,false)
  then raise exception 'Complete normalized independent probabilities required';end if;
 end if;
 if new.status='READY' then
  new.fair_odds:=jsonb_build_object('home',1/nullif((new.probabilities->>'home')::numeric,0),'draw',1/nullif((new.probabilities->>'draw')::numeric,0),'away',1/nullif((new.probabilities->>'away')::numeric,0));
 else new.fair_odds:=null;end if;
 new.recorded_xid:=pg_current_xact_id();new.event_start_at:=e.start_at;new.event_participants:=e.participants;new.created_at:=checked;return new;
end $$;
create trigger football_prediction_guard before insert on private.football_model_attempts for each row execute function private.football_prediction_guard();

create function private.football_outcome_guard() returns trigger language plpgsql set search_path='' as $$
declare p private.football_model_attempts;e private.events;s private.football_sporting_sources;latest uuid;actor uuid;
begin
 actor:=private.scanner_assert_actor(true);select * into p from private.football_model_attempts where id=new.prediction_id for update;
 select * into e from private.events where id=p.event_id for share;select * into s from private.football_sporting_sources where id=new.source_id for share;
 select id into latest from private.football_model_outcomes where prediction_id=p.id order by created_at desc,id desc limit 1;
 perform private.scanner_assert_actor(true);
 if p.status is distinct from 'READY' or e.start_at is distinct from p.event_start_at or p.event_start_at>clock_timestamp() or new.observed_at<p.event_start_at or new.observed_at>clock_timestamp()
 or s.id is null or s.revoked_at is not null or s.effective_to<=clock_timestamp() or new.actor is distinct from actor or latest is distinct from new.corrects
 or not private.football_sport_only(new.evidence) then raise exception 'Authorized outcome or linked correction required';end if;
 if new.result in('home','draw','away') and (new.home_goals is null or new.away_goals is null or new.result is distinct from(case when new.home_goals>new.away_goals then 'home' when new.home_goals<new.away_goals then 'away' else 'draw' end)) then raise exception 'Regulation outcome mismatch';end if;
 new.sequence:=coalesce((select max(sequence)+1 from private.football_model_outcomes where prediction_id=p.id),1);
 new.created_at:=clock_timestamp();return new;
end $$;
create trigger football_outcome_guard before insert on private.football_model_outcomes for each row execute function private.football_outcome_guard();

do $$declare n text;begin
 foreach n in array array['football_model_versions','football_model_transitions','football_model_implementations','football_sporting_sources','football_sporting_inputs','football_model_attempts','football_model_outcomes','football_edge_policy_approvals','official_record_boundary','official_docked_publications'] loop
  execute format('alter table private.%I enable row level security',n);
  execute format('revoke all on private.%I from public,anon,authenticated,docked_app',n);
  if n not in('football_model_versions','football_sporting_sources','football_edge_policy_approvals') then
   execute format('create trigger immutable before update or delete on private.%I for each row execute function private.immutable()',n);
  end if;
 end loop;
end $$;
revoke all on function private.football_json_hash(jsonb),private.football_sport_only(jsonb),private.football_version_guard(),private.transition_football_model(text,text,text,jsonb),private.football_source_guard(),private.football_input_guard(),private.football_prediction_guard(),private.football_outcome_guard() from public,anon,authenticated,docked_app;

create function private.football_implementation_guard() returns trigger language plpgsql set search_path='' as $$
declare v private.football_model_versions;a uuid;
begin
 a:=private.scanner_assert_actor(true);select * into v from private.football_model_versions where id=new.model_version for share;
 if new.reviewed_by is distinct from a or v.config_hash is distinct from new.config_hash or v.code_commit is distinct from new.code_commit
 or v.configuration->>'trainingDataHash' is distinct from new.training_data_hash or v.configuration->'parameters' is null or v.configuration->'parameters'='null'::jsonb
 or v.lifecycle not in('RESEARCH','FORWARD_CALIBRATION') then raise exception 'A separately reviewed fitted implementation and real sporting dataset are required';end if;
 new.created_at:=clock_timestamp();return new;
end $$;
create trigger football_implementation_guard before insert on private.football_model_implementations for each row execute function private.football_implementation_guard();

create function private.football_strategy_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and old.config->>'method'='football-independent-model' and (new.config is distinct from old.config or new.config_hash is distinct from old.config_hash or new.code_commit is distinct from old.code_commit or new.football_model_version is distinct from old.football_model_version) then raise exception 'Material football policy changes require a new version';end if;
 if new.config->>'method'='football-independent-model' then
  new.football_model_version:=new.config->>'modelVersion';
  if new.football_model_version is null or new.config->>'version' is distinct from new.id
  or not coalesce(new.config->>'maxEdgesPerEvent'='1' and (new.config->>'stakeUnits')::numeric=1 and (new.config->>'minEV')::numeric>=0.03
  and (new.config->>'minOdds')::numeric>=1.5 and (new.config->>'maxOdds')::numeric<=5 and (new.config->>'maxEV')::numeric<=0.20
  and (new.config->>'maxAgeSeconds')::integer between 1 and 180 and (new.config->>'safetySeconds')::integer>=600
  and (new.config->>'maxSportDataAgeSeconds')::integer between 1 and 604800,false) then raise exception 'Versioned bounded football strategy required';end if;
 elsif new.football_model_version is not null then raise exception 'Model binding requires independent football strategy';end if;
 return new;
end $$;
create trigger football_strategy_guard before insert or update on private.strategy_versions for each row execute function private.football_strategy_guard();
create function private.football_policy_guard() returns trigger language plpgsql set search_path='' as $$
declare s private.strategy_versions;v private.football_model_versions;a uuid;
begin
 a:=private.scanner_assert_actor(true);
 if tg_op='DELETE' then raise exception 'Policy approval history retained';end if;
 if tg_op='UPDATE' then
  if old.revoked_at is not null or new.revoked_at is null or new.revoked_at>clock_timestamp() or (to_jsonb(new)-'revoked_at') is distinct from(to_jsonb(old)-'revoked_at') then raise exception 'Approval immutable except withdrawal';end if;
 else
  select * into s from private.strategy_versions where id=new.strategy_id for share;select * into v from private.football_model_versions where id=new.model_version for share;
  if new.actor is distinct from a or s.football_model_version is distinct from v.id or s.config_hash is distinct from new.config_hash or s.code_commit is distinct from new.code_commit or v.code_commit is distinct from new.code_commit
  or v.lifecycle not in('RESEARCH','FORWARD_CALIBRATION','APPROVED_FOR_CANDIDATES','APPROVED_FOR_LIVE') then raise exception 'Current independent model policy review required';end if;
  new.created_at:=clock_timestamp();
 end if;
 perform private.scanner_assert_actor(true);insert into private.audit_events(actor,action,subject,details) values(a::text,'football_edge_policy_review',new.strategy_id,jsonb_build_object('reason',new.reason,'withdrawn',new.revoked_at is not null));return new;
end $$;
create trigger football_policy_guard before insert or update or delete on private.football_edge_policy_approvals for each row execute function private.football_policy_guard();
create function private.set_football_policy_active(p_strategy text,p_active boolean,p_reason text) returns boolean language plpgsql set search_path='' as $$
declare s private.strategy_versions;a uuid;
begin
 a:=private.scanner_assert_actor(true);select * into s from private.strategy_versions where id=p_strategy for update;
 if s.config->>'method' is distinct from 'football-independent-model' or p_active is null or not coalesce(length(btrim(p_reason))>=12,false) then raise exception 'Explicit independent policy activation review required';end if;
 if p_active and not exists(select 1 from private.football_edge_policy_approvals approval join private.football_model_versions v on v.id=approval.model_version where approval.strategy_id=s.id and approval.revoked_at is null and approval.config_hash=s.config_hash and approval.code_commit=s.code_commit and v.code_commit=s.code_commit and v.lifecycle in('RESEARCH','FORWARD_CALIBRATION','APPROVED_FOR_CANDIDATES','APPROVED_FOR_LIVE')) then raise exception 'Current reviewed model policy required';end if;
 perform private.scanner_assert_actor(true);perform set_config('docked.strategy_transition',s.id,true);
 update private.strategy_versions set active=p_active where id=s.id;perform set_config('docked.strategy_transition','',true);
 insert into private.audit_events(actor,action,subject,details)values(a::text,'football_policy_activation',s.id,jsonb_build_object('active',p_active,'reason',p_reason,'configHash',s.config_hash));return p_active;
end $$;

create function private.assert_football_prediction(p_id uuid) returns void language plpgsql set search_path='' as $$
declare p private.football_model_attempts;v private.football_model_versions;i private.football_sporting_inputs;e private.events;s private.football_sporting_sources;sid text;checked timestamptz;
begin
 select * into p from private.football_model_attempts where id=p_id for share;select * into v from private.football_model_versions where id=p.model_version for share;
 select * into i from private.football_sporting_inputs where id=p.input_snapshot_id for share;select * into e from private.events where id=p.event_id for share;
 foreach sid in array coalesce(i.source_ids,'{}') loop perform id from private.football_sporting_sources where id=sid for share;end loop;
 checked:=clock_timestamp();
 if p.status is distinct from 'READY' or v.lifecycle not in('FORWARD_CALIBRATION','APPROVED_FOR_CANDIDATES','APPROVED_FOR_LIVE')
 or pg_xact_status(p.recorded_xid) is distinct from 'committed'
 or e.status is distinct from 'scheduled' or e.start_at is distinct from p.event_start_at or e.participants is distinct from p.event_participants or e.start_at<=checked or p.created_at>=checked or p.created_at>=p.event_start_at or p.config_hash is distinct from v.config_hash or p.code_commit is distinct from v.code_commit
 or not exists(select 1 from private.football_model_implementations x where x.model_version=v.id and x.config_hash=p.config_hash and x.code_commit=p.code_commit)
 then raise exception 'Current independently retained prospective prediction required';end if;
 foreach sid in array i.source_ids loop select * into s from private.football_sporting_sources where id=sid;
  if s.id is null or s.revoked_at is not null or s.effective_to<=checked or s.effective_from>p.as_of_time or s.known_at>p.as_of_time then raise exception 'Sporting source authority withdrawn';end if;
 end loop;
end $$;

-- Preserve the old research/paper strategy path; live authority is now independent-model only.
do $$declare definition text;begin
 select pg_get_functiondef('private.scanner_strategy_allowed(text,text)'::regprocedure) into definition;
 execute replace(definition,'FUNCTION private.scanner_strategy_allowed(','FUNCTION private.legacy_scanner_strategy_allowed(');
end $$;
create or replace function private.scanner_strategy_allowed(p_strategy text,p_purpose text) returns boolean language sql stable set search_path='' as $$
 select coalesce((select case when s.config->>'method'='football-independent-model' then s.active and exists(
 select 1 from private.football_model_versions v join private.football_edge_policy_approvals a on a.model_version=v.id
 where a.strategy_id=s.id and a.revoked_at is null and a.config_hash=s.config_hash and a.code_commit=s.code_commit and v.code_commit=s.code_commit
 and case p_purpose when 'research' then v.lifecycle in('RESEARCH','FORWARD_CALIBRATION','APPROVED_FOR_CANDIDATES','APPROVED_FOR_LIVE') when 'paper' then v.lifecycle in('APPROVED_FOR_CANDIDATES','APPROVED_FOR_LIVE') when 'live' then v.lifecycle='APPROVED_FOR_LIVE' else false end)
 else p_purpose<>'live' and private.legacy_scanner_strategy_allowed(p_strategy,p_purpose) end from private.strategy_versions s where s.id=p_strategy),false)
$$;
create function private.assert_football_comparison(p_prediction uuid,p_strategy text,p_reference uuid,p_purpose text,p_selection text) returns numeric language plpgsql set search_path='' as $$
declare p private.football_model_attempts;s private.strategy_versions;r private.market_references;e private.events;policy private.region_policies;v numeric;checked timestamptz;
begin
 select * into s from private.strategy_versions where id=p_strategy for share;select * into r from private.market_references where id=p_reference for share;
 select * into p from private.football_model_attempts where id=p_prediction for share;select * into e from private.events where id=p.event_id for share;
 select * into policy from private.region_policies where id=r.region_policy_id for share;
 perform private.assert_football_prediction(p.id);perform private.assert_current_market_reference(r.id);checked:=clock_timestamp();
 if not private.scanner_strategy_allowed(s.id,p_purpose) or s.config->>'method' is distinct from 'football-independent-model' or p.model_version is distinct from s.football_model_version
 or p.code_commit is distinct from s.code_commit or s.code_commit is distinct from current_setting('docked.scanner_commit',true)
 or r.configuration is distinct from s.config->'marketReference' or r.selection is distinct from p_selection
 or not exists(select 1 from private.markets m where m.id=r.market_id and m.event_id=p.event_id and m.rules->>'market'='football_1x2')
 or r.observed_at<p.created_at or checked-p.input_cutoff>(s.config->>'maxSportDataAgeSeconds')::integer*interval '1 second'
 or e.start_at<=checked+greatest(600,(s.config->>'safetySeconds')::integer)*interval '1 second'
 or not coalesce(policy.approved and not policy.preview_community_only and policy.effective_from<=checked and least(policy.effective_to,policy.review_at)>checked and(case when p_purpose='research' then 'market_data' else 'tips' end)=any(policy.features),false)
 then raise exception 'Fresh independent prediction, availability reference and current authority required';end if;
 v:=case when p_selection=e.participants->>0 then(p.probabilities->>'home')::numeric when p_selection='Draw' then(p.probabilities->>'draw')::numeric when p_selection=e.participants->>1 then(p.probabilities->>'away')::numeric else null end;
 if v is null or v<=0 or v>=1 then raise exception 'Selected boundary probability is not an eligible price comparison';end if;
 if r.decimal_price<ceil((1+(s.config->>'minEV')::numeric)/v*100)/100 or r.decimal_price<(s.config->>'minOdds')::numeric or r.decimal_price>(s.config->>'maxOdds')::numeric or v*r.decimal_price-1>(s.config->>'maxEV')::numeric then raise exception 'Independent probability comparison no longer qualifies';end if;
 return v;
end $$;
create function private.football_candidate_check(n private.scanner_candidates) returns private.scanner_candidates language plpgsql set search_path='' as $$
declare run private.scanner_runs;s private.strategy_versions;p private.football_model_attempts;r private.market_references;e private.events;v numeric;
begin
 select * into run from private.scanner_runs where id=n.run_id for share;perform private.scanner_assert_worker(run.job_id);
 select * into s from private.strategy_versions where id=n.strategy_id for share;select * into p from private.football_model_attempts where id=n.prediction_id for share;select * into r from private.market_references where id=n.market_reference_id for share;select * into e from private.events where id=n.event_id for share;
 v:=private.assert_football_comparison(p.id,s.id,r.id,n.purpose,n.selection);perform private.scanner_assert_worker(run.job_id);
 if run.status is distinct from 'RUNNING' or run.strategy_id is distinct from s.id or run.purpose is distinct from n.purpose or run.region_policy_id is distinct from n.region_policy_id
 or p.event_id is distinct from n.event_id or n.market_id is distinct from r.market_id or n.region_policy_id is distinct from r.region_policy_id
 or n.strategy_hash is distinct from s.config_hash or n.code_commit is distinct from s.code_commit or n.model_version is distinct from p.model_version
 or n.model_evidence->>'predictionId' is distinct from p.id::text or n.model_evidence->>'inputHash' is distinct from p.input_hash or n.model_evidence->'probabilities' is distinct from p.probabilities
 or n.probability is distinct from v or abs(n.fair_odds-1/v)>0.00000001 or n.required_ev is distinct from(s.config->>'minEV')::numeric or n.minimum_odds is distinct from ceil((1+n.required_ev)/v*100)/100 or abs(n.estimated_ev-(v*r.decimal_price-1))>0.00000001
 or n.scanned_at is distinct from r.observed_at or n.scanned_at>clock_timestamp() or n.expires_at<=clock_timestamp() or n.expires_at>least((r.reference->>'sourceAt')::timestamptz+least(180,(s.config->>'maxAgeSeconds')::int)*interval '1 second',e.start_at-greatest(600,(s.config->>'safetySeconds')::int)*interval '1 second',n.scanned_at+interval '120 seconds')
 or not(s.config->'competitions' ? e.competition_id) or not(s.config->'windowsSeconds' @> to_jsonb(n.window_seconds)) or p.window_seconds<>n.window_seconds
 or extract(epoch from(e.start_at-n.scanned_at))>n.window_seconds or extract(epoch from(e.start_at-n.scanned_at))<n.window_seconds-(s.config->>'windowToleranceSeconds')::int
 then raise exception 'Immutable independent candidate linkage required';end if;
 n.created_at:=clock_timestamp();return n;
end $$;
do $$declare definition text;begin
 select pg_get_functiondef('private.scanner_candidate_guard()'::regprocedure) into definition;
 definition:=replace(definition,E'begin\n',E'begin\n if new.prediction_id is not null then return private.football_candidate_check(new);end if;\n');execute definition;
end $$;

alter table private.tip_publications drop constraint tip_publications_pricing_model_check;
alter table private.tip_publications add constraint tip_publications_pricing_model_check check(pricing_model in('legacy_bookmaker_v1','market_reference_v1','football_independent_v1'));
alter table private.tip_publications drop constraint publication_benchmark_version;
alter table private.tip_publications add constraint publication_benchmark_version check((pricing_model='legacy_bookmaker_v1' and market_reference_id is null and prediction_id is null) or(pricing_model='market_reference_v1' and market_reference_id is not null and prediction_id is null) or(pricing_model='football_independent_v1' and market_reference_id is not null and prediction_id is not null));
drop trigger publication_guard on private.tip_publications;
create trigger publication_guard before insert on private.tip_publications for each row when(new.pricing_model<>'football_independent_v1') execute function private.publication_guard();
create function private.football_publication_guard() returns trigger language plpgsql set search_path='' as $$
declare c private.candidate_decisions;s private.strategy_versions;p private.football_model_attempts;r private.market_references;m private.markets;v numeric;a uuid;
begin
 if new.evidence='live_published' and new.pricing_model<>'football_independent_v1' then raise exception 'Official record accepts new independent-model publications only';end if;
 if new.pricing_model<>'football_independent_v1' then return new;end if;
 a:=private.scanner_assert_actor(false);if new.evidence='live_published' then perform pg_advisory_xact_lock(hashtext('official-football-record'));end if;select * into c from private.candidate_decisions where id=new.candidate_id for update;
 select * into s from private.strategy_versions where id=new.strategy_id for share;select * into p from private.football_model_attempts where id=new.prediction_id for share;select * into r from private.market_references where id=new.market_reference_id for share;select * into m from private.markets where id=r.market_id for share;
 v:=private.assert_football_comparison(p.id,s.id,r.id,case when new.evidence='live_published' then 'live' else 'paper' end,new.selection);
 perform private.scanner_assert_actor(false);
 if new.evidence not in('live_published','forward_paper') or new.approved_by is distinct from a or c.status is distinct from 'review' or c.event_id is distinct from p.event_id or c.strategy_id is distinct from s.id or new.event_id is distinct from p.event_id
 or c.payload->>'predictionId' is distinct from p.id::text or c.payload->>'referenceId' is distinct from r.id::text
 or new.config_hash is distinct from s.config_hash or new.region_policy_id is distinct from r.region_policy_id or new.market_rules is distinct from m.rules
 or new.probability is distinct from v or new.odds is distinct from r.decimal_price or new.minimum_odds is distinct from ceil((1+(s.config->>'minEV')::numeric)/v*100)/100 or abs(new.estimated_ev-(v*r.decimal_price-1))>0.00000001 or new.benchmark_stake<>1
 or new.publication_payload->'reference' is distinct from r.reference or new.publication_payload#>>'{modelEvidence,predictionId}' is distinct from p.id::text
 or not coalesce((select enabled from private.feature_flags where key=case when new.evidence='live_published' then 'publication' else 'forward_paper' end),false)
 then raise exception 'Canonical prospective independent publication required';end if;
 new.published_at:=clock_timestamp();return new;
end $$;
create trigger aa_football_publication_guard before insert on private.tip_publications for each row execute function private.football_publication_guard();

create function private.official_record_insert_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if pg_trigger_depth()<2 or current_setting('docked.official_publication',true) is distinct from(case when tg_table_name='official_record_boundary' then to_jsonb(new)->>'first_tip_id' else to_jsonb(new)->>'tip_id' end) then raise exception 'Official record can only originate at canonical live insertion';end if;
 return new;
end $$;
create trigger official_record_insert_guard before insert on private.official_record_boundary for each row execute function private.official_record_insert_guard();
create trigger official_record_insert_guard before insert on private.official_docked_publications for each row execute function private.official_record_insert_guard();
create function private.record_official_football() returns trigger language plpgsql set search_path='' as $$
declare version text;
begin
 if new.evidence='live_published' then
  perform pg_advisory_xact_lock(hashtext('official-football-record'));
  select model_version into version from private.football_model_attempts where id=new.prediction_id;
  if version is null or new.pricing_model<>'football_independent_v1' then raise exception 'Independent publication lineage required';end if;
  perform set_config('docked.official_publication',new.id::text,true);
  insert into private.official_record_boundary(singleton,first_tip_id,started_at,actor) values(true,new.id,new.published_at,new.approved_by) on conflict do nothing;
  insert into private.official_docked_publications(tip_id,event_id,prediction_id,model_version,published_at) values(new.id,new.event_id,new.prediction_id,version,new.published_at);
  perform set_config('docked.official_publication','',true);
 end if;return new;
end $$;
create trigger record_official_football after insert on private.tip_publications for each row execute function private.record_official_football();
create function private.publish_football_candidate(p_id uuid,p_reference uuid default null) returns uuid language plpgsql set search_path='' as $$
declare c private.scanner_candidates;s private.strategy_versions;p private.football_model_attempts;r private.market_references;m private.markets;a uuid;v numeric;decision uuid;publication uuid;purpose public.evidence_type;
begin
 a:=private.scanner_assert_actor(false);select * into c from private.scanner_candidates where id=p_id for update;
 if c.prediction_id is null or c.purpose not in('paper','live') or c.expires_at<=clock_timestamp() or exists(select 1 from private.scanner_reviews where candidate_id=c.id and status in('APPROVED','REJECTED','EXPIRED','INVALIDATED')) then raise exception 'Unexpired independent publication candidate required';end if;
 select * into s from private.strategy_versions where id=c.strategy_id for share;select * into p from private.football_model_attempts where id=c.prediction_id for share;select * into r from private.market_references where id=coalesce(p_reference,c.market_reference_id) for share;select * into m from private.markets where id=r.market_id for share;
 v:=private.assert_football_comparison(p.id,s.id,r.id,c.purpose,c.selection);
 if r.market_id is distinct from c.market_id or r.region_policy_id is distinct from c.region_policy_id or s.config_hash is distinct from c.strategy_hash then raise exception 'Candidate cannot change its event, region or strategy';end if;
 purpose:=case when c.purpose='live' then 'live_published'::public.evidence_type else 'forward_paper'::public.evidence_type end;
 insert into private.candidate_decisions(event_id,strategy_id,decision_at,window_seconds,payload,rejection_reasons,status) values(c.event_id,c.strategy_id,clock_timestamp(),c.window_seconds,jsonb_build_object('predictionId',p.id,'referenceId',r.id,'scannerCandidateId',c.id),'{}','review') returning id into decision;
 insert into private.tip_publications(candidate_id,event_id,strategy_id,evidence,selection,market_rules,probability,odds,minimum_odds,estimated_ev,config_hash,sources,publication_payload,approved_by,region_policy_id,pricing_model,market_reference_id,prediction_id)
 values(decision,c.event_id,s.id,purpose,c.selection,m.rules,v,r.decimal_price,ceil((1+(s.config->>'minEV')::numeric)/v*100)/100,v*r.decimal_price-1,s.config_hash,'[]',jsonb_build_object('pricingModel','football_independent_v1','marketId',m.id,'reference',r.reference,'referenceConfig',s.config->'marketReference','fairOdds',1/v,'modelEvidence',jsonb_build_object('id',p.id,'predictionId',p.id,'modelVersion',p.model_version,'configHash',p.config_hash,'inputHash',p.input_hash,'dataCutoff',p.input_cutoff,'asOfTime',p.as_of_time,'calculatedAt',p.calculated_at,'codeCommit',p.code_commit,'probabilities',p.probabilities),'offer',jsonb_build_object('bookmaker','Market reference','sourceAt',r.reference->>'sourceAt')),a,r.region_policy_id,'football_independent_v1',r.id,p.id) returning id into publication;
 update private.candidate_decisions set status='published' where id=decision;return publication;
end $$;

-- Independent candidate review preserves the complete retained vector and cannot substitute a price-derived probability.
create function private.football_review_check(n private.scanner_reviews) returns private.scanner_reviews language plpgsql set search_path='' as $$
declare c private.scanner_candidates;r private.market_references;a uuid;v numeric;
begin
 select * into c from private.scanner_candidates where id=n.candidate_id for update;
 if exists(select 1 from private.scanner_reviews where candidate_id=c.id and status in('APPROVED','REJECTED','EXPIRED','INVALIDATED')) then raise exception 'Candidate is final';end if;
 if n.status in('EXPIRED','INVALIDATED') and current_setting('docked.scanner_scheduler',true)='true' then n.actor:=null;else a:=private.scanner_assert_actor(false);if n.actor is distinct from a then raise exception 'Review actor mismatch';end if;end if;
 if n.status='APPROVED' then
  if c.expires_at<=clock_timestamp() then raise exception 'Candidate expired';end if;
  select * into r from private.market_references where id=n.market_reference_id for share;v:=private.assert_football_comparison(c.prediction_id,c.strategy_id,r.id,c.purpose,c.selection);perform private.scanner_assert_actor(false);
  if r.market_id is distinct from c.market_id or r.region_policy_id is distinct from c.region_policy_id then raise exception 'Candidate reference mismatch';end if;
  if c.purpose='research' and n.publication_id is not null then raise exception 'Research cannot publish';end if;
  if c.purpose<>'research' and not exists(select 1 from private.tip_publications t where t.id=n.publication_id and t.prediction_id=c.prediction_id and t.market_reference_id=r.id and t.approved_by=a and t.strategy_id=c.strategy_id and t.evidence::text=case when c.purpose='live' then 'live_published' else 'forward_paper' end) then raise exception 'Canonical publication required';end if;
  n.evidence:=jsonb_build_object('predictionId',c.prediction_id,'referenceId',r.id,'probability',v,'purpose',c.purpose);
 elsif n.publication_id is not null then raise exception 'Only approval can publish';end if;
 n.created_at:=clock_timestamp();insert into private.audit_events(actor,action,subject,details) values(coalesce(n.actor::text,'scanner'),'football_candidate_review',c.id::text,jsonb_build_object('status',n.status,'reason',n.reason));return n;
end $$;
do $$declare definition text;begin
 select pg_get_functiondef('private.scanner_review_guard()'::regprocedure) into definition;
 definition:=replace(definition,E'begin\n',E'begin\n if exists(select 1 from private.scanner_candidates where id=new.candidate_id and prediction_id is not null) then return private.football_review_check(new);end if;\n');execute definition;
end $$;
-- Fixed private privileges; this migration never broadens browser or community runtime permissions.
do $$declare f record;begin for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and (p.proname like 'football_%' or p.proname like '%_football_%' or p.proname in('official_record_insert_guard','legacy_scanner_strategy_allowed','record_official_football')) loop execute format('revoke all on function %s from public,anon,authenticated,docked_app',f.signature);end loop;end $$;

grant select on private.official_docked_publications,private.official_record_boundary to docked_app;
create policy runtime_official_read on private.official_docked_publications for select to docked_app using(true);
create policy runtime_official_boundary_read on private.official_record_boundary for select to docked_app using(true);
grant select(model_version,to_state,created_at,id) on private.football_model_transitions to docked_app;
create policy runtime_model_changelog_read on private.football_model_transitions for select to docked_app using(true);

-- Reuse existing terminal/no-reactivation movement logic and add independent authority checks.
do $$declare definition text;begin
 select pg_get_functiondef('private.reference_movement_guard()'::regprocedure) into definition;
 definition:=replace(definition,'p.pricing_model<>''market_reference_v1''','p.pricing_model not in(''market_reference_v1'',''football_independent_v1'')');
 definition:=replace(definition,'new.observed_at:=clock_timestamp();', $fragment$
 if p.pricing_model='football_independent_v1' and new.status in('ACTIVE','PRICE BELOW MINIMUM') then
  perform private.assert_football_prediction(p.prediction_id);
  if not private.scanner_strategy_allowed(p.strategy_id,case when p.evidence='live_published' then 'live' else 'paper' end)
  or not exists(select 1 from private.strategy_versions s join private.football_model_attempts prediction on prediction.id=p.prediction_id
   join private.region_policies region on region.id=p.region_policy_id where s.id=p.strategy_id
   and s.code_commit=current_setting('docked.scanner_commit',true) and s.config_hash=p.config_hash
   and clock_timestamp()-prediction.input_cutoff<=(s.config->>'maxSportDataAgeSeconds')::integer*interval '1 second'
   and region.approved and not region.preview_community_only and region.effective_from<=clock_timestamp() and least(region.effective_to,region.review_at)>clock_timestamp() and 'tips'=any(region.features)
   and (new.status<>'ACTIVE' or(ref.decimal_price<=(s.config->>'maxOdds')::numeric and p.probability*ref.decimal_price-1<=(s.config->>'maxEV')::numeric)))
  then raise exception 'Independent publication authority withdrawn';end if;
 end if;
 new.observed_at:=clock_timestamp();$fragment$);
 execute definition;
end $$;
