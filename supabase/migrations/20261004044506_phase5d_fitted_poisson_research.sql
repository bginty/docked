-- Retained research fit. No source/model/schedule/publication activation or seed data.
create table private.football_training_manifests (
 id uuid primary key default gen_random_uuid(),
 model_version text not null unique references private.football_model_versions(id),
 training jsonb not null, training_hash text not null check(training_hash ~ '^[a-f0-9]{64}$'),
 manifest jsonb not null, manifest_hash text not null check(manifest_hash ~ '^[a-f0-9]{64}$'),
 fitted jsonb not null, fitted_hash text not null check(fitted_hash ~ '^[a-f0-9]{64}$'),
 source_ids text[] not null, code_commit text not null check(code_commit ~ '^[a-f0-9]{40}$'),
 input_cutoff timestamptz not null, fitted_at timestamptz not null,
 actor uuid not null, created_at timestamptz not null default clock_timestamp()
);
alter table private.football_training_manifests enable row level security;
revoke all on private.football_training_manifests from public,anon,authenticated,docked_app;
create trigger immutable before update or delete on private.football_training_manifests for each row execute function private.immutable();

create function private.football_training_guard() returns trigger language plpgsql set search_path='' as $$
declare v private.football_model_versions;s private.football_sporting_sources;m jsonb;sid text;checked timestamptz;
begin
 perform private.scanner_assert_actor(true);
 select * into v from private.football_model_versions where id=new.model_version for share;
 foreach sid in array new.source_ids loop
  select * into s from private.football_sporting_sources where id=sid for share;
  if s.id is null or s.revoked_at is not null or s.known_at>new.fitted_at or s.effective_from>new.fitted_at or s.effective_to<=clock_timestamp() then raise exception 'Current training rights required';end if;
 end loop;
 checked:=clock_timestamp();
 if new.actor is distinct from private.scanner_assert_actor(true) or v.id is null or v.lifecycle not in('RESEARCH','FORWARD_CALIBRATION')
 or v.code_commit is distinct from new.code_commit or new.fitted_at>checked or new.input_cutoff>new.fitted_at
 or cardinality(new.source_ids)<1 or cardinality(new.source_ids)<>(select count(distinct x) from unnest(new.source_ids)x)
 or new.training_hash is distinct from private.football_json_hash(new.training)
 or new.manifest_hash is distinct from private.football_json_hash(new.manifest)
 or new.fitted_hash is distinct from private.football_json_hash(new.fitted)
 or v.configuration->>'trainingDataHash' is distinct from new.training_hash
 or v.configuration->'parameters' is distinct from new.fitted->'parameters'
 or v.configuration->>'fittedHash' is distinct from new.fitted_hash
 or new.fitted->>'trainingHash' is distinct from new.training_hash
 or new.fitted->>'configHash' is distinct from private.football_json_hash(new.fitted->'config')
 or new.fitted#>>'{diagnostics,converged}' is distinct from 'true'
 or new.training->>'schemaVersion' is distinct from 'epl-poisson-training-v1'
 or new.training->>'competitionId' is distinct from 'soccer_epl'
 or (new.training->>'asOfTime')::timestamptz>new.fitted_at
 or (new.training->>'asOfTime')::timestamptz<new.input_cutoff
 or (new.fitted->>'asOfTime')::timestamptz is distinct from (new.training->>'asOfTime')::timestamptz
 or (new.training-array['schemaVersion','competitionId','asOfTime','matches'])<>'{}'::jsonb
 or not private.football_sport_only(new.training)
 or jsonb_typeof(new.training->'matches') is distinct from 'array'
 or jsonb_array_length(new.training->'matches')<20
 or jsonb_typeof(new.manifest->'canonicalAliases') is distinct from 'object'
 or new.manifest->>'mappingVersion' is null
 then raise exception 'Bound reviewed training manifest required';end if;
 if jsonb_array_length(new.training->'matches')<>(select count(distinct x->>'id') from jsonb_array_elements(new.training->'matches')x) then raise exception 'Duplicate training match';end if;
 if new.input_cutoff is distinct from(select max((x->>'observedAt')::timestamptz) from jsonb_array_elements(new.training->'matches')x) then raise exception 'Actual source observation cutoff required';end if;
 for m in select * from jsonb_array_elements(new.training->'matches') loop
  if (m-array['id','home','away','date','homeGoals','awayGoals','observedAt','sourceId'])<>'{}'::jsonb
  or not coalesce(length(m->>'id')>0 and length(m->>'home')>0 and length(m->>'away')>0 and m->>'home'<>m->>'away'
   and(m->>'homeGoals')~'^[0-9]+$' and(m->>'awayGoals')~'^[0-9]+$'
   and(m->>'homeGoals')::integer between 0 and 100 and(m->>'awayGoals')::integer between 0 and 100
   and(m->>'date')::date<substring(m->>'observedAt',1,10)::date
   and(m->>'observedAt')::timestamptz<=new.input_cutoff and m->>'sourceId'=any(new.source_ids),false)
  then raise exception 'Dated sporting-only training evidence required';end if;
 end loop;
 new.created_at:=checked;return new;
end $$;
create trigger football_training_guard before insert on private.football_training_manifests for each row execute function private.football_training_guard();

-- Preserve the original schema's full validation. The new schema records date-only
-- training provenance without inventing exact historical completion timestamps.
drop trigger football_input_guard on private.football_sporting_inputs;
create trigger football_input_guard before insert on private.football_sporting_inputs for each row
 when(new.payload->>'schemaVersion' is distinct from 'football-fitted-input-v1') execute function private.football_input_guard();
