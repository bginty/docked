-- Community opinions have their own canonical ledger. Official publications are untouched.
create table private.community_verification_rules (
  version text primary key, cutoff_seconds integer not null check(cutoff_seconds>=600),
  max_age_seconds integer not null check(max_age_seconds between 1 and 180),
  standard_units numeric not null check(standard_units=1), created_at timestamptz not null default clock_timestamp()
);
insert into private.community_verification_rules values('community-standard-v1',600,180,1,clock_timestamp());
insert into private.feature_flags(key,enabled,reason) values('community_edges',false,'Requires licensed standard-price metadata and community jurisdiction approval') on conflict do nothing;

create table private.community_quote_evidence (
  id uuid primary key default gen_random_uuid(), snapshot_id text not null unique references private.odds_snapshots(id),
  provider_event_id text not null, observed_start_at timestamptz not null,
  classification text not null check(classification in ('STANDARD_VERIFIED','PROMOTIONAL_EXCLUDED','UNVERIFIED','STALE','MARKET_MISMATCH','UNSUPPORTED','POST_CUTOFF','UNKNOWN_REVIEW')),
  classification_version text not null, classification_evidence text not null,
  rights_reference text not null, metadata jsonb not null, created_at timestamptz not null default clock_timestamp()
);
create function private.community_quote_evidence_guard() returns trigger language plpgsql set search_path='' as $$
declare q private.odds_snapshots; e private.events; m private.markets; h private.source_health; meta jsonb;
begin
  select * into q from private.odds_snapshots where id=new.snapshot_id for share;
  select * into m from private.markets where id=q.market_id for share;
  select * into e from private.events where id=m.event_id for share;
  select * into h from private.source_health where provider=q.provider for share;
  meta:=q.payload->'communityMetadata';
  if q.id is null or q.evidence not in ('forward_paper','live_published') or q.provenance is distinct from h.rights_reference
    or h.rights_reference is null or not coalesce((h.capabilities->>'display')::boolean,false)
    or not coalesce((h.capabilities->>'retention')::boolean,false) or not coalesce((h.capabilities->>'community_standard_prices')::boolean,false)
    or meta is null or meta->>'sourceKind' is distinct from 'current_provider' or meta->>'receivedByDocked' is distinct from 'true'
    or meta->>'providerEventId' is distinct from e.source_mappings->>q.provider
    or meta->>'priceClass' is null or jsonb_typeof(meta->'promotionFlags') is distinct from 'array'
    or length(coalesce(meta->>'classificationEvidence',''))<5 or length(coalesce(meta->>'classificationVersion',''))<3
    then raise exception 'Trusted licensed standard-price metadata unavailable: UNKNOWN_REVIEW'; end if;
  new.provider_event_id:=meta->>'providerEventId';
  new.observed_start_at:=(meta->>'observedStartAt')::timestamptz;
  if new.observed_start_at is distinct from e.start_at then raise exception 'Observed event start mismatch'; end if;
  new.classification:=case when jsonb_array_length(meta->'promotionFlags')>0 then 'PROMOTIONAL_EXCLUDED' else meta->>'priceClass' end;
  new.classification_version:=meta->>'classificationVersion'; new.classification_evidence:=meta->>'classificationEvidence';
  new.metadata:=meta; new.rights_reference:=h.rights_reference; new.created_at:=clock_timestamp(); return new;
end $$;
create trigger community_quote_evidence_guard before insert on private.community_quote_evidence for each row execute function private.community_quote_evidence_guard();

