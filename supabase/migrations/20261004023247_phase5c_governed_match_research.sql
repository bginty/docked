-- Governed research is separate from models, betting ledgers and provider-price authority.
create table private.research_source_versions(
 id uuid primary key default gen_random_uuid(),source_key text not null,version text not null,
 revision bigint generated always as identity,configuration jsonb not null,config_hash text not null check(config_hash~'^[a-f0-9]{64}$'),
 supersedes uuid references private.research_source_versions,created_by uuid not null,reason text not null,
 created_at timestamptz not null default clock_timestamp(),unique(source_key,version)
);
create table private.research_policies(
 id uuid primary key default gen_random_uuid(),version text not null unique,configuration jsonb not null,config_hash text not null,
 created_by uuid not null,reason text not null,created_at timestamptz not null default clock_timestamp()
);
create table private.research_feature_versions(
 id uuid primary key default gen_random_uuid(),feature_key text not null,version text not null,model_version text references private.football_model_versions,
 configuration jsonb not null,config_hash text not null,supersedes uuid references private.research_feature_versions,
 created_by uuid not null,reason text not null,created_at timestamptz not null default clock_timestamp(),unique(feature_key,version)
);
create table private.research_facts(
 id text primary key,event_id text not null references private.events,source_review_id uuid not null references private.research_source_versions,
 source_item_id text not null,source_revision text not null,fact_type text not null,team_id text,player_id text,
 fact_key text not null,fact_hash text not null check(fact_hash~'^[a-f0-9]{64}$'),
 source_published_at timestamptz,source_observed_at timestamptz not null,ingested_at timestamptz not null,effective_at timestamptz not null,expires_at timestamptz not null,
 confidence text not null,reliability text not null,evidence_url text not null,evidence_hash text not null,
 record_state text not null check(record_state in('ASSERTED','WITHDRAWN')),supersedes_id text unique references private.research_facts,
 created_by uuid,job_id uuid references private.job_runs,created_at timestamptz not null default clock_timestamp(),
 unique(source_review_id,source_item_id,source_revision,fact_key)
);
create index research_facts_event_clock on private.research_facts(event_id,ingested_at,id);
create table private.research_fact_payloads(
 fact_id text primary key references private.research_facts,payload jsonb not null,retain_until timestamptz not null
);
create table private.research_match_snapshots(
 id uuid primary key default gen_random_uuid(),event_id text not null references private.events,policy_id uuid not null references private.research_policies,
 event_start_at timestamptz not null,event_participants jsonb not null,as_of_time timestamptz not null,
 fact_ids text[] not null,feature_ids uuid[] not null default '{}',manifest jsonb not null,manifest_hash text not null,
 research_hash text not null,created_by uuid,job_id uuid references private.job_runs,created_at timestamptz not null default clock_timestamp(),
 unique(event_id,policy_id,research_hash)
);
create table private.research_content(
 id uuid primary key default gen_random_uuid(),snapshot_id uuid not null references private.research_match_snapshots,event_id text not null references private.events,
 content_type text not null check(content_type in('DOCKED_RESEARCH','MATCH_UPDATE','LINEUP_UPDATE')),
 headline text not null,fact_ids text[] not null,created_by uuid not null,created_at timestamptz not null default clock_timestamp(),
 unique(snapshot_id,content_type)
);
create table private.research_content_reviews(
 id uuid primary key default gen_random_uuid(),content_id uuid not null references private.research_content,
 action text not null check(action in('PUBLISH','WITHDRAW')),actor uuid not null,reason text not null,created_at timestamptz not null default clock_timestamp()
);
create table private.research_schedules(
 id uuid primary key default gen_random_uuid(),source_review_id uuid not null references private.research_source_versions,
 policy_id uuid not null references private.research_policies,enabled boolean not null default false,
 next_run timestamptz,last_success timestamptz,last_failure timestamptz,created_by uuid not null,created_at timestamptz not null default clock_timestamp(),
 unique(source_review_id,policy_id)
);
create table private.research_fetch_requests(
 id uuid primary key default gen_random_uuid(),source_review_id uuid not null references private.research_source_versions,
 job_id uuid not null references private.job_runs,started_at timestamptz not null default clock_timestamp(),completed_at timestamptz,
 status text not null default 'RESERVED' check(status in('RESERVED','SUCCESS','NOT_MODIFIED','FAILED','BLOCKED')),
 http_status integer check(http_status between 100 and 599),response_hash text,etag text,last_modified text,
 measured jsonb,error_code text,retry_after timestamptz,credits_reserved integer not null default 0 check(credits_reserved=0)
);
create index research_requests_source_time on private.research_fetch_requests(source_review_id,started_at desc);
create table private.research_source_health(
 source_key text primary key,last_success timestamptz,last_failure timestamptz,error_code text,
 etag text,last_modified text,circuit_until timestamptz,updated_at timestamptz not null default clock_timestamp()
);
create table private.research_dataset_snapshots(
 id uuid primary key default gen_random_uuid(),source_review_id uuid not null references private.research_source_versions,
 request_id uuid not null unique references private.research_fetch_requests,observed_at timestamptz not null,
 raw_hash text not null check(raw_hash~'^[a-f0-9]{64}$'),payload_hash text not null check(payload_hash~'^[a-f0-9]{64}$'),
 record_count integer not null check(record_count between 1 and 1000),quality jsonb not null,
 created_at timestamptz not null default clock_timestamp()
);
create table private.research_dataset_payloads(snapshot_id uuid primary key references private.research_dataset_snapshots,payload jsonb not null,retain_until timestamptz not null);
create table private.research_recalculations(
 id uuid primary key default gen_random_uuid(),snapshot_id uuid not null references private.research_match_snapshots,
 model_version text not null references private.football_model_versions,prior_prediction_id uuid references private.football_model_attempts,
 new_prediction_id uuid references private.football_model_attempts,status text not null check(status in('DISPLAY_ONLY','NOT_CONFIGURED','WITHHELD')),
 trigger_fact_ids text[] not null,feature_ids uuid[] not null,reason text not null,actor uuid not null,
 created_at timestamptz not null default clock_timestamp(),unique(snapshot_id,model_version)
);
insert into private.feature_flags(key,enabled,reason)values('research_engine',false,'Research automation needs reviewed sources, explicit schedules and runtime activation')on conflict do nothing;
alter table private.social_notification_preferences add column research_updates boolean not null default false,add column lineup_updates boolean not null default false,add column team_updates boolean not null default false;