create function private.football_fitted_input_guard() returns trigger language plpgsql set search_path='' as $$
declare e private.events;t private.football_training_manifests;s private.football_sporting_sources;sid text;checked timestamptz;
begin
 perform private.scanner_assert_actor(true);
 select * into e from private.events where id=new.event_id for share;
 select * into t from private.football_training_manifests where id=(new.payload->>'manifestId')::uuid for share;
 foreach sid in array new.source_ids loop
  select * into s from private.football_sporting_sources where id=sid for share;
  if s.id is null or s.revoked_at is not null or s.known_at>new.as_of_time or s.effective_from>new.as_of_time or s.effective_to<=clock_timestamp() then raise exception 'Current sporting rights required';end if;
 end loop;
 checked:=clock_timestamp();
 if new.created_by is distinct from private.scanner_assert_actor(true) or e.id is null or e.competition_id<>'soccer_epl'
 or e.status<>'scheduled' or e.start_at<=checked or t.id is null or t.created_at>new.as_of_time
 or new.as_of_time>checked or new.input_cutoff is distinct from t.input_cutoff or new.input_cutoff>new.as_of_time
 or new.source_ids is distinct from t.source_ids or new.input_hash is distinct from private.football_json_hash(new.payload)
 or not private.football_sport_only(new.payload)
 or(new.payload-array['schemaVersion','event','asOfTime','calculatedAt','codeCommit','manifestId','modelVersion','mappingVersion','missingRequired','missingOptional'])<>'{}'::jsonb
 or((new.payload->'event')-array['eventId','competitionId','homeTeamId','awayTeamId','sport','startAt','status','knownAt','sourceId'])<>'{}'::jsonb
 or new.payload->>'modelVersion' is distinct from t.model_version
 or new.payload->>'codeCommit' is distinct from t.code_commit
 or new.payload->>'mappingVersion' is distinct from t.manifest->>'mappingVersion'
 or new.payload#>>'{event,eventId}' is distinct from e.id
 or new.payload#>>'{event,competitionId}' is distinct from e.competition_id
 or new.payload#>>'{event,sport}' is distinct from 'football' or new.payload#>>'{event,status}' is distinct from 'scheduled'
 or new.payload#>>'{event,homeTeamId}' is distinct from t.manifest->'canonicalAliases'->>(e.participants->>0)
 or new.payload#>>'{event,awayTeamId}' is distinct from t.manifest->'canonicalAliases'->>(e.participants->>1)
 or not coalesce(length(new.payload#>>'{event,homeTeamId}')>0 and length(new.payload#>>'{event,awayTeamId}')>0
 and new.payload#>>'{event,homeTeamId}'<>new.payload#>>'{event,awayTeamId}'
 and (new.payload#>>'{event,knownAt}')::timestamptz<=new.as_of_time
 and length(new.payload#>>'{event,sourceId}')>0
 and(new.payload#>>'{event,startAt}')::timestamptz=e.start_at
 and(new.payload->>'asOfTime')::timestamptz=new.as_of_time
 and(new.payload->>'calculatedAt')::timestamptz between new.as_of_time and checked,false)
 or new.payload->'missingRequired' is distinct from '[]'::jsonb
 or jsonb_typeof(new.payload->'missingOptional') is distinct from 'array'
 then raise exception 'Current mapped fitted-model input required';end if;
 new.created_at:=checked;return new;
end $$;
create trigger football_fitted_input_guard before insert on private.football_sporting_inputs for each row
 when(new.payload->>'schemaVersion'='football-fitted-input-v1') execute function private.football_fitted_input_guard();
revoke all on function private.football_training_guard(),private.football_fitted_input_guard() from public,anon,authenticated,docked_app;

create function private.football_fitted_prediction_binding() returns trigger language plpgsql set search_path='' as $$
declare i private.football_sporting_inputs;t private.football_training_manifests;
begin
 if new.status='READY' then
  select * into i from private.football_sporting_inputs where id=new.input_snapshot_id;
  if i.payload->>'schemaVersion'='football-fitted-input-v1' then
   select * into t from private.football_training_manifests where id=(i.payload->>'manifestId')::uuid;
   if t.id is null or new.model_version is distinct from t.model_version or new.code_commit is distinct from t.code_commit
   then raise exception 'Prediction must use its retained fitted revision';end if;
  end if;
 end if;
 return new;
end $$;
create trigger football_fitted_prediction_binding before insert on private.football_model_attempts for each row execute function private.football_fitted_prediction_binding();
revoke all on function private.football_fitted_prediction_binding() from public,anon,authenticated,docked_app;

-- Statistical training permission never implies authoritative settlement permission.
create function private.football_outcome_authority() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from private.football_sporting_sources where id=new.source_id and revoked_at is null
  and purposes @> array['regulation_results'] and effective_from<=clock_timestamp() and effective_to>clock_timestamp())
 then raise exception 'Separate authoritative regulation-results permission required';end if;
 return new;
end $$;
create trigger football_outcome_authority before insert on private.football_model_outcomes for each row execute function private.football_outcome_authority();
revoke all on function private.football_outcome_authority() from public,anon,authenticated,docked_app;

create index football_fitted_inputs_lookup on private.football_sporting_inputs(event_id,(payload->>'manifestId'),created_at desc)
 where payload->>'schemaVersion'='football-fitted-input-v1';
