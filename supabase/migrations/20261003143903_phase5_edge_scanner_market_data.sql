-- Phase 5 infrastructure only. No provider, scanner, strategy or publication is activated.
-- Current sporting observations are not forward-paper selections or live publications.
alter type public.evidence_type add value if not exists 'market_data';

-- New record serializer: UTF-8/C object order and plain normalized decimal numbers.
-- Existing strategy/reference serializers and hashes are deliberately unchanged.
create function private.phase5_canonical_json(value jsonb) returns text language sql immutable set search_path='' as $$
 select case jsonb_typeof(value)
 when 'object' then '{'||coalesce((select string_agg(to_jsonb(key)::text||':'||private.phase5_canonical_json(v),',' order by key collate "C") from jsonb_each(value)e(key,v)),'')||'}'
 when 'array' then '['||coalesce((select string_agg(private.phase5_canonical_json(v),',' order by n) from jsonb_array_elements(value) with ordinality e(v,n)),'')||']'
 when 'number' then case when value::text::numeric=0 then '0' when position('.' in value::text)>0 then rtrim(rtrim(value::text,'0'),'.') else value::text end
 else value::text end
$$;
revoke all on function private.phase5_canonical_json(jsonb) from public,anon,authenticated;


create table private.scanner_schedules(
 id text primary key, configuration jsonb not null, enabled boolean not null default false,
 next_run timestamptz, updated_by uuid, updated_at timestamptz not null default clock_timestamp()
);
create table private.scanner_runs(
 id uuid primary key default gen_random_uuid(),job_id uuid not null unique references private.job_runs(id),
 schedule_id text references private.scanner_schedules(id),purpose text not null check(purpose in ('research','paper','live')),
 strategy_id text not null references private.strategy_versions(id),region_policy_id uuid not null references private.region_policies(id),
 status text not null default 'RUNNING' check(status in ('RUNNING','SUCCEEDED','DEGRADED','FAILED')),
 started_at timestamptz not null default clock_timestamp(),finished_at timestamptz,
 metrics jsonb not null default '{}',rejections jsonb not null default '[]',error_code text
);
create table private.scanner_candidates(
 id uuid primary key default gen_random_uuid(),dedupe_key text not null unique check(dedupe_key ~ '^[a-f0-9]{64}$'),
 run_id uuid not null references private.scanner_runs(id),event_id text not null references private.events(id),market_id text not null references private.markets(id),
 strategy_id text not null references private.strategy_versions(id),strategy_hash text not null,code_commit text not null check(code_commit ~ '^[a-f0-9]{40}$'),
 region_policy_id uuid not null references private.region_policies(id),purpose text not null check(purpose in ('research','paper','live')),
 selection text not null,market_reference_id uuid not null references private.market_references(id),model_version text not null,model_evidence jsonb not null,
 probability numeric not null check(probability>0 and probability<1),fair_odds numeric not null,minimum_odds numeric not null,
 required_ev numeric not null,estimated_ev numeric not null,window_seconds integer not null,
 scanned_at timestamptz not null,expires_at timestamptz not null,origin text not null check(origin in ('scheduled','manual')),
 created_by uuid,warnings jsonb not null default '[]',created_at timestamptz not null default clock_timestamp()
);
create table private.scanner_run_markets(
 run_id uuid not null references private.scanner_runs(id),market_id text not null references private.markets(id),
 event_id text not null references private.events(id),outcome jsonb not null,created_at timestamptz not null default clock_timestamp(),primary key(run_id,market_id)
);
create index scanner_candidate_recency on private.scanner_candidates(scanned_at desc,id desc);
create table private.scanner_reviews(
 id uuid primary key default gen_random_uuid(),candidate_id uuid not null references private.scanner_candidates(id),
 status text not null check(status in ('NEEDS_REVIEW','APPROVED','REJECTED','EXPIRED','INVALIDATED')),
 actor uuid,reason text not null check(length(btrim(reason)) between 3 and 1000),category text,
 market_reference_id uuid references private.market_references(id),publication_id uuid references private.tip_publications(id),
 evidence jsonb not null default '{}',created_at timestamptz not null default clock_timestamp()
);
create index scanner_review_latest on private.scanner_reviews(candidate_id,created_at desc,id desc);
create unique index scanner_once_approved on private.scanner_reviews(candidate_id) where status='APPROVED';
create table private.operational_alerts(
 id uuid primary key default gen_random_uuid(),dedupe_key text not null unique,kind text not null,
 severity text not null check(severity in ('info','warning','critical')),message text not null check(length(message) between 3 and 500),
 href text check(href ~ '^/admin(/|$)'),payload jsonb not null default '{}',created_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null
);
create table private.community_recognition_snapshots(
 id uuid primary key default gen_random_uuid(),rule_version text not null,week_start timestamptz not null,week_end timestamptz not null,
 as_of timestamptz not null,payload_hash text not null check(payload_hash ~ '^[a-f0-9]{64}$'),payload jsonb not null,actor text not null,
 created_at timestamptz not null default clock_timestamp(),unique(rule_version,week_start,as_of),check(week_end=week_start+interval '7 days' and as_of>=week_end)
);
insert into private.feature_flags(key,enabled,reason) values('edge_scanner',false,'Scanner requires reviewed provider, research configuration and explicit activation'),('auto_publish_docked_edges',false,'Future auto-publication not implemented or activated') on conflict do nothing;