create table private.community_edges (
  id uuid primary key default gen_random_uuid(), profile_id uuid not null references private.social_profiles(id),
  event_id text not null references private.events(id), market_id text not null references private.markets(id),
  snapshot_id text not null references private.odds_snapshots(id), quote_evidence_id uuid not null references private.community_quote_evidence(id),
  provider text not null, provider_event_id text not null, bookmaker text not null, selection text not null,
  market_rules jsonb not null, sport text not null, competition text not null,
  odds numeric not null check(odds>1 and odds<=1000), standard_units numeric not null default 1 check(standard_units=1),
  classification text not null default 'STANDARD_VERIFIED' check(classification='STANDARD_VERIFIED'),
  verification_rule text not null references private.community_verification_rules(version),
  start_at timestamptz not null, source_at timestamptz not null, snapshot_at timestamptz not null, received_at timestamptz not null,
  submitted_at timestamptz not null default clock_timestamp(), region_policy_id uuid not null references private.region_policies(id),
  confirmed_permanent boolean not null check(confirmed_permanent), review_hash text not null check(length(review_hash)=64),
  idempotency_key uuid not null, request_hash text not null check(length(request_hash)=64),
  unique(profile_id,idempotency_key), unique(profile_id,event_id)
);
create index on private.community_edges(submitted_at desc,id desc);
create index on private.community_edges(profile_id,submitted_at desc);
create index on private.community_edges(sport,submitted_at desc);
alter table private.social_posts add constraint social_posts_community_edge_fk foreign key(community_edge_id) references private.community_edges(id);
create function private.community_submission_retry(p_profile uuid,p_key uuid,p_hash text) returns uuid language plpgsql set search_path='' as $$
declare profile private.social_profiles; existing private.community_edges;
begin
  select * into profile from private.social_profiles where id=p_profile for update;
  if profile.user_id is null or private.community_actor(profile.user_id,'community_edges',true) is distinct from p_profile then raise exception 'Community author mismatch'; end if;
  select * into existing from private.community_edges where profile_id=p_profile and idempotency_key=p_key;
  if existing.id is not null and existing.request_hash is distinct from p_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  return existing.id;
end $$;

create function private.community_edge_guard() returns trigger language plpgsql set search_path='' as $$
declare q private.odds_snapshots; v private.community_quote_evidence; e private.events; m private.markets; h private.source_health;
  p private.social_profiles; r private.region_policies; rule private.community_verification_rules; checked_at timestamptz; latest text; author uuid;