create function private.research_keys_only(p jsonb,allowed text[]) returns boolean language sql immutable set search_path='' as $$
 select jsonb_typeof(p)='object' and not exists(select 1 from jsonb_object_keys(p) k where not k=any(allowed))
$$;
create function private.research_hash(p jsonb) returns text language sql immutable set search_path='' as $$
 select encode(sha256(convert_to(private.phase5_canonical_json(p),'UTF8')),'hex')
$$;
create function private.research_public_url(p text)returns boolean language sql immutable set search_path='' as $$
 select coalesce(p~'^https://[a-zA-Z0-9.-]+(/[A-Za-z0-9_./%:@+-]*)?$' and p!~'[?#]' and p!~'^https://([0-9.]+|localhost|[^/]*[.]local)(/|$)' and length(p)<=2000,false)
$$;
create function private.research_lock_sources(p_event text)returns void language plpgsql set search_path='' as $$
declare r record;begin
 for r in select distinct s.source_key from private.research_facts f join private.research_source_versions s on s.id=f.source_review_id where f.event_id=p_event order by s.source_key loop
 perform pg_advisory_xact_lock(hashtext('research-source:'||r.source_key));
 end loop;
end $$;
create function private.research_actor(p_mode text default 'FACT') returns uuid language plpgsql set search_path='' as $$
declare actor uuid:=private.runtime_uid();begin
 if actor is null or not private.active_member_session() or coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb->>'aal' is distinct from 'aal2'
 or not exists(select 1 from private.roles r where r.user_id=actor and(r.role in('owner','admin') or(p_mode='FACT' and r.role='analyst')or(p_mode='CONTENT' and r.role='editor')))
 or not exists(select 1 from public.profiles p where p.id=actor and p.disabled_at is null)
 or not exists(select 1 from private.runtime_auth_users u where u.id=actor and coalesce(u.banned_until,'-infinity'::timestamptz)<=clock_timestamp())
 then raise exception 'Current research staff MFA required';end if;return actor;
end $$;
create function private.research_worker(p_job uuid) returns void language plpgsql set search_path='' as $$
declare j private.job_runs;sched private.research_schedules;e private.events;begin
 select * into j from private.job_runs where id=p_job for share;
 if j.kind is distinct from 'research-update' or j.state is distinct from 'leased' or j.lease_token::text is distinct from current_setting('docked.research_lease',true)
 or j.id::text is distinct from current_setting('docked.research_job',true) or j.lease_until<=clock_timestamp() then raise exception 'Current research worker lease required';end if;
 if j.payload->>'origin'='manual' then
  if not exists(select 1 from private.roles r join public.profiles p on p.id=r.user_id join private.runtime_auth_users u on u.id=p.id join private.runtime_auth_sessions s on s.user_id=u.id where r.user_id::text=j.payload->>'actorId' and s.id::text=j.payload->>'actorSessionId' and(s.not_after is null or s.not_after>clock_timestamp())and r.role in('owner','admin','analyst')and p.disabled_at is null and coalesce(u.banned_until,'-infinity'::timestamptz)<=clock_timestamp())then raise exception 'Research initiator authority withdrawn';end if;
 elsif j.payload->>'origin' is distinct from 'scheduled' then raise exception 'Research origin required';end if;
 select * into sched from private.research_schedules where id=(j.payload->>'scheduleId')::uuid for share;
 select * into e from private.events where id=j.payload->>'eventId' for share;
 if sched.id is null or e.id is null or e.competition_id is distinct from 'soccer_epl' or e.status is distinct from 'scheduled' or e.start_at<=clock_timestamp() or e.start_at is distinct from(j.payload->>'startAt')::timestamptz or private.research_hash(e.participants)is distinct from j.payload->>'participantHash' or(j.payload->>'origin'='scheduled' and not sched.enabled) then raise exception 'Current scheduled research context required';end if;
 if not exists(select 1 from private.feature_flags where key='research_engine' and enabled)then raise exception 'Research automation disabled';end if;