create function private.scanner_assert_actor(p_manage boolean default false) returns uuid language plpgsql set search_path='' as $$
declare actor uuid:=auth.uid();
begin
 if actor is null or not private.active_member_session() or auth.jwt()->>'aal' is distinct from 'aal2'
 or not exists(select 1 from private.roles where user_id=actor and (role in ('owner','admin') or (not p_manage and role='analyst')))
 or not exists(select 1 from public.profiles where id=actor and disabled_at is null)
 or not exists(select 1 from auth.users u where u.id=actor and coalesce(nullif(to_jsonb(u)->>'banned_until','')::timestamptz,'-infinity'::timestamptz)<=clock_timestamp())
 then raise exception 'Current scanner staff MFA required'; end if;
 return actor;
end $$;
create function private.scanner_assert_worker(p_job uuid) returns void language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from private.job_runs j where id=p_job and kind='edge-scan' and state='leased'
 and lease_token::text=current_setting('docked.scanner_lease',true) and id::text=current_setting('docked.scanner_job',true)
 and lease_until>clock_timestamp() and (
  (j.payload->>'origin'='manual' and exists(select 1 from private.roles r join public.profiles p on p.id=r.user_id join auth.users u on u.id=p.id join auth.sessions session on session.user_id=u.id where r.user_id::text=j.payload->>'actorId' and session.id::text=j.payload->>'actorSessionId' and (session.not_after is null or session.not_after>clock_timestamp()) and r.role in ('owner','admin','analyst') and p.disabled_at is null and coalesce(nullif(to_jsonb(u)->>'banned_until','')::timestamptz,'-infinity'::timestamptz)<=clock_timestamp()))
  or (coalesce(j.payload->>'origin','scheduled')='scheduled' and exists(select 1 from private.feature_flags where key='edge_scanner' and enabled))
 )) then raise exception 'Active scanner worker lease and current authorization required'; end if;
end $$;
create function private.scanner_schedule_guard() returns trigger language plpgsql set search_path='' as $$
declare actor uuid;
begin
 if tg_op='DELETE' then raise exception 'Disable scanner schedules; retain history'; end if;
 if tg_op='UPDATE' and current_setting('docked.scanner_scheduler',true)='true'
 and (to_jsonb(new)-array['next_run','updated_at'])=(to_jsonb(old)-array['next_run','updated_at']) then new.updated_at:=clock_timestamp();return new;end if;
 actor:=private.scanner_assert_actor(true);
 if new.configuration->>'id' is distinct from new.id or (new.configuration->>'enabled')::boolean is distinct from new.enabled
 or new.configuration->>'provider' not in ('the-odds-api','odds-papi')
 or not coalesce((new.configuration->>'intervalSeconds')::int between 300 and 86400 and (new.configuration->>'nearIntervalSeconds')::int between 60 and (new.configuration->>'intervalSeconds')::int
 and (new.configuration->>'horizonSeconds')::int between 600 and 604800 and (new.configuration->>'nearEventSeconds')::int between 600 and (new.configuration->>'horizonSeconds')::int and (new.configuration->>'minQuotaRemaining')::int>=0,false)
 or not exists(select 1 from private.strategy_versions where id=new.configuration->>'strategyId')
 or not exists(select 1 from private.region_policies where id=(new.configuration->>'regionPolicyId')::uuid)
 then raise exception 'Bounded reviewed scanner schedule required';end if;
 new.updated_by:=actor;new.updated_at:=clock_timestamp();
 insert into private.audit_events(actor,action,subject,details) values(actor::text,'scanner_schedule',new.id,jsonb_build_object('configuration',new.configuration));return new;
end $$;
create trigger scanner_schedule_guard before insert or update or delete on private.scanner_schedules for each row execute function private.scanner_schedule_guard();
create function private.scanner_run_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'Scanner run audit is retained';end if;
 perform private.scanner_assert_worker(new.job_id);
 if tg_op='UPDATE' and ((to_jsonb(new)-array['status','finished_at','metrics','rejections','error_code']) is distinct from (to_jsonb(old)-array['status','finished_at','metrics','rejections','error_code']) or old.status<>'RUNNING') then raise exception 'Scanner run identity/completion immutable';end if;
 if new.status='RUNNING' then new.finished_at:=null;else new.finished_at:=clock_timestamp();end if;return new;