begin
  checked_at:=clock_timestamp();
  if not coalesce((select enabled from private.feature_flags where key='community_edges'),false) then raise exception 'Community Edge publication paused'; end if;
  select * into p from private.social_profiles where id=new.profile_id for update;
  if p.id is null or p.is_official or p.user_id is null then raise exception 'Community member required'; end if;
  author:=private.community_actor(p.user_id,'community_edges',true);
  if author is distinct from p.id then raise exception 'Community author mismatch'; end if;
  select * into rule from private.community_verification_rules where version=new.verification_rule for share;
  if rule.version is distinct from 'community-standard-v1' then raise exception 'Unsupported verification rule'; end if;
  select * into e from private.events where id=new.event_id for share;
  select * into m from private.markets where id=new.market_id for update;
  -- Every trusted ingestion and confirmation for this market shares the market row lock.
  select * into q from private.odds_snapshots where id=new.snapshot_id for share;
  select * into v from private.community_quote_evidence where id=new.quote_evidence_id for share;
  select * into h from private.source_health where provider=q.provider for share;
  select * into r from private.region_policies where id=new.region_policy_id for share;
  perform 1 from private.bookmaker_eligibility b where b.bookmaker=q.bookmaker and b.region_policy_id=r.id for share;
  perform 1 from private.feature_flags where key='community_edges' for share;
  -- A contended transaction may have crossed the cutoff while waiting for any lock.
  checked_at:=clock_timestamp();
  if not coalesce((select enabled from private.feature_flags where key='community_edges'),false) then raise exception 'Community Edge publication paused'; end if;
  select id into latest from private.odds_snapshots where market_id=m.id and bookmaker=q.bookmaker and provider=q.provider
    and evidence in ('forward_paper','live_published') order by source_at desc,received_at desc,id desc limit 1;
  if q.id is null or q.id is distinct from latest or v.snapshot_id is distinct from q.id or q.market_id is distinct from m.id
    or m.event_id is distinct from e.id or q.evidence not in ('forward_paper','live_published')
    or v.classification<>'STANDARD_VERIFIED' or jsonb_array_length(v.metadata->'promotionFlags')<>0
    or v.observed_start_at is distinct from e.start_at or v.provider_event_id is distinct from e.source_mappings->>q.provider
    or q.payload->'rules' is distinct from m.rules or q.payload->>'id' is distinct from q.id
    or q.payload->>'bookmaker' is distinct from q.bookmaker or coalesce((q.payload->>'suspended')::boolean,true)
    then raise exception 'Current provider market evidence mismatch or non-standard price'; end if;
  if not coalesce(h.healthy,false) or h.last_success is null or h.last_success>checked_at or h.last_success<checked_at-interval '3 minutes'
    or h.rights_reference is distinct from v.rights_reference or h.rights_reference is distinct from q.provenance
    or not coalesce((h.capabilities->>'community_standard_prices')::boolean,false)
    or not coalesce((h.capabilities->>'display')::boolean,false) or not coalesce((h.capabilities->>'retention')::boolean,false)
    then raise exception 'Licensed provider health unavailable'; end if;
  if r.id is null or not r.approved or r.effective_from>checked_at or r.effective_to<=checked_at or r.review_at<=checked_at
    or r.id is distinct from (select rp.id from private.region_policies rp join public.profiles a on a.country=rp.country and a.state=rp.state where a.id=p.user_id and rp.effective_from<=checked_at and rp.effective_to>checked_at order by rp.effective_from desc,rp.id desc limit 1)
    or r.minimum_age>18 or not ('community_edges'=any(r.features)) or not(q.bookmaker=any(r.operators))
    or not exists(select 1 from public.profiles a where a.id=p.user_id and a.country=r.country and a.state=r.state and a.age_attested and a.disabled_at is null)
    then raise exception 'Community jurisdiction denied'; end if;
  perform 1 from private.bookmaker_eligibility b where b.bookmaker=q.bookmaker and b.region_policy_id=r.id and b.approved and b.effective_from<=checked_at and b.effective_to>checked_at for share;
  if not found then raise exception 'Bookmaker approval unavailable'; end if;
  if e.status<>'scheduled' or e.start_at<=checked_at+rule.cutoff_seconds*interval '1 second' then raise exception 'EDGE SUBMISSIONS CLOSED'; end if;
  if q.source_at>q.snapshot_at or q.snapshot_at>q.received_at or q.received_at>checked_at
    or q.source_at<checked_at-rule.max_age_seconds*interval '1 second' or q.received_at<checked_at-rule.max_age_seconds*interval '1 second'
    or (q.payload->>'sourceAt')::timestamptz is distinct from q.source_at or (q.payload->>'snapshotAt')::timestamptz is distinct from q.snapshot_at
    or (q.payload->>'receivedAt')::timestamptz is distinct from q.received_at then raise exception 'STALE quote or timestamp mismatch'; end if;
  if m.rules->>'period'<>'full_game' or m.rules->'line' is distinct from 'null'::jsonb or not (m.rules->'outcomes' ? new.selection)
    or (m.rules->>'eventId') is distinct from e.id or (m.rules->>'competition') is distinct from e.competition_id
    or m.rules->'participants' is distinct from e.participants
    or not exists(select 1 from private.competitions where id=e.competition_id and sport_id=case when e.competition_id='basketball_nba' then 'basketball' else 'football' end)
    or jsonb_array_length(m.rules->'participants')<>2 or m.rules->'participants'->>0=m.rules->'participants'->>1
    or (select jsonb_agg(o order by o) from jsonb_array_elements_text(m.rules->'outcomes') o)
      is distinct from (select jsonb_agg(o order by o) from jsonb_array_elements_text(m.rules->'participants' || case when m.rules->>'market'='football_1x2' then '["Draw"]'::jsonb else '[]'::jsonb end) o)
    or not ((e.competition_id in ('soccer_epl','soccer_spain_la_liga') and m.rules->>'market'='football_1x2' and m.rules->>'settlement'='regulation_90_plus_stoppage' and m.rules->>'overtime'='false' and m.rules->>'draw'='true')
      or (e.competition_id='basketball_nba' and m.rules->>'market'='nba_moneyline' and m.rules->>'settlement'='full_game_including_overtime' and m.rules->>'overtime'='true' and m.rules->>'draw'='false'))
    then raise exception 'Unsupported or mismatched community settlement rules'; end if;
  if (select count(*) from jsonb_object_keys(q.payload->'prices'))<>jsonb_array_length(m.rules->'outcomes')
    or exists(select 1 from jsonb_array_elements_text(m.rules->'outcomes') o where not(q.payload->'prices' ? o) or (q.payload->'prices'->>o)::numeric<=1 or (q.payload->'prices'->>o)::numeric>1000)
    or new.odds is distinct from (q.payload->'prices'->>new.selection)::numeric then raise exception 'Verified provider price required'; end if;
  new.provider:=q.provider; new.provider_event_id:=v.provider_event_id; new.bookmaker:=q.bookmaker;
  new.market_rules:=m.rules; new.competition:=e.competition_id;
  select sport_id into new.sport from private.competitions where id=e.competition_id;
  new.start_at:=e.start_at; new.source_at:=q.source_at; new.snapshot_at:=q.snapshot_at; new.received_at:=q.received_at;
  new.submitted_at:=checked_at; new.standard_units:=1; new.classification:='STANDARD_VERIFIED'; return new;