end $$;
create function private.research_source_allowed(p_id uuid,p_purpose text,p_jurisdiction text,p_at timestamptz default clock_timestamp())returns boolean language sql volatile set search_path='' as $$
 select coalesce((select s.id=(select x.id from private.research_source_versions x where x.source_key=s.source_key order by revision desc limit 1)
 and s.configuration->>'rightsState' in('APPROVED_AUTOMATED','APPROVED_MANUAL_ONLY')
 and(s.configuration->>'reviewedAt')::timestamptz<=p_at and(s.configuration->>'effectiveFrom')::timestamptz<=p_at
 and least((s.configuration->>'reviewDueAt')::timestamptz,(s.configuration->>'effectiveTo')::timestamptz)>p_at
 and s.configuration->'jurisdictions'?p_jurisdiction and s.configuration->>'commercialUse'='ALLOWED'
 and s.configuration#>>'{storage,permission}'='ALLOWED' and s.configuration#>>'{storage,immutableEvidenceAllowed}'='true'
 and case p_purpose when 'RETAIN' then true when 'DISPLAY' then s.configuration->>'publicDisplay'='ALLOWED' when 'MODEL' then s.configuration->>'modelUse'='ALLOWED' and s.configuration->>'derivedUse'='ALLOWED' and s.configuration->>'reliability'<>'TIER_4_UNCONFIRMED'
 when 'AUTOMATED_FETCH' then s.configuration->>'rightsState'='APPROVED_AUTOMATED' and s.configuration->>'automation'='ALLOWED' and s.configuration->>'robots' in('ALLOWED','NOT_APPLICABLE') and s.configuration->>'accessMethod' in('API','FEED','DATASET') and(s.configuration#>>'{etiquette,minimumIntervalSeconds}')::integer>0 and(s.configuration#>>'{etiquette,maximumRequestsPerDay}')::integer>0 else false end
 from private.research_source_versions s where s.id=p_id),false)
$$;
create function private.research_governance_guard()returns trigger language plpgsql set search_path='' as $$
declare a uuid;c jsonb;prior uuid;begin
 if tg_op<>'INSERT' then raise exception 'Versioned research governance is append-only';end if;
 a:=private.research_actor('MANAGE');c:=new.configuration;
 if new.created_by is distinct from a or length(btrim(new.reason))<12 or new.config_hash is distinct from private.research_hash(c) then raise exception 'Audited canonical research configuration required';end if;
 if tg_table_name='research_source_versions' then
  perform pg_advisory_xact_lock(hashtext('research-source:'||new.source_key));select id into prior from private.research_source_versions where source_key=new.source_key order by revision desc limit 1;
  if new.supersedes is distinct from prior or new.source_key is distinct from c->>'sourceId' or new.version is distinct from c->>'version'
  or c->>'schemaVersion' is distinct from 'research-source-v1' or not private.research_keys_only(c,array['schemaVersion','sourceId','version','name','domain','category','accessMethod','endpoint','rightsState','commercialUse','publicDisplay','storage','derivedUse','modelUse','automation','robots','etiquette','attribution','dataTypes','reliability','jurisdictions','reviewedAt','reviewDueAt','effectiveFrom','effectiveTo','evidenceUrls','notes'])
  or not coalesce(c->>'rightsState' in('APPROVED_AUTOMATED','APPROVED_MANUAL_ONLY','PERMISSION_REQUIRED','REVIEW_REQUIRED','PROHIBITED') and c->>'endpoint' like 'https://%' and length(c->>'name') between 1 and 200 and jsonb_array_length(c->'evidenceUrls')between 1 and 20 and jsonb_array_length(c->'jurisdictions')>0 and jsonb_array_length(c->'dataTypes')>0
  and(c->>'reviewedAt')::timestamptz<=clock_timestamp() and(c->>'reviewedAt')::timestamptz>=clock_timestamp()-interval '5 minutes'
  and(c->>'reviewDueAt')::timestamptz>(c->>'reviewedAt')::timestamptz and(c->>'effectiveTo')::timestamptz>(c->>'effectiveFrom')::timestamptz,false)
  then raise exception 'Current complete source rights review required';end if;
  if not coalesce(c->>'sourceId'~'^[A-Za-z0-9_.:-]{1,160}$' and c->>'version'~'^[A-Za-z0-9_.:-]{1,160}$' and c->>'publicDisplay' in('ALLOWED','UNKNOWN','DENIED')and c->>'commercialUse' in('ALLOWED','UNKNOWN','DENIED')and c->>'derivedUse' in('ALLOWED','UNKNOWN','DENIED')and c->>'modelUse' in('ALLOWED','UNKNOWN','DENIED')and c->>'automation' in('ALLOWED','UNKNOWN','DENIED')and c#>>'{storage,permission}' in('ALLOWED','UNKNOWN','DENIED')and jsonb_typeof(c#>'{storage,immutableEvidenceAllowed}')='boolean' and(c#>>'{storage,permission}'<>'ALLOWED' or(c#>>'{storage,maxDays}')::integer between 1 and 36500)and c->>'category' in('OFFICIAL','STRUCTURED_DATA','NEWS','WEATHER','DERIVED')and c->>'accessMethod' in('API','FEED','PAGE','MANUAL','DATASET')and c->>'robots' in('ALLOWED','DISALLOWED','UNKNOWN','NOT_APPLICABLE')and c->>'reliability' in('TIER_1_CONFIRMED_OFFICIAL','TIER_2_AUTHORISED_STRUCTURED','TIER_3_RELIABLE_REPORTED','TIER_4_UNCONFIRMED')and private.research_public_url(c->>'endpoint')and split_part(split_part(c->>'endpoint','://',2),'/',1)=c->>'domain' and private.research_public_url(c#>>'{attribution,url}')and length(c#>>'{attribution,label}')between 1 and 200,false)
  or exists(select 1 from jsonb_array_elements_text(c->'evidenceUrls')u where not private.research_public_url(u))
  or exists(select 1 from jsonb_array_elements_text(c->'dataTypes')v where v not in('PLAYER_INJURY','PLAYER_SUSPENSION','PLAYER_RETURN','EXPECTED_LINEUP','CONFIRMED_LINEUP','MANAGER_CHANGE','TEAM_FORM_UPDATE','PLAYER_FORM_UPDATE','MATCH_RESULT','TEAM_STAT_UPDATE','PLAYER_STAT_UPDATE','REST_ADVANTAGE','SCHEDULE_CONGESTION','WEATHER_UPDATE','VENUE_CHANGE','MATCH_POSTPONED','MATCH_CANCELLED'))then raise exception 'Strict research rights and public provenance required';end if;
 elsif tg_table_name='research_policies' then
  if new.version is distinct from c->>'version' or not private.research_keys_only(c,array['version','jurisdiction','requiredFactTypes','maxFactAgeSeconds','windowsSeconds'])
  or not coalesce(jsonb_array_length(c->'requiredFactTypes')>0 and(c->>'maxFactAgeSeconds')::integer between 1 and 31536000 and jsonb_array_length(c->'windowsSeconds')between 1 and 12 and length(c->>'jurisdiction')>0,false)
  or exists(select 1 from jsonb_array_elements_text(c->'windowsSeconds')v where v::integer<60 or v::integer>604800)
  then raise exception 'Explicit research completeness and scheduling policy required';end if;
 else
  perform pg_advisory_xact_lock(hashtext('research-feature:'||new.feature_key));select id into prior from private.research_feature_versions where feature_key=new.feature_key order by created_at desc,id desc limit 1;
  if new.supersedes is distinct from prior or new.feature_key is distinct from c->>'featureId' or new.version is distinct from c->>'version' then raise exception 'New immutable feature version required';end if;
  if not private.research_keys_only(c,array['schemaVersion','featureId','version','state','inputKind','factTypes','transformId','transformVersion','modelVersion','modelConfigHash','causalRationale','limitations','acceptedConfidence','maxAgeSeconds','trainingCutoff','reviewedAt','effectiveFrom','effectiveTo','reviewReference'])
  or not coalesce(c->>'schemaVersion'='research-feature-v1' and c->>'inputKind'='STRUCTURED_SPORTING_FACT' and c->>'state' in('DISPLAY_ONLY','MODEL_ELIGIBLE','MODEL_ACTIVE')and c->>'transformId'~'^[A-Za-z0-9_.:-]{1,160}$' and c->>'transformVersion'~'^[A-Za-z0-9_.:-]{1,160}$'and jsonb_array_length(c->'factTypes')>0 and jsonb_array_length(c->'acceptedConfidence')>0 and length(c->>'causalRationale')between 20 and 2000 and length(c->>'limitations')between 1 and 2000 and(c->>'maxAgeSeconds')::integer>0 and(c->>'reviewedAt')::timestamptz<=clock_timestamp()and(c->>'effectiveTo')::timestamptz>(c->>'effectiveFrom')::timestamptz and(c->>'trainingCutoff' is null or(c->>'trainingCutoff')::timestamptz<=(c->>'reviewedAt')::timestamptz)and length(c->>'reviewReference')>0,false)
  or new.model_version is distinct from c->>'modelVersion' or exists(select 1 from jsonb_array_elements_text(c->'acceptedConfidence')v where v not in('CONFIRMED','REPORTED'))then raise exception 'Strict immutable sporting feature definition required';end if;
  if c->>'state'<>'DISPLAY_ONLY' and not exists(select 1 from private.football_model_versions v where v.id=new.model_version and v.config_hash=c->>'modelConfigHash' and c->>'trainingCutoff' is not null)then raise exception 'Feature requires exact model configuration and training cutoff';end if;
  if c->>'state'='MODEL_ACTIVE' and not exists(select 1 from private.football_model_versions v where v.id=new.model_version and v.configuration->'activeResearchFeatureHashes'?private.research_hash(jsonb_build_object('schemaVersion','research-feature-definition-v1','featureId',c->'featureId','inputKind',c->'inputKind','factTypes',(select jsonb_agg(x order by x collate "C")from jsonb_array_elements_text(c->'factTypes')x),'transformId',c->'transformId','transformVersion',c->'transformVersion','causalRationale',c->'causalRationale','limitations',c->'limitations','acceptedConfidence',(select jsonb_agg(x order by x collate "C")from jsonb_array_elements_text(c->'acceptedConfidence')x),'maxAgeSeconds',c->'maxAgeSeconds','trainingCutoff',c->'trainingCutoff')))then raise exception 'A new model version must freeze active research feature definitions';end if;
 end if;
 perform private.research_actor('MANAGE');new.created_at:=clock_timestamp();insert into private.audit_events(actor,action,subject,details)values(a::text,'research_governance',tg_table_name,jsonb_build_object('id',new.id,'hash',new.config_hash,'reason',new.reason));return new;
end $$;
create trigger research_source_guard before insert or update or delete on private.research_source_versions for each row execute function private.research_governance_guard();
create trigger research_policy_guard before insert or update or delete on private.research_policies for each row execute function private.research_governance_guard();
create trigger research_feature_guard before insert or update or delete on private.research_feature_versions for each row execute function private.research_governance_guard();

create function private.research_fact_guard()returns trigger language plpgsql set search_path='' as $$
declare s private.research_source_versions;p private.research_facts;checked timestamptz;jur text;begin
 if tg_op<>'INSERT' then raise exception 'Research fact/correction ledger is immutable';end if;
 if new.job_id is null then if new.created_by is distinct from private.research_actor('FACT')then raise exception 'Fact actor mismatch';end if;else perform private.research_worker(new.job_id);end if;
 perform id from private.events where id=new.event_id for update;
 select * into s from private.research_source_versions where id=new.source_review_id for share;
 perform pg_advisory_xact_lock(hashtext('research-source:'||s.source_key));checked:=clock_timestamp();jur:=s.configuration->'jurisdictions'->>0;
 if not private.research_source_allowed(s.id,case when new.job_id is null then 'RETAIN' else 'AUTOMATED_FETCH' end,jur,checked)
 or not coalesce(s.configuration->'dataTypes'?new.fact_type and new.reliability=s.configuration->>'reliability'
 and new.confidence in('CONFIRMED','REPORTED','RUMOUR','MODEL_DERIVED') and new.ingested_at<=checked and new.ingested_at>=checked-interval '5 minutes' and new.source_observed_at<=new.ingested_at and(new.source_published_at is null or new.source_published_at<=new.source_observed_at)
 and(s.configuration->>'reviewedAt')::timestamptz<=new.ingested_at and(s.configuration->>'effectiveFrom')::timestamptz<=new.ingested_at and new.expires_at>new.effective_at and new.expires_at>checked and new.expires_at<=least((s.configuration->>'effectiveTo')::timestamptz,new.ingested_at+(s.configuration#>>'{storage,maxDays}')::integer*interval '1 day')
 and new.evidence_url like 'https://%' and new.evidence_hash~'^[a-f0-9]{64}$' and new.fact_key~'^[a-f0-9]{64}$',false)
 or(new.reliability='TIER_4_UNCONFIRMED' and new.confidence='CONFIRMED') then raise exception 'Current source rights, provenance and bounded retention required';end if;
 if new.supersedes_id is not null then select * into p from private.research_facts where id=new.supersedes_id for share;
  if p.id is null or p.event_id<>new.event_id or p.fact_key<>new.fact_key or p.ingested_at>=new.ingested_at or not exists(select 1 from private.research_source_versions x where x.id=p.source_review_id and x.source_key=s.source_key)then raise exception 'Matching earlier correction predecessor required';end if;
 elsif new.record_state='WITHDRAWN' then raise exception 'Withdrawal requires prior fact';end if;
 if new.fact_type='MATCH_RESULT' and not exists(select 1 from private.events e where e.id=new.event_id and e.start_at<coalesce(new.source_published_at,new.source_observed_at))then raise exception 'Prospective target result cannot precede kickoff';end if;
 if new.job_id is null then perform private.research_actor('FACT');else perform private.research_worker(new.job_id);end if;new.created_at:=clock_timestamp();return new;
end $$;
create trigger research_fact_guard before insert or update or delete on private.research_facts for each row execute function private.research_fact_guard();

create function private.research_payload_guard()returns trigger language plpgsql set search_path='' as $$
declare f private.research_facts;s private.research_source_versions;p jsonb;v jsonb;keys text[];begin
 if tg_op='UPDATE' then raise exception 'Research fact payload is immutable';end if;
 if tg_op='DELETE' then if old.retain_until>clock_timestamp()then raise exception 'Unexpired research evidence retained';end if;return old;end if;
 select * into f from private.research_facts where id=new.fact_id for share;select * into s from private.research_source_versions where id=f.source_review_id for share;p:=new.payload;v:=p->'value';
 if f.job_id is null then perform private.research_actor('FACT');else perform private.research_worker(f.job_id);end if;
 if private.research_hash(p) is distinct from f.fact_hash or p->>'id' is distinct from f.id or p->>'eventId' is distinct from f.event_id or p->>'sourceId' is distinct from s.source_key or p->>'sourceVersion' is distinct from s.version or p->>'type' is distinct from f.fact_type
 or(p->>'ingestedAt')::timestamptz is distinct from f.ingested_at or(p->>'sourcePublishedAt')::timestamptz is distinct from f.source_published_at or(p->>'sourceObservedAt')::timestamptz is distinct from f.source_observed_at or(p->>'effectiveAt')::timestamptz is distinct from f.effective_at or(p->>'expiresAt')::timestamptz is distinct from f.expires_at
 or p->>'confidence' is distinct from f.confidence or p->>'reliability' is distinct from f.reliability or p->>'recordState' is distinct from f.record_state or p->>'supersedesId' is distinct from f.supersedes_id
 or p->>'teamId' is distinct from f.team_id or p->>'playerId' is distinct from f.player_id or p->>'evidenceUrl' is distinct from f.evidence_url or p->>'evidenceHash' is distinct from f.evidence_hash
 or p->>'sourceItemId' is distinct from f.source_item_id or p->>'sourceRevision' is distinct from f.source_revision
 or new.retain_until is distinct from f.expires_at or p->>'schemaVersion' is distinct from 'research-fact-v1' or not private.research_keys_only(p,array['schemaVersion','id','type','eventId','teamId','playerId','value','sourceId','sourceVersion','sourceItemId','sourceRevision','sourcePublishedAt','sourceObservedAt','ingestedAt','effectiveAt','expiresAt','confidence','reliability','evidenceUrl','evidenceHash','supersedesId','recordState','correctionReason'])
 then raise exception 'Exact immutable structured fact payload required';end if;
 keys:=case f.fact_type
 when 'PLAYER_INJURY' then array['status','reason'] when 'PLAYER_SUSPENSION' then array['status','reason'] when 'PLAYER_RETURN' then array['status','reason']
 when 'EXPECTED_LINEUP' then array['playerIds','formation'] when 'CONFIRMED_LINEUP' then array['playerIds','formation'] when 'MANAGER_CHANGE' then array['previousManagerId','newManagerId']
 when 'TEAM_FORM_UPDATE' then array['metric','value','unit','competitionId','season','venue','periodStart','periodEnd','sampleMatches','sampleMinutes','opponentAdjustment','adjustmentVersion']
 when 'PLAYER_FORM_UPDATE' then array['metric','value','unit','competitionId','season','venue','periodStart','periodEnd','sampleMatches','sampleMinutes','opponentAdjustment','adjustmentVersion']
 when 'TEAM_STAT_UPDATE' then array['metric','value','unit','competitionId','season','venue','periodStart','periodEnd','sampleMatches','sampleMinutes','opponentAdjustment','adjustmentVersion']
 when 'PLAYER_STAT_UPDATE' then array['metric','value','unit','competitionId','season','venue','periodStart','periodEnd','sampleMatches','sampleMinutes','opponentAdjustment','adjustmentVersion']
 when 'MATCH_RESULT' then array['homeGoals','awayGoals','period','status'] when 'REST_ADVANTAGE' then array['restHours','opponentRestHours','previousEventId','opponentPreviousEventId'] when 'SCHEDULE_CONGESTION' then array['windowStart','windowEnd','eventIds'] when 'WEATHER_UPDATE' then array['temperatureCelsius','windKph','precipitationMm','forecastFor'] when 'VENUE_CHANGE' then array['previousVenueId','venueId'] when 'MATCH_POSTPONED' then array['status','newStartAt'] when 'MATCH_CANCELLED' then array['status'] else null end;
 if keys is null or not coalesce(private.research_keys_only(v,keys) and(v?&keys),false)then raise exception 'Unsupported research value shape';end if;
 if f.fact_type='MATCH_RESULT' and not coalesce(v->>'period'='REGULATION' and v->>'status'='FINAL' and(v->>'homeGoals')::integer between 0 and 100 and(v->>'awayGoals')::integer between 0 and 100,false)then raise exception 'Verified regulation result required';end if;
 if f.fact_type like 'PLAYER_%' and(f.team_id is null or f.player_id is null)then raise exception 'Player/team identity required';end if;
 if f.fact_type='CONFIRMED_LINEUP' and not coalesce(f.confidence='CONFIRMED' and jsonb_array_length(v->'playerIds')=11,false)then raise exception 'Confirmed eleven required';end if;
 if f.supersedes_id is not null and coalesce(length(p->>'correctionReason'),0)=0 then raise exception 'Correction reason required';end if;
 return new;
end $$;
create trigger research_payload_guard before insert or update or delete on private.research_fact_payloads for each row execute function private.research_payload_guard();

create function private.research_fact_current(p_id text,p_jurisdiction text,p_at timestamptz default clock_timestamp())returns boolean language sql volatile set search_path='' as $$
 select coalesce((select f.record_state='ASSERTED' and f.ingested_at<=p_at and coalesce(f.source_published_at,f.source_observed_at)<=p_at and f.effective_at<=p_at and f.expires_at>p_at and p.retain_until>p_at
 and not exists(select 1 from private.research_facts x where x.supersedes_id=f.id and x.ingested_at<=p_at and x.effective_at<=p_at)
 and private.research_source_allowed(f.source_review_id,'DISPLAY',p_jurisdiction,p_at)
 from private.research_facts f join private.research_fact_payloads p on p.fact_id=f.id where f.id=p_id),false)
$$;
create function private.research_snapshot_guard()returns trigger language plpgsql set search_path='' as $$
declare e private.events;p private.research_policies;fid text;checked timestamptz;begin
 if tg_op<>'INSERT' then raise exception 'Research snapshots are immutable';end if;
 if new.job_id is null then if new.created_by is distinct from private.research_actor('FACT')then raise exception 'Snapshot actor mismatch';end if;else perform private.research_worker(new.job_id);end if;
 select * into e from private.events where id=new.event_id for share;select * into p from private.research_policies where id=new.policy_id for share;
 perform private.research_lock_sources(new.event_id);
 foreach fid in array new.fact_ids loop perform id from private.research_facts where id=fid for share;end loop;checked:=clock_timestamp();
 if e.competition_id is distinct from 'soccer_epl' or e.status is distinct from 'scheduled' or e.start_at<=checked or new.event_start_at is distinct from e.start_at or new.event_participants is distinct from e.participants
 or new.as_of_time>checked or new.as_of_time<checked-interval '5 minutes' or new.manifest_hash is distinct from private.research_hash(new.manifest) or new.research_hash!~'^[a-f0-9]{64}$'
 or new.manifest->>'eventId' is distinct from e.id or new.manifest->'factIds' is distinct from to_jsonb(new.fact_ids)
 or new.manifest#>>'{event,eventId}' is distinct from e.id or new.manifest#>>'{event,homeTeamId}' is distinct from e.participants->>0 or new.manifest#>>'{event,awayTeamId}' is distinct from e.participants->>1 or(new.manifest#>>'{event,startAt}')::timestamptz is distinct from e.start_at
 then raise exception 'Current prematch canonical research snapshot required';end if;
 foreach fid in array new.fact_ids loop
  if not private.research_fact_current(fid,p.configuration->>'jurisdiction',new.as_of_time)or not private.research_fact_current(fid,p.configuration->>'jurisdiction',checked)or not exists(select 1 from private.research_facts f where f.id=fid and f.event_id=e.id)then raise exception 'Snapshot fact authority unavailable';end if;
 end loop;
 if new.job_id is null then perform private.research_actor('FACT');else perform private.research_worker(new.job_id);end if;new.created_at:=clock_timestamp();return new;
end $$;
create trigger research_snapshot_guard before insert or update or delete on private.research_match_snapshots for each row execute function private.research_snapshot_guard();

create function private.research_content_guard()returns trigger language plpgsql set search_path='' as $$
declare a uuid;content private.research_content;s private.research_match_snapshots;p private.research_policies;f text;publishing boolean;begin
 if tg_op<>'INSERT' then raise exception 'Research editorial history is append-only';end if;a:=private.research_actor('CONTENT');
 if tg_table_name='research_content' then
  if new.created_by is distinct from a or length(new.headline)not between 1 and 240 or cardinality(new.fact_ids)=0 then raise exception 'Evidence-bound research draft required';end if;
  content:=new;publishing:=true;
 else
  if new.actor is distinct from a or length(btrim(new.reason))<12 then raise exception 'Audited editorial decision required';end if;
  select * into content from private.research_content where id=new.content_id for share;publishing:=new.action='PUBLISH';
 end if;
 select * into s from private.research_match_snapshots where id=content.snapshot_id for share;select * into p from private.research_policies where id=s.policy_id for share;
 if content.event_id is distinct from s.event_id or not(content.fact_ids<@s.fact_ids)then raise exception 'Draft must use its immutable snapshot';end if;
 if publishing then
  perform id from private.events where id=content.event_id for share;perform private.research_lock_sources(content.event_id);
  if not exists(select 1 from private.events e where e.id=content.event_id and e.status='scheduled' and e.start_at>clock_timestamp()and e.start_at=s.event_start_at and e.participants=s.event_participants)then raise exception 'Current snapshot event identity required';end if;
  foreach f in array content.fact_ids loop
   if not private.research_fact_current(f,p.configuration->>'jurisdiction')or exists(select 1 from private.research_facts x where x.id=f and x.confidence='RUMOUR')
   or exists(select 1 from private.research_facts x join private.research_fact_payloads xp on xp.fact_id=x.id join private.research_facts other on other.event_id=x.event_id and other.fact_key=x.fact_key join private.research_fact_payloads op on op.fact_id=other.id where x.id=f and private.research_fact_current(other.id,p.configuration->>'jurisdiction') and xp.payload->'value' is distinct from op.payload->'value')then raise exception 'Current reviewed non-conflicting fact rights required';end if;
  end loop;
 end if;
 perform private.research_actor('CONTENT');new.created_at:=clock_timestamp();return new;
end $$;
create trigger research_content_guard before insert or update or delete on private.research_content for each row execute function private.research_content_guard();
create trigger research_content_review_guard before insert or update or delete on private.research_content_reviews for each row execute function private.research_content_guard();

create function private.research_schedule_guard()returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'Disable research schedule; retain audit';end if;
 if tg_op='UPDATE' and current_setting('docked.research_scheduler',true)='true' and(to_jsonb(new)-array['next_run','last_success','last_failure'])=(to_jsonb(old)-array['next_run','last_success','last_failure'])then return new;end if;
 perform private.research_actor('MANAGE');if tg_op='UPDATE' and(to_jsonb(new)-array['enabled','next_run'])is distinct from(to_jsonb(old)-array['enabled','next_run'])then raise exception 'Research schedule source/policy immutable';end if;
 if new.enabled and not exists(select 1 from private.research_policies p where p.id=new.policy_id and private.research_source_allowed(new.source_review_id,'AUTOMATED_FETCH',p.configuration->>'jurisdiction'))then raise exception 'Automatic source approval required';end if;return new;
end $$;
create trigger research_schedule_guard before insert or update or delete on private.research_schedules for each row execute function private.research_schedule_guard();

create function private.research_request_guard()returns trigger language plpgsql set search_path='' as $$
declare s private.research_source_versions;checked timestamptz;begin
 if tg_op='DELETE' then raise exception 'Research request ledger retained';end if;perform private.research_worker(new.job_id);
 if tg_op='UPDATE' then
  if old.status<>'RESERVED' or new.status='RESERVED' or(to_jsonb(new)-array['completed_at','status','http_status','response_hash','etag','last_modified','measured','error_code','retry_after'])is distinct from(to_jsonb(old)-array['completed_at','status','http_status','response_hash','etag','last_modified','measured','error_code','retry_after'])then raise exception 'Request authority/history immutable';end if;
  new.completed_at:=clock_timestamp();return new;
 end if;
 if new.status is distinct from 'RESERVED' or new.completed_at is not null or new.http_status is not null or new.response_hash is not null or new.measured is not null or new.error_code is not null or new.retry_after is not null then raise exception 'Research request must reserve before network';end if;
 select * into s from private.research_source_versions where id=new.source_review_id for share;perform pg_advisory_xact_lock(hashtext('research-fetch:'||s.source_key));checked:=clock_timestamp();
 if not exists(select 1 from private.job_runs j join private.research_schedules schedule on schedule.id=(j.payload->>'scheduleId')::uuid where j.id=new.job_id and schedule.source_review_id=new.source_review_id)then raise exception 'Request source must match authorized job';end if;
 if not private.research_source_allowed(s.id,'AUTOMATED_FETCH',s.configuration->'jurisdictions'->>0,checked)
 or exists(select 1 from private.research_source_health h where h.source_key=s.source_key and h.circuit_until>checked)
 or exists(select 1 from private.research_fetch_requests r join private.research_source_versions v on v.id=r.source_review_id where v.source_key=s.source_key and(r.status='RESERVED' or r.started_at>checked-(s.configuration#>>'{etiquette,minimumIntervalSeconds}')::integer*interval '1 second'))
 or(select count(*) from private.research_fetch_requests r join private.research_source_versions v on v.id=r.source_review_id where v.source_key=s.source_key and r.started_at>=date_trunc('day',checked at time zone 'UTC')at time zone 'UTC')>=(s.configuration#>>'{etiquette,maximumRequestsPerDay}')::integer
 then raise exception 'Source rights, rate, circuit or durable quota blocked';end if;
 perform private.research_worker(new.job_id);new.started_at:=clock_timestamp();return new;
end $$;
create trigger research_request_guard before insert or update or delete on private.research_fetch_requests for each row execute function private.research_request_guard();

create function private.research_recalculation_guard()returns trigger language plpgsql set search_path='' as $$
declare a uuid;s private.research_match_snapshots;begin
 if tg_op<>'INSERT' then raise exception 'Recalculation request/abstention is immutable';end if;a:=private.research_actor('FACT');select * into s from private.research_match_snapshots where id=new.snapshot_id for share;
 if new.actor is distinct from a or new.new_prediction_id is not null or not(new.trigger_fact_ids<@s.fact_ids) or length(btrim(new.reason))<12
 or(new.prior_prediction_id is not null and not exists(select 1 from private.football_model_attempts p where p.id=new.prior_prediction_id and p.event_id=s.event_id and p.requested_model_version=new.model_version))then raise exception 'Preserve original canonical prediction; no fitted recalculation executor installed';end if;
 new.created_at:=clock_timestamp();return new;
end $$;
create trigger research_recalculation_guard before insert or update or delete on private.research_recalculations for each row execute function private.research_recalculation_guard();

create function private.research_dataset_guard()returns trigger language plpgsql set search_path='' as $$
declare d private.research_dataset_snapshots;r private.research_fetch_requests;s private.research_source_versions;p jsonb;begin
 if tg_op='DELETE' and tg_table_name='research_dataset_payloads' then if old.retain_until>clock_timestamp()then raise exception 'Unexpired dataset evidence retained';end if;return old;end if;
 if tg_op<>'INSERT' then raise exception 'Research dataset evidence is immutable';end if;
 if tg_table_name='research_dataset_snapshots' then d:=new;else select * into d from private.research_dataset_snapshots where id=new.snapshot_id for share;end if;
 select * into r from private.research_fetch_requests where id=d.request_id for share;perform private.research_worker(r.job_id);
 select * into s from private.research_source_versions where id=r.source_review_id for share;
 if d.source_review_id is distinct from r.source_review_id or r.status<>'RESERVED' or not private.research_source_allowed(s.id,'AUTOMATED_FETCH',s.configuration->'jurisdictions'->>0)
 or d.observed_at>clock_timestamp() or d.observed_at<r.started_at or d.quality->>'status' is distinct from 'RESEARCH_ONLY' or d.quality->>'modelReady' is distinct from 'false' or d.quality->>'settlementReady' is distinct from 'false' then raise exception 'Current bounded research-only dataset authority required';end if;
 if tg_table_name='research_dataset_payloads' then p:=new.payload;
 if private.research_hash(p) is distinct from d.payload_hash or p->>'schemaVersion' is distinct from 'openfootball-research-dataset-v1' or p->>'sourceId' is distinct from s.source_key or p->>'sourceVersion' is distinct from s.version or p->>'sourcePublishedAt' is not null or(p->>'sourceObservedAt')::timestamptz is distinct from d.observed_at or jsonb_array_length(p->'matches')is distinct from d.record_count
 or new.retain_until<=clock_timestamp() or new.retain_until>least((s.configuration->>'effectiveTo')::timestamptz,d.observed_at+(s.configuration#>>'{storage,maxDays}')::integer*interval '1 day') then raise exception 'Exact retained research dataset required';end if;
 if not private.research_keys_only(p,array['schemaVersion','competitionId','season','sourceId','sourceVersion','sourcePublishedAt','sourceObservedAt','matches'])or p->>'competitionId' is distinct from 'soccer_epl' or exists(select 1 from jsonb_array_elements(p->'matches')m where not private.research_keys_only(m,array['sourceItemId','homeTeam','awayTeam','scheduledDate','scheduledTime','homeGoals','awayGoals','resultSemantics','scoreField'])or m->>'resultSemantics' is distinct from 'REPORTED_UNVERIFIED_REGULATION')then raise exception 'Research-only dataset shape required';end if;
 end if;return new;
end $$;
create trigger research_dataset_guard before insert or update or delete on private.research_dataset_snapshots for each row execute function private.research_dataset_guard();
create trigger research_dataset_payload_guard before insert or update or delete on private.research_dataset_payloads for each row execute function private.research_dataset_guard();

create function private.research_health_guard()returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'Research health history retained';end if;
 perform private.research_worker(nullif(current_setting('docked.research_job',true),'')::uuid);
 if not exists(select 1 from private.research_fetch_requests r join private.research_source_versions s on s.id=r.source_review_id where r.job_id::text=current_setting('docked.research_job',true) and s.source_key=new.source_key)then raise exception 'Own research request required';end if;
 new.updated_at:=clock_timestamp();return new;
end $$;
create trigger research_health_guard before insert or update or delete on private.research_source_health for each row execute function private.research_health_guard();

-- Independent typed-value validation at the SQL boundary, including direct trusted-server writes.
create function private.research_decimal(p jsonb,p_nonnegative boolean default true)returns boolean language sql immutable set search_path='' as $$
 select coalesce(jsonb_typeof(p)='string'and length(p#>>'{}')<=60 and(p#>>'{}')~case when p_nonnegative then '^(0|[1-9][0-9]*)([.][0-9]+)?$'else '^-?(0|[1-9][0-9]*)([.][0-9]+)?$'end,false)
$$;
create function private.research_identifier(p jsonb)returns boolean language sql immutable set search_path='' as $$
 select coalesce(jsonb_typeof(p)='string'and(p#>>'{}')~'^[A-Za-z0-9_.:-]{1,160}$',false)
$$;
create function private.research_value_guard()returns trigger language plpgsql set search_path='' as $$
declare p jsonb:=new.payload;v jsonb:=p->'value';t text:=p->>'type';context jsonb;begin
 if tg_op<>'INSERT' then return new;end if;
 context:=case when v?'metric' then jsonb_build_object('metric',v->'metric','unit',v->'unit','competitionId',v->'competitionId','season',v->'season','venue',v->'venue','periodStart',v->'periodStart','periodEnd',v->'periodEnd','opponentAdjustment',v->'opponentAdjustment','adjustmentVersion',v->'adjustmentVersion')else 'null'::jsonb end;
 if not exists(select 1 from private.research_facts f where f.id=new.fact_id and f.fact_key=private.research_hash(jsonb_build_object('eventId',p->'eventId','teamId',p->'teamId','playerId',p->'playerId','type',p->'type','context',context)))then raise exception 'Canonical fact identity required';end if;
 if (t like 'TEAM_%' or t like '%LINEUP' or t in('MANAGER_CHANGE','REST_ADVANTAGE','SCHEDULE_CONGESTION'))and p->>'teamId' is null then raise exception 'Canonical team identity required';end if;
 if p->>'teamId' is not null and not exists(select 1 from private.events e where e.id=p->>'eventId' and e.participants?(p->>'teamId'))then raise exception 'Team must match canonical participants';end if;
 if t in('PLAYER_INJURY','PLAYER_RETURN','PLAYER_SUSPENSION')and not coalesce(v->>'status' in('OUT','DOUBTFUL','AVAILABLE','UNKNOWN')and v->>'reason' in('INJURY','SUSPENSION','RETURN','OTHER','UNKNOWN'),false)then raise exception 'Structured availability required';end if;
 if t in('EXPECTED_LINEUP','CONFIRMED_LINEUP')and not coalesce(jsonb_array_length(v->'playerIds')between 1 and 11 and(select count(distinct x)from jsonb_array_elements_text(v->'playerIds')x)=jsonb_array_length(v->'playerIds')and not exists(select 1 from jsonb_array_elements_text(v->'playerIds')x where x!~'^[A-Za-z0-9_.:-]{1,160}$'),false)then raise exception 'Distinct structured lineup required';end if;
 if t in('EXPECTED_LINEUP','CONFIRMED_LINEUP') and not coalesce((v->>'formation' is null or v->>'formation'~'^[0-9](-[0-9]){1,4}$')and not exists(select 1 from jsonb_array_elements(v->'playerIds')x where not private.research_identifier(x)),false)then raise exception 'Typed lineup identity required';end if;
 if v?'metric' and not coalesce(v->>'metric' in('goals','goals_conceded','shots','shots_on_target','xg','xg_conceded','xg_per_90','goals_per_90','assists','minutes','clean_sheets','wins','draws','losses','points','possession_pct','passes','tackles','saves')and v->>'value'~'^(0|[1-9][0-9]*)([.][0-9]+)?$' and v->>'unit' in('count','minutes','per_90','percent','per_match')and v->>'venue' in('HOME','AWAY','ALL')and(v->>'sampleMatches')::integer>0 and(v->>'sampleMinutes' is null or(v->>'sampleMinutes')::integer>=0)and(v->>'periodStart')::timestamptz<(v->>'periodEnd')::timestamptz and(v->>'periodEnd')::timestamptz<=(p->>'effectiveAt')::timestamptz and v->>'opponentAdjustment' in('UNADJUSTED','ADJUSTED')and(v->>'opponentAdjustment'<>'ADJUSTED' or v->>'adjustmentVersion' is not null),false)then raise exception 'Structured completed sporting statistic required';end if;
 if t='MATCH_POSTPONED' and v->>'status' is distinct from 'POSTPONED' or t='MATCH_CANCELLED' and v->>'status' is distinct from 'CANCELLED' then raise exception 'Explicit event status required';end if;
 if v?'metric' and not coalesce(private.research_decimal(v->'value')and jsonb_typeof(v->'sampleMatches')='number'and(v->>'sampleMinutes' is null or jsonb_typeof(v->'sampleMinutes')='number')and private.research_identifier(v->'competitionId')and private.research_identifier(v->'season')and(v->>'unit'<>'percent' or(v->>'value')::numeric<=100)and(v->>'metric'<>'possession_pct' or v->>'unit'='percent')and(v->>'metric' not like '%_per_90' or v->>'unit'='per_90')and((v->>'opponentAdjustment'='UNADJUSTED' and v->>'adjustmentVersion' is null)or(v->>'opponentAdjustment'='ADJUSTED' and private.research_identifier(v->'adjustmentVersion'))),false)then raise exception 'Typed sporting statistic context required';end if;
 if t='MATCH_RESULT' and not coalesce(jsonb_typeof(v->'homeGoals')='number'and jsonb_typeof(v->'awayGoals')='number'and v->>'homeGoals'~'^[0-9]+$'and v->>'awayGoals'~'^[0-9]+$',false)then raise exception 'Typed regulation goals required';end if;
 if t='REST_ADVANTAGE'and not coalesce(private.research_decimal(v->'restHours')and private.research_decimal(v->'opponentRestHours')and private.research_identifier(v->'previousEventId')and private.research_identifier(v->'opponentPreviousEventId'),false)then raise exception 'Typed nonnegative rest evidence required';end if;
 if t='WEATHER_UPDATE'and not coalesce((v->>'temperatureCelsius' is not null or v->>'windKph' is not null or v->>'precipitationMm' is not null)and(v->>'temperatureCelsius' is null or private.research_decimal(v->'temperatureCelsius',false))and(v->>'windKph' is null or private.research_decimal(v->'windKph'))and(v->>'precipitationMm' is null or private.research_decimal(v->'precipitationMm'))and(v->>'forecastFor')::timestamptz is not null,false)then raise exception 'Typed available weather evidence required';end if;
 if t='MANAGER_CHANGE'and not coalesce(private.research_identifier(v->'newManagerId')and(v->>'previousManagerId' is null or private.research_identifier(v->'previousManagerId')),false)then raise exception 'Typed manager identities required';end if;
 if t='VENUE_CHANGE'and not coalesce(private.research_identifier(v->'venueId')and(v->>'previousVenueId' is null or private.research_identifier(v->'previousVenueId')),false)then raise exception 'Typed venue identities required';end if;
 if t='SCHEDULE_CONGESTION'and not coalesce((v->>'windowStart')::timestamptz is not null and(v->>'windowEnd')::timestamptz is not null and jsonb_array_length(v->'eventIds')>0 and(select count(distinct x)from jsonb_array_elements_text(v->'eventIds')x)=jsonb_array_length(v->'eventIds')and not exists(select 1 from jsonb_array_elements(v->'eventIds')x where not private.research_identifier(x)),false)then raise exception 'Typed event schedule required';end if;
 if t='MATCH_POSTPONED'and v->>'newStartAt' is not null then perform(v->>'newStartAt')::timestamptz;end if;
 if p->>'evidenceUrl'!~'^https://[A-Za-z0-9.-]+/[^?#@]*$' then raise exception 'Public credential-free evidence URL required';end if;
 return new;
end $$;
create trigger research_value_guard before insert on private.research_fact_payloads for each row execute function private.research_value_guard();

do $$declare t text;f record;begin
 foreach t in array array['research_source_versions','research_policies','research_feature_versions','research_facts','research_fact_payloads','research_match_snapshots','research_content','research_content_reviews','research_schedules','research_fetch_requests','research_source_health','research_recalculations','research_dataset_snapshots','research_dataset_payloads']loop
  execute format('alter table private.%I enable row level security',t);execute format('revoke all on private.%I from public,anon,authenticated,docked_app',t);
 end loop;
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname like 'research_%'loop execute format('revoke all on function %s from public,anon,authenticated,docked_app',f.signature);end loop;
end $$;