end $$;
create trigger scanner_run_guard before insert or update or delete on private.scanner_runs for each row execute function private.scanner_run_guard();
create function private.scanner_market_guard() returns trigger language plpgsql set search_path='' as $$
declare run private.scanner_runs;
begin
 select * into run from private.scanner_runs where id=new.run_id for share;perform private.scanner_assert_worker(run.job_id);
 if run.status is distinct from 'RUNNING' or not exists(select 1 from private.markets where id=new.market_id and event_id=new.event_id) then raise exception 'Active canonical scan market required';end if;
 new.created_at:=clock_timestamp();return new;
end $$;
create trigger scanner_market_guard before insert on private.scanner_run_markets for each row execute function private.scanner_market_guard();
create trigger immutable before update or delete on private.scanner_run_markets for each row execute function private.immutable();
create function private.scanner_strategy_allowed(p_strategy text,p_purpose text) returns boolean language sql stable set search_path='' as $$
 select coalesce((select case p_purpose when 'research' then lifecycle in ('RESEARCH','VALIDATED','FROZEN_FOR_FORWARD_PAPER','FORWARD_PAPER','APPROVED_FOR_LIVE')
 when 'paper' then lifecycle='FORWARD_PAPER' and active and frozen_at is not null and research_approved_at is not null
 when 'live' then lifecycle='APPROVED_FOR_LIVE' and active and frozen_at is not null and research_approved_at is not null and paper_approved_at is not null and owner_approved_at is not null else false end from private.strategy_versions where id=p_strategy),false)