end $$;
create trigger community_edge_guard before insert on private.community_edges for each row execute function private.community_edge_guard();

-- Row lock serializes new quote ingestion with the final confirmation transaction.
create function private.community_snapshot_lock() returns trigger language plpgsql set search_path='' as $$
begin perform 1 from private.markets where id=new.market_id for update; return new; end $$;
create trigger community_snapshot_lock before insert on private.odds_snapshots for each row execute function private.community_snapshot_lock();

create table private.community_edge_status (
  id uuid primary key default gen_random_uuid(), edge_id uuid not null references private.community_edges(id),
  status text not null check(status in ('PENDING','INTEGRITY_REVIEW','INTEGRITY_CLEARED','MANUAL_REVIEW')),
  actor text not null, reason text not null check(length(reason)>=10), created_at timestamptz not null default clock_timestamp()
);
create index on private.community_edge_status(edge_id,created_at desc,id desc);
create function private.community_status_guard() returns trigger language plpgsql set search_path='' as $$
declare author uuid;
begin
  select p.user_id into author from private.community_edges e join private.social_profiles p on p.id=e.profile_id where e.id=new.edge_id for update of e;
  if new.status='PENDING' then
    if new.actor is distinct from author::text or auth.uid() is distinct from author or not private.active_member_session()
      or exists(select 1 from private.community_edge_status where edge_id=new.edge_id) then raise exception 'Initial pending status only'; end if;
  elsif new.actor is distinct from auth.uid()::text or auth.jwt()->>'aal' is distinct from 'aal2' or not private.active_member_session()
    or not exists(select 1 from private.roles where user_id=auth.uid() and role in ('owner','admin')) then raise exception 'Administrator integrity review required'; end if;
  new.created_at:=clock_timestamp();
  insert into private.audit_events(actor,action,subject,details) values(new.actor,'community_integrity_status',new.edge_id::text,jsonb_build_object('status',new.status,'reason',new.reason));
  return new;
end $$;
create trigger community_status_guard before insert on private.community_edge_status for each row execute function private.community_status_guard();
create table private.community_result_sources (
  id uuid primary key default gen_random_uuid(), provider text not null, rights_reference text not null, approved boolean not null default false,
  reviewed_by uuid not null, review_at timestamptz not null, reason text not null check(length(reason)>=10), created_at timestamptz not null default clock_timestamp()
);
create index on private.community_result_sources(provider,created_at desc,id desc);
create function private.community_result_source_guard() returns trigger language plpgsql set search_path='' as $$
begin
  if new.reviewed_by is distinct from auth.uid() or auth.jwt()->>'aal' is distinct from 'aal2' or not private.active_member_session()
    or not exists(select 1 from private.roles where user_id=auth.uid() and role in ('owner','admin')) then raise exception 'Administrator provider-rights review required'; end if;
  perform pg_advisory_xact_lock(hashtext('community-results:'||new.provider));
  new.created_at:=clock_timestamp();
  insert into private.audit_events(actor,action,subject,details) values(new.reviewed_by::text,'community_results_rights',new.provider,jsonb_build_object('approved',new.approved,'reason',new.reason,'approvalId',new.id));
  return new;
end $$;
create trigger community_result_source_guard before insert on private.community_result_sources for each row execute function private.community_result_source_guard();
create table private.community_settlements (
  id uuid primary key default gen_random_uuid(), edge_id uuid not null references private.community_edges(id),
  result text not null check(result in ('WON','LOST','VOID','DISPUTED','MANUAL_REVIEW')),
  provider text not null, source_approval_id uuid not null references private.community_result_sources(id), provider_event_id text not null, revision text not null,
  observed_at timestamptz not null, evidence jsonb not null, actor text not null,
  previous_id uuid unique references private.community_settlements(id), correction_reason text,
  created_at timestamptz not null default clock_timestamp(), unique(edge_id,provider,provider_event_id,revision),
  check(previous_id is null or length(correction_reason)>=10)
);
create index on private.community_settlements(edge_id,created_at desc,id desc);
create table private.community_corrections (
  id uuid primary key default gen_random_uuid(), edge_id uuid not null references private.community_edges(id),
  old_settlement_id uuid not null references private.community_settlements(id), new_settlement_id uuid not null unique references private.community_settlements(id),
  correction_type text not null default 'RESULT_CORRECTION', reason text not null, actor text not null,
  old_result text not null, new_result text not null, evidence_reference text not null, created_at timestamptz not null default clock_timestamp()
);
create function private.community_settlement_guard() returns trigger language plpgsql set search_path='' as $$
declare edge private.community_edges; previous private.community_settlements; source private.community_result_sources; outcome text; a text; b text; sa numeric; sb numeric;
begin
  select * into edge from private.community_edges where id=new.edge_id for update;
  perform pg_advisory_xact_lock(hashtext('community-results:'||new.provider));
  select * into source from private.community_result_sources where provider=new.provider order by created_at desc,id desc limit 1 for share;
  select * into previous from private.community_settlements where edge_id=edge.id order by created_at desc,id desc limit 1;
  if edge.id is null or edge.start_at>clock_timestamp() or new.observed_at>clock_timestamp() or new.observed_at<edge.start_at
    or source.id is null or not source.approved or source.review_at<=clock_timestamp() or length(source.rights_reference)<=5
    or new.evidence->>'authorised' is distinct from 'true' or new.evidence->>'source' is distinct from new.provider
    or new.evidence->>'sourceEventId' is distinct from new.provider_event_id or new.evidence->>'revision' is distinct from new.revision
    or new.provider_event_id is distinct from (select source_mappings->>new.provider from private.events where id=edge.event_id)
    or new.evidence->>'eventId' is distinct from edge.event_id or new.evidence->'rules' is distinct from edge.market_rules
    or (new.evidence->>'observedAt')::timestamptz is distinct from new.observed_at then raise exception 'Authorised matching result evidence required'; end if;
  if new.evidence->>'status'='final' then
    a:=edge.market_rules->'participants'->>0; b:=edge.market_rules->'participants'->>1;
    if (select count(*) from jsonb_object_keys(new.evidence->'scores'))<>2 or not(new.evidence->'scores' ? a and new.evidence->'scores' ? b) then raise exception 'Complete final scores required'; end if;
    sa:=(new.evidence->'scores'->>a)::numeric; sb:=(new.evidence->'scores'->>b)::numeric;
    if sa::text in ('NaN','Infinity','-Infinity') or sb::text in ('NaN','Infinity','-Infinity') or sa<0 or sb<0 or sa<>trunc(sa) or sb<>trunc(sb) then raise exception 'Invalid scores'; end if;
    if sa=sb and edge.market_rules->>'market'<>'football_1x2' then outcome:='DISPUTED';
    elsif edge.selection=(case when sa=sb then 'Draw' when sa>sb then a else b end) then outcome:='WON'; else outcome:='LOST'; end if;
  elsif new.evidence->>'status'='void' and length(coalesce(new.evidence->>'reason',''))>0 and length(coalesce(new.evidence->>'settlementBasis',''))>0 then outcome:='VOID';
  elsif new.evidence->>'status'='manual_review' then outcome:='MANUAL_REVIEW';
  elsif new.evidence->>'status'='disputed' then outcome:='DISPUTED'; else raise exception 'Unresolved outcome remains pending'; end if;
  if new.result is distinct from outcome then raise exception 'User or caller cannot choose settlement result'; end if;
  if previous.id is not null then
    if new.previous_id is distinct from previous.id or new.evidence->>'supersedesRevision' is distinct from previous.revision
      or length(coalesce(new.correction_reason,''))<10 or new.actor is distinct from auth.uid()::text
      or auth.jwt()->>'aal' is distinct from 'aal2' or not private.active_member_session()
      or not exists(select 1 from private.roles where user_id=auth.uid() and role in ('owner','admin')) then raise exception 'Audited administrator correction required'; end if;
  elsif new.previous_id is not null then raise exception 'Invalid first settlement chain'; end if;
  new.source_approval_id:=source.id; new.created_at:=clock_timestamp(); return new;
end $$;
create trigger community_settlement_guard before insert on private.community_settlements for each row execute function private.community_settlement_guard();
create function private.community_settlement_correction() returns trigger language plpgsql set search_path='' as $$
begin
  if new.previous_id is not null then
    insert into private.community_corrections(edge_id,old_settlement_id,new_settlement_id,reason,actor,old_result,new_result,evidence_reference)
      select new.edge_id,new.previous_id,new.id,new.correction_reason,new.actor,result,new.result,new.provider||':'||new.provider_event_id||':'||new.revision from private.community_settlements where id=new.previous_id;
  end if;
  insert into private.audit_events(actor,action,subject,details) values(new.actor,'community_settlement',new.edge_id::text,jsonb_build_object('settlementId',new.id,'previousId',new.previous_id));
  insert into private.social_notification_jobs(dedupe_key,post_id,kind)
    select 'community-settlement:'||new.id::text,id,'status' from private.social_posts where community_edge_id=new.edge_id on conflict(dedupe_key) do nothing;
  return new;