$$;
create function private.scanner_candidate_guard() returns trigger language plpgsql set search_path='' as $$
declare run private.scanner_runs;s private.strategy_versions;r private.market_references;m private.markets;e private.events;policy private.region_policies;checked timestamptz;p numeric;
begin
 select * into run from private.scanner_runs where id=new.run_id for share;perform private.scanner_assert_worker(run.job_id);
 select * into s from private.strategy_versions where id=new.strategy_id for share;
 select * into r from private.market_references where id=new.market_reference_id for share;
 select * into m from private.markets where id=new.market_id for share;select * into e from private.events where id=m.event_id for share;
 select * into policy from private.region_policies where id=new.region_policy_id for share;
 perform private.assert_current_market_reference(r.id);checked:=clock_timestamp();
 perform private.scanner_assert_worker(run.job_id);
 if run.status<>'RUNNING' or run.strategy_id is distinct from s.id or run.region_policy_id is distinct from new.region_policy_id or run.purpose is distinct from new.purpose
 or not private.scanner_strategy_allowed(s.id,new.purpose) or s.config->>'method' is distinct from 'market-reference-independent-cohorts'
 or new.strategy_hash is distinct from s.config_hash
 or new.code_commit is distinct from s.code_commit or new.code_commit is distinct from current_setting('docked.scanner_commit',true)
 or r.market_id is distinct from m.id or new.event_id is distinct from e.id or r.region_policy_id is distinct from new.region_policy_id or r.selection is distinct from new.selection
 or r.configuration is distinct from s.config->'marketReference' or r.reference->'pricing' is null or r.reference->'pricing'='null'::jsonb
 or new.model_version is distinct from 'market-reference-baseline-v1' or new.model_evidence->>'referenceHash' is distinct from r.reference->>'evidenceHash'
 or new.model_evidence->>'method' is distinct from 'market-reference-baseline' or new.model_evidence->>'advantageClaim' is distinct from 'false'
 or new.model_evidence->>'validationStatus' is distinct from 'UNVALIDATED' or new.model_evidence->>'independentPredictiveModel' is distinct from 'false'
 or new.purpose='live'
 or new.model_evidence->>'codeCommit' is distinct from new.code_commit or (new.model_evidence->>'probability')::numeric is distinct from (r.reference#>>'{pricing,probability}')::numeric
 or new.model_evidence->>'configHash' is distinct from r.config_hash or new.model_evidence->>'modelId' is distinct from 'market-reference-baseline'
 or new.model_evidence->>'purpose' is distinct from 'RESEARCH_BASELINE' or new.model_evidence->>'selection' is distinct from r.selection or new.model_evidence->>'eventId' is distinct from e.id
 or (new.model_evidence->>'fairPrice')::numeric is distinct from (r.reference#>>'{pricing,fairPrice}')::numeric
 or (new.model_evidence->>'asOfTime')::timestamptz is distinct from r.observed_at or (new.model_evidence->>'generatedAt')::timestamptz is distinct from r.observed_at
 or new.model_evidence->'sourceIds' is distinct from r.reference#>'{pricing,sourceIds}' or new.model_evidence->>'sourceEvidenceHash' is distinct from r.reference->>'evidenceHash'
 or new.model_evidence->>'modelHash' is distinct from encode(sha256(convert_to(private.phase5_canonical_json(jsonb_build_object('id','market-reference-baseline','version',new.model_version,'configHash',r.config_hash,'codeCommit',new.code_commit)),'UTF8')),'hex')
 or not coalesce(policy.approved and not policy.preview_community_only and policy.effective_from<=checked and least(policy.effective_to,policy.review_at)>checked and (case when new.purpose='research' then 'market_data' else 'tips' end)=any(policy.features),false)
 or new.scanned_at is distinct from r.observed_at or new.scanned_at>checked or new.expires_at<=checked
 or new.expires_at>least((r.reference->>'sourceAt')::timestamptz+least(180,(s.config->>'maxAgeSeconds')::int)*interval '1 second',e.start_at-greatest(600,(s.config->>'safetySeconds')::int)*interval '1 second',new.scanned_at+interval '120 seconds')
 then raise exception 'Trusted current scanner research linkage required';end if;
 p:=(r.reference#>>'{pricing,probability}')::numeric;
 if new.probability is distinct from p or abs(new.fair_odds-1/p)>0.00000001 or new.required_ev is distinct from (s.config->>'minEV')::numeric
 or new.minimum_odds is distinct from ceil((1+new.required_ev)/p*100)/100 or abs(new.estimated_ev-(p*r.decimal_price-1))>0.00000001
 or r.decimal_price<new.minimum_odds or r.decimal_price<(s.config->>'minOdds')::numeric or r.decimal_price>(s.config->>'maxOdds')::numeric or new.estimated_ev>(s.config->>'maxEV')::numeric
 or not(s.config->'competitions' ? e.competition_id) or not(s.config->'windowsSeconds' @> to_jsonb(new.window_seconds))
 or extract(epoch from(e.start_at-new.scanned_at))>new.window_seconds or extract(epoch from(e.start_at-new.scanned_at))<new.window_seconds-(s.config->>'windowToleranceSeconds')::int
 then raise exception 'Candidate cannot override the shared strategy calculation';end if;
 new.created_at:=clock_timestamp();return new;
end $$;
create trigger scanner_candidate_guard before insert on private.scanner_candidates for each row execute function private.scanner_candidate_guard();
create trigger immutable before update or delete on private.scanner_candidates for each row execute function private.immutable();
create function private.scanner_review_guard() returns trigger language plpgsql set search_path='' as $$
declare c private.scanner_candidates;s private.strategy_versions;r private.market_references;e private.events;policy private.region_policies;last_status text;actor uuid;checked timestamptz;
begin
 select * into c from private.scanner_candidates where id=new.candidate_id for update;
 select status into last_status from private.scanner_reviews where candidate_id=c.id order by created_at desc,id desc limit 1;
 if c.id is null or last_status in ('APPROVED','REJECTED','EXPIRED','INVALIDATED') then raise exception 'Candidate is final';end if;
 if new.status in ('EXPIRED','INVALIDATED') and current_setting('docked.scanner_scheduler',true)='true' then new.actor:=null;
 else actor:=private.scanner_assert_actor(false);if new.actor is distinct from actor then raise exception 'Review actor mismatch';end if;end if;
 if new.status='APPROVED' then
  select * into s from private.strategy_versions where id=c.strategy_id for share;
  select * into r from private.market_references where id=new.market_reference_id for share;
  select * into e from private.events where id=c.event_id for share;
  select * into policy from private.region_policies where id=c.region_policy_id for share;
  perform private.assert_current_market_reference(r.id);
  perform private.scanner_assert_actor(false);checked:=clock_timestamp();
  if c.expires_at<=checked or not private.scanner_strategy_allowed(c.strategy_id,c.purpose) or (c.purpose='live' and c.model_evidence->>'validationStatus' is distinct from 'VALIDATED')
   or s.config_hash is distinct from c.strategy_hash or s.code_commit is distinct from c.code_commit or c.code_commit is distinct from current_setting('docked.scanner_commit',true)
   or r.market_id is distinct from c.market_id or r.selection is distinct from c.selection or r.region_policy_id is distinct from c.region_policy_id
   or r.configuration is distinct from s.config->'marketReference' or r.reference->'pricing' is null or r.reference->'pricing'='null'::jsonb
   or r.decimal_price<ceil((1+(s.config->>'minEV')::numeric)/(r.reference#>>'{pricing,probability}')::numeric*100)/100
   or (r.reference#>>'{pricing,probability}')::numeric*r.decimal_price-1>(s.config->>'maxEV')::numeric
   or r.decimal_price<(s.config->>'minOdds')::numeric or r.decimal_price>(s.config->>'maxOdds')::numeric
   or extract(epoch from(e.start_at-r.observed_at))>c.window_seconds or extract(epoch from(e.start_at-r.observed_at))<c.window_seconds-(s.config->>'windowToleranceSeconds')::int
   or not coalesce(policy.approved and not policy.preview_community_only and policy.effective_from<=checked and least(policy.effective_to,policy.review_at)>checked and (case when c.purpose='research' then 'market_data' else 'tips' end)=any(policy.features),false)
  then raise exception 'Candidate no longer qualifies';end if;
  if c.purpose='research' and new.publication_id is not null then raise exception 'Research review cannot publish';end if;
  if c.purpose<>'research' and not exists(select 1 from private.tip_publications t where t.id=new.publication_id and t.event_id=c.event_id and t.strategy_id=c.strategy_id and t.approved_by=actor and t.evidence::text=case when c.purpose='paper' then 'forward_paper' else 'live_published' end and t.market_reference_id=r.id) then raise exception 'Gated immutable publication required';end if;
  new.evidence:=jsonb_build_object('referenceId',r.id,'referenceHash',r.reference->>'evidenceHash','probability',r.reference#>>'{pricing,probability}','marketPrice',r.decimal_price,'strategyHash',s.config_hash,'purpose',c.purpose);
 elsif new.publication_id is not null then raise exception 'Only approval can link publication';end if;
 new.created_at:=clock_timestamp();insert into private.audit_events(actor,action,subject,details) values(coalesce(new.actor::text,'scanner'),'scanner_candidate_review',c.id::text,jsonb_build_object('status',new.status,'purpose',c.purpose,'reason',new.reason));return new;
end $$;
create trigger scanner_review_guard before insert on private.scanner_reviews for each row execute function private.scanner_review_guard();
create trigger immutable before update or delete on private.scanner_reviews for each row execute function private.immutable();
create trigger immutable before update or delete on private.operational_alerts for each row execute function private.immutable();
create function private.recognition_snapshot_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if current_setting('docked.scanner_scheduler',true) is distinct from 'true' then perform private.scanner_assert_actor(false);end if;
 if new.as_of>clock_timestamp() or new.week_end>new.as_of or date_trunc('week',new.week_start at time zone 'UTC') is distinct from new.week_start at time zone 'UTC'
 or new.payload_hash is distinct from encode(sha256(convert_to(private.phase5_canonical_json(new.payload),'UTF8')),'hex') then raise exception 'Complete-week canonical recognition evidence required';end if;
 return new;
end $$;
create trigger recognition_snapshot_guard before insert on private.community_recognition_snapshots for each row execute function private.recognition_snapshot_guard();
create trigger immutable before update or delete on private.community_recognition_snapshots for each row execute function private.immutable();
do $$ declare t text;begin foreach t in array array['scanner_schedules','scanner_runs','scanner_run_markets','scanner_candidates','scanner_reviews','operational_alerts','community_recognition_snapshots'] loop execute format('alter table private.%I enable row level security',t);execute format('revoke all on private.%I from public,anon,authenticated',t);end loop;end $$;
revoke all on function private.scanner_assert_actor(boolean),private.scanner_assert_worker(uuid),private.scanner_schedule_guard(),private.scanner_run_guard(),private.scanner_market_guard(),private.scanner_strategy_allowed(text,text),private.scanner_candidate_guard(),private.scanner_review_guard(),private.recognition_snapshot_guard() from public,anon,authenticated;

create table private.market_data_config(
 id uuid primary key default gen_random_uuid(),provider text not null check(provider in ('the-odds-api','odds-papi')),
 version text not null,config_hash text not null check(config_hash ~ '^[a-f0-9]{64}$'),configuration jsonb not null,
 enabled boolean not null default false,effective_from timestamptz not null,effective_to timestamptz not null,
 rights_reference text not null check(length(btrim(rights_reference))>=5),reviewed_by uuid not null,created_at timestamptz not null default clock_timestamp(),
 unique(provider,version),check(effective_to>effective_from)
);
create unique index market_data_one_enabled_provider on private.market_data_config(provider) where enabled;
create table private.market_data_payloads(
 id text primary key check(id ~ '^[a-f0-9]{64}$'),provider text not null,payload jsonb not null,
 received_at timestamptz not null,rights_reference text not null,retain_until timestamptz not null
);
create table private.market_data_event_mappings(
 provider text not null,provider_event_id text not null,event_id text not null references private.events(id),
 provider_competition_id text not null,canonical_competition_id text not null references private.competitions(id),mapping_evidence text not null,
 created_at timestamptz not null default clock_timestamp(),primary key(provider,provider_event_id),unique(provider,event_id)
);
create table private.market_data_fixture_observations(
 id text primary key check(id ~ '^[a-f0-9]{64}$'),provider text not null,event_id text not null references private.events(id),provider_event_id text not null,
 observed_at timestamptz not null,payload jsonb not null,raw_payload_id text not null,
 foreign key(provider,provider_event_id) references private.market_data_event_mappings(provider,provider_event_id)
);
create index market_data_fixture_latest on private.market_data_fixture_observations(event_id,observed_at desc,id desc);
create function private.market_data_config_guard() returns trigger language plpgsql set search_path='' as $$
declare actor uuid;
begin
 actor:=private.scanner_assert_actor(true);
 if tg_op='DELETE' then raise exception 'Provider configuration history is retained';end if;
 if tg_op='UPDATE' and (not old.enabled or new.enabled or (to_jsonb(new)-'enabled') is distinct from (to_jsonb(old)-'enabled')) then raise exception 'Material provider changes require a new reviewed version';end if;
 if tg_op='INSERT' and (new.reviewed_by is distinct from actor or new.configuration->>'provider' is distinct from new.provider or new.configuration->>'version' is distinct from new.version
 or new.config_hash is distinct from encode(sha256(convert_to(private.phase5_canonical_json(new.configuration),'UTF8')),'hex')
 or new.configuration#>>'{rights,reference}' is distinct from new.rights_reference
 or not coalesce(new.configuration#>>'{rights,display}'='true' and new.configuration#>>'{rights,storage}'='true' and new.configuration#>>'{rights,derived}'='true'
 and (new.configuration#>>'{rights,rawRetentionDays}')::int between 1 and 30 and (new.configuration->>'monthlyCreditLimit')::int between 1 and 1000000
 and (new.configuration->>'pollIntervalSeconds')::int between 60 and 86400 and (new.configuration->>'horizonHours')::int between 1 and 168
 and (new.configuration->>'maxEvents')::int between 1 and 100 and (new.configuration->>'maxRequestsPerRun')::int between 1 and 20,false)
 or jsonb_typeof(new.configuration->'competitions') is distinct from 'array' or jsonb_array_length(new.configuration->'competitions')<1
 or jsonb_typeof(new.configuration->'bookmakers') is distinct from 'object') then raise exception 'Reviewed bounded provider rights/configuration required';end if;
 insert into private.audit_events(actor,action,subject,details) values(actor::text,'market_data_configuration',new.id::text,jsonb_build_object('provider',new.provider,'version',new.version,'enabled',new.enabled,'configHash',new.config_hash));return new;
end $$;
create trigger market_data_config_guard before insert or update or delete on private.market_data_config for each row execute function private.market_data_config_guard();
create function private.market_data_payload_guard() returns trigger language plpgsql set search_path='' as $$
declare c private.market_data_config;checked timestamptz;
begin
 if tg_op='DELETE' then
  if current_setting('docked.market_data_retention',true)='purge_expired' and old.retain_until<=clock_timestamp() then return old;end if;
  raise exception 'Only expired licensed raw payload purge is supported';
 end if;
 if tg_op='UPDATE' then raise exception 'Provider payloads are immutable';end if;
 select * into c from private.market_data_config where provider=new.provider and enabled for share;checked:=clock_timestamp();
 if c.id is null or c.effective_from>checked or c.effective_to<=checked or new.rights_reference is distinct from c.rights_reference
 or new.received_at>checked or new.received_at<checked-interval '5 minutes' or new.retain_until<=new.received_at
 or new.retain_until>least(new.received_at+(c.configuration#>>'{rights,rawRetentionDays}')::int*interval '1 day',c.effective_to)
 or new.id is distinct from encode(sha256(convert_to(private.phase5_canonical_json(jsonb_build_object('provider',new.provider,'payload',new.payload,'receivedAt',to_char(new.received_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))),'UTF8')),'hex') then raise exception 'Licensed bounded raw retention required';end if;
 return new;
end $$;
create trigger market_data_payload_guard before insert or update or delete on private.market_data_payloads for each row execute function private.market_data_payload_guard();
create function private.purge_expired_market_payloads() returns integer language plpgsql set search_path='' as $$
declare total integer;
begin
 perform set_config('docked.market_data_retention','purge_expired',true);
 delete from private.market_data_payloads where id in(select id from private.market_data_payloads where retain_until<=clock_timestamp() order by retain_until limit 500 for update skip locked);
 get diagnostics total=row_count;perform set_config('docked.market_data_retention','',true);return total;
end $$;
create function private.market_data_mapping_guard() returns trigger language plpgsql set search_path='' as $$
declare c private.market_data_config;e private.events;match jsonb;
begin
 select * into c from private.market_data_config where provider=new.provider and enabled and effective_from<=clock_timestamp() and effective_to>clock_timestamp() for share;
 select * into e from private.events where id=new.event_id for share;
 select value into match from jsonb_array_elements(c.configuration->'competitions') where value->>'providerCompetitionId'=new.provider_competition_id;
 if c.id is null or e.id is null or match is null or new.canonical_competition_id is distinct from e.competition_id
 or match->>'competitionId' is distinct from new.canonical_competition_id or match->>'mappingEvidence' is distinct from new.mapping_evidence
 or e.source_mappings->>new.provider is distinct from new.provider_event_id or c.effective_to<=clock_timestamp() then raise exception 'Reviewed exact provider event mapping required';end if;return new;
end $$;
create trigger market_data_mapping_guard before insert on private.market_data_event_mappings for each row execute function private.market_data_mapping_guard();
create trigger immutable before update or delete on private.market_data_event_mappings for each row execute function private.immutable();
create function private.market_data_fixture_guard() returns trigger language plpgsql set search_path='' as $$
declare r private.market_data_payloads;m private.market_data_event_mappings;
begin
 select * into r from private.market_data_payloads where id=new.raw_payload_id for share;
 select * into m from private.market_data_event_mappings where provider=new.provider and provider_event_id=new.provider_event_id for share;
 if r.id is null or m.event_id is distinct from new.event_id or r.provider is distinct from new.provider or new.observed_at is distinct from r.received_at or r.retain_until<=clock_timestamp()
 or new.payload->>'providerEventId' is distinct from new.provider_event_id or new.payload->>'provider' is distinct from new.provider
 or new.id is distinct from encode(sha256(convert_to(private.phase5_canonical_json(jsonb_build_object('provider',new.provider,'eventId',new.event_id,'fixture',new.payload)),'UTF8')),'hex')
 then raise exception 'Canonical fixture requires retained licensed observation';end if;return new;
end $$;
create trigger market_data_fixture_guard before insert on private.market_data_fixture_observations for each row execute function private.market_data_fixture_guard();
create trigger immutable before update or delete on private.market_data_fixture_observations for each row execute function private.immutable();
create function private.market_data_snapshot_guard() returns trigger language plpgsql set search_path='' as $$
declare c private.market_data_config;r private.market_data_payloads;m private.markets;e private.events;b jsonb;checked timestamptz;
begin
 if new.evidence::text is distinct from 'market_data' then return new;end if;
 select * into c from private.market_data_config where provider=new.provider and enabled for share;
 select * into r from private.market_data_payloads where id=substring(new.raw_private_path from 4) and new.raw_private_path like 'db:%' for share;
 select * into m from private.markets where id=new.market_id for share;select * into e from private.events where id=m.event_id for share;
 checked:=clock_timestamp();b:=c.configuration->'bookmakers'->new.bookmaker;
 if c.id is null or r.id is null or m.id is null or e.id is null or c.effective_from>checked or c.effective_to<=checked or r.retain_until<=checked
 or r.provider is distinct from new.provider or new.provenance is distinct from c.rights_reference or r.rights_reference is distinct from c.rights_reference
 or new.received_at is distinct from r.received_at or new.payload->'rules' is distinct from m.rules
 or e.status is distinct from 'scheduled' or new.payload->>'id' is distinct from new.id or new.payload->>'rawPayloadId' is distinct from r.id
 or (new.payload->>'sourceAt')::timestamptz is distinct from new.source_at or (new.payload->>'snapshotAt')::timestamptz is distinct from new.snapshot_at or (new.payload->>'receivedAt')::timestamptz is distinct from new.received_at
 or new.payload->>'bookmaker' is distinct from new.bookmaker or new.payload->>'operator' is distinct from b->>'operator'
 or b is null or not coalesce((b->>'knownAt')::timestamptz<=new.received_at and (b->>'effectiveFrom')::timestamptz<=new.received_at and (b->>'effectiveTo')::timestamptz>checked,false)
 or not exists(select 1 from private.market_data_event_mappings where provider=new.provider and event_id=e.id)
 then raise exception 'Current market observation requires reviewed retained provider provenance';end if;
 if new.payload ? 'communityMetadata' and (new.payload#>>'{communityMetadata,sourceKind}' is distinct from 'current_provider'
 or new.payload#>>'{communityMetadata,sourceType}' is distinct from b->>'sourceType'
 or new.payload#>>'{communityMetadata,priceClass}' is distinct from b->>'classification'
 or new.payload#>>'{communityMetadata,classificationVersion}' is distinct from b->>'classificationVersion'
 or new.payload#>>'{communityMetadata,classificationEvidence}' is distinct from b->>'classificationEvidence'
 or new.payload#>>'{communityMetadata,providerEventId}' is distinct from e.source_mappings->>new.provider
 or (new.payload#>>'{communityMetadata,observedStartAt}')::timestamptz is distinct from e.start_at
 or new.payload#>>'{communityMetadata,receivedByDocked}' is distinct from 'true'
 or new.payload#>'{communityMetadata,promotionFlags}' is distinct from case when b->>'classification'='STANDARD_VERIFIED' then '[]'::jsonb else jsonb_build_array(b->>'classification') end) then raise exception 'Provider classification cannot be upgraded';end if;
 return new;
end $$;
create trigger market_data_snapshot_guard before insert on private.odds_snapshots for each row execute function private.market_data_snapshot_guard();
do $$ declare t text;begin foreach t in array array['market_data_config','market_data_payloads','market_data_event_mappings','market_data_fixture_observations'] loop execute format('alter table private.%I enable row level security',t);execute format('revoke all on private.%I from public,anon,authenticated',t);end loop;end $$;
revoke all on function private.market_data_config_guard(),private.market_data_payload_guard(),private.purge_expired_market_payloads(),private.market_data_mapping_guard(),private.market_data_fixture_guard(),private.market_data_snapshot_guard() from public,anon,authenticated;

-- Reuse the reviewed evidence guards. Only their current-observation discriminator changes;
-- publication lifecycle, source re-derivation, clock, rights and immutable ledger checks remain identical.
create function private.market_data_source_current(p_snapshot text,p_at timestamptz) returns boolean language sql stable set search_path='' as $$
 select coalesce((select q.evidence::text<>'market_data' or exists(
 select 1 from private.market_data_config c join private.market_data_payloads raw on raw.id=substring(q.raw_private_path from 4)
 join private.markets m on m.id=q.market_id join private.events e on e.id=m.event_id
 join private.market_data_event_mappings map on map.provider=q.provider and map.event_id=e.id
 where c.provider=q.provider and c.enabled and c.effective_from<=p_at and c.effective_to>p_at and c.created_at<=q.received_at
 and q.received_at>=c.effective_from and c.rights_reference=q.provenance and raw.rights_reference=c.rights_reference and raw.retain_until>p_at and raw.provider=q.provider
 and exists(select 1 from jsonb_array_elements(c.configuration->'competitions') cfg where cfg->>'competitionId'=e.competition_id and cfg->>'providerCompetitionId'=map.provider_competition_id and cfg->>'mappingEvidence'=map.mapping_evidence)
 and c.configuration#>>array['bookmakers',q.bookmaker,'operator']=q.payload->>'operator'
 and c.configuration#>>array['bookmakers',q.bookmaker,'sourceType']=q.payload#>>'{communityMetadata,sourceType}'
 and c.configuration#>>array['bookmakers',q.bookmaker,'classification']=q.payload#>>'{communityMetadata,priceClass}'
 and c.configuration#>>array['bookmakers',q.bookmaker,'classificationVersion']=q.payload#>>'{communityMetadata,classificationVersion}'
 and c.configuration#>>array['bookmakers',q.bookmaker,'classificationEvidence']=q.payload#>>'{communityMetadata,classificationEvidence}'
 and (c.configuration#>>array['bookmakers',q.bookmaker,'knownAt'])::timestamptz<=q.received_at
 and (c.configuration#>>array['bookmakers',q.bookmaker,'effectiveFrom'])::timestamptz<=q.received_at
 and (c.configuration#>>array['bookmakers',q.bookmaker,'effectiveTo'])::timestamptz>p_at
 ) from private.odds_snapshots q where q.id=p_snapshot),false)
$$;
create function private.market_data_lock_sources(p_market text) returns void language plpgsql set search_path='' as $$
begin
 perform 1 from private.market_data_config where provider in(select provider from private.odds_snapshots where market_id=p_market and evidence::text='market_data') order by provider,id for share;
end $$;
revoke all on function private.market_data_source_current(text,timestamptz),private.market_data_lock_sources(text) from public,anon,authenticated;
do $$ declare signature text; definition text; changed text;
begin
 foreach signature in array array['private.reference_cohort_sources(text,jsonb,uuid,timestamptz,text)','private.market_reference_guard()','private.community_quote_evidence_guard()'] loop
  definition:=pg_get_functiondef(signature::regprocedure);
  changed:=replace(replace(replace(definition,'q.evidence not in (''forward_paper'',''live_published'')','q.evidence::text not in (''market_data'',''forward_paper'',''live_published'')'),
   'q.evidence in (''forward_paper'',''live_published'')','q.evidence::text in (''market_data'',''forward_paper'',''live_published'')'),
   'evidence in (''forward_paper'',''live_published'')','evidence::text in (''market_data'',''forward_paper'',''live_published'')');
  if definition=changed then raise exception 'Current evidence guard upgrade mismatch';end if;
  if signature='private.reference_cohort_sources(text,jsonb,uuid,timestamptz,text)' then
   changed:=replace(changed,'where p_config->p_cohort ? q.bookmaker','where private.market_data_source_current(q.id,p_at) and p_config->p_cohort ? q.bookmaker');
  elsif signature='private.market_reference_guard()' then
   changed:=replace(changed,' select * into m from private.markets where id=new.market_id for update;',' perform private.market_data_lock_sources(new.market_id); select * into m from private.markets where id=new.market_id for update;');
   changed:=replace(changed,'if q.id is null or q.market_id','if not private.market_data_source_current(q.id,checked) or q.id is null or q.market_id');
  end if;
  execute changed;
 end loop;
 definition:=pg_get_functiondef('private.assert_current_market_reference(uuid)'::regprocedure);
 changed:=replace(definition,' perform 1 from private.markets where id=r.market_id for update;',' perform private.market_data_lock_sources(r.market_id); perform 1 from private.markets where id=r.market_id for update;');
 if definition=changed then raise exception 'Reference authority lock upgrade mismatch';end if;execute changed;
end $$;