end $$;
create trigger community_settlement_correction after insert on private.community_settlements for each row execute function private.community_settlement_correction();

create table private.leaderboard_rule_versions (
  id text primary key, configuration jsonb not null, created_at timestamptz not null default clock_timestamp()
);
insert into private.leaderboard_rule_versions values('top-docked-net-units-v1','{"minimumSettled":20,"minimumActiveDays":7,"primary":"net_standardised_units","tieBreakers":["maximum_drawdown_ascending","profile_id_ascending"],"periodBasis":"submitted_at_utc","roiDenominator":"settled_non_void_standard_units"}',clock_timestamp());
create table private.leaderboard_snapshots (
  id uuid primary key default gen_random_uuid(), rule_version text not null references private.leaderboard_rule_versions(id),
  period text not null check(period in ('week','month','7d','30d','90d','ytd','all')), sport text,
  as_of timestamptz not null, source_hash text not null check(length(source_hash)=64),
  snapshot_hash text not null check(length(snapshot_hash)=64), payload jsonb not null,
  previous_id uuid references private.leaderboard_snapshots(id), actor uuid not null, reason text not null check(length(reason)>=10),
  created_at timestamptz not null default clock_timestamp()
);
create index on private.leaderboard_snapshots(rule_version,period,sport,created_at desc);
create function private.community_snapshot_guard() returns trigger language plpgsql set search_path='' as $$
begin
  if new.actor is distinct from auth.uid() or auth.jwt()->>'aal' is distinct from 'aal2' or not private.active_member_session()
    or not exists(select 1 from private.roles where user_id=new.actor and role in ('owner','admin'))
    or new.as_of>clock_timestamp() or new.rule_version<>'top-docked-net-units-v1' then raise exception 'Privileged reproducible snapshot required'; end if;
  new.created_at:=clock_timestamp(); return new;
end $$;
create trigger community_snapshot_guard before insert on private.leaderboard_snapshots for each row execute function private.community_snapshot_guard();
-- One durable job per captured snapshot, never an unbounded recipient loop in the admin request.
create table private.leaderboard_notification_jobs (
  snapshot_id uuid primary key references private.leaderboard_snapshots(id),
  cursor_profile_id uuid, created_at timestamptz not null default clock_timestamp(), completed_at timestamptz
);
create index on private.leaderboard_notification_jobs(created_at) where completed_at is null;
alter table private.leaderboard_notification_jobs enable row level security;
create function private.leaderboard_notification_job() returns trigger language plpgsql set search_path='' as $$
declare previous private.leaderboard_snapshots;
begin
  select * into previous from private.leaderboard_snapshots where id=new.previous_id;
  if previous.id is not null and previous.as_of<new.as_of and previous.rule_version=new.rule_version
    and previous.period=new.period and previous.sport is not distinct from new.sport
    and previous.payload->'from' is not distinct from new.payload->'from' then
    insert into private.leaderboard_notification_jobs(snapshot_id) values(new.id) on conflict do nothing;
  end if;
  return new;
end $$;
create trigger leaderboard_notification_job after insert on private.leaderboard_snapshots for each row execute function private.leaderboard_notification_job();

do $$ declare t text; begin foreach t in array array['community_verification_rules','community_quote_evidence','community_edges','community_edge_status','community_result_sources','community_settlements','community_corrections','leaderboard_rule_versions','leaderboard_snapshots'] loop
  execute format('alter table private.%I enable row level security',t);
  execute format('create trigger immutable before update or delete on private.%I for each row execute function private.immutable()',t);
end loop; end $$;
revoke all on all tables in schema private from public,anon,authenticated;
revoke all on function private.community_quote_evidence_guard(),private.community_submission_retry(uuid,uuid,text),private.community_edge_guard(),private.community_snapshot_lock(),private.community_status_guard(),private.community_result_source_guard(),private.community_settlement_guard(),private.community_settlement_correction(),private.community_snapshot_guard(),private.leaderboard_notification_job() from public,anon,authenticated;
