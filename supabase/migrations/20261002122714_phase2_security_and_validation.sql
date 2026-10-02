-- Additive Phase 2 migration. Never rewrite the original A-F migration.
-- Apply only to an identity-verified, isolated Docked preview project.
alter table private.source_health add column diagnostics jsonb not null default '{}';
create table private.provider_poll_runs (
 id uuid primary key default gen_random_uuid(), provider text not null, sport text not null,
 status text not null check(status in ('success','failed','rejected')), diagnostics jsonb not null default '{}',
 error_code text, quota_charge integer not null default 0 check(quota_charge>=0),
 started_at timestamptz not null default now(), completed_at timestamptz
);
create index on private.provider_poll_runs(provider,started_at desc);
create function private.candidate_evidence_guard() returns trigger language plpgsql set search_path='' as $$ begin
 if tg_op='DELETE' then raise exception 'Candidate decisions are immutable evidence'; end if;
 if new.event_id<>old.event_id or new.strategy_id<>old.strategy_id or new.decision_at<>old.decision_at or new.window_seconds<>old.window_seconds
 or new.payload<>old.payload or new.rejection_reasons<>old.rejection_reasons
 or (new.status<>old.status and not(old.status='review' and new.status='published')) then raise exception 'Candidate decisions are immutable evidence'; end if;
 return new;
end $$;
create trigger candidate_evidence_guard before update or delete on private.candidate_decisions for each row execute function private.candidate_evidence_guard();
create trigger immutable before update or delete on private.closing_snapshots for each row execute function private.immutable();
create trigger immutable before update or delete on private.availability_observations for each row execute function private.immutable();
alter table private.analytics_events drop constraint analytics_events_event_check;
alter table private.analytics_events add constraint analytics_events_event_check check(event in (
 'signup','activated','saved_tip','digest_click','visit','unsubscribe','complaint',
 'landing_view','signup_started','signup_completed','email_verified','onboarding_completed',
 'sport_selected','bookmaker_selected','edge_viewed','tip_saved','methodology_viewed','results_viewed',
 'alert_enabled','alert_disabled','digest_enabled','digest_disabled','article_viewed','share_clicked'
));
create unique index analytics_once_per_account on private.analytics_events(user_id,event)
 where user_id is not null and event in ('signup_completed','email_verified','onboarding_completed');
alter table public.profiles add column onboarding_completed_at timestamptz;

-- All Data API reads require a currently active verified session as well as ownership.
-- This narrow private function exposes a boolean for the caller's own verified JWT only.
create function private.active_member_session() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id
 where s.user_id=(select auth.uid()) and s.id::text=(select auth.jwt()->>'session_id')
 and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
 and (s.not_after is null or s.not_after>now()))
$$;
grant usage on schema private to authenticated;
grant execute on function private.active_member_session() to authenticated;
drop policy own_profile on public.profiles;
create policy own_profile on public.profiles for select to authenticated using(
 (select auth.uid())=id and disabled_at is null and (select private.active_member_session()));
drop policy own_preferences on public.notification_preferences;
create policy own_preferences on public.notification_preferences for select to authenticated using(
 (select auth.uid())=user_id and exists(select 1 from public.profiles p where p.id=user_id));
drop policy own_saved on public.saved_tips;
create policy own_saved on public.saved_tips for select to authenticated using(
 (select auth.uid())=user_id and exists(select 1 from public.profiles p where p.id=user_id));
drop policy own_personal on public.personal_entries;
create policy own_personal on public.personal_entries for select to authenticated using(
 (select auth.uid())=user_id and exists(select 1 from public.profiles p where p.id=user_id));

alter table private.strategy_versions add column lifecycle text not null default 'DRAFT' check(lifecycle in
 ('DRAFT','RESEARCH','VALIDATED','FROZEN_FOR_FORWARD_PAPER','FORWARD_PAPER','APPROVED_FOR_LIVE','RETIRED'));
alter table private.strategy_versions add column code_commit text;
alter table private.strategy_versions add column state_changed_at timestamptz not null default now();
-- Existing timestamp approvals are not silently treated as reviewed Phase 2 lifecycle evidence.
update private.strategy_versions set active=false,lifecycle=case when frozen_at is not null then 'RETIRED' else 'DRAFT' end;
insert into private.audit_events(actor,action,subject,details)
 select 'phase2-schema-migration','legacy_strategy_retired',id,jsonb_build_object('reason','Legacy frozen evidence preserved; explicit lifecycle requires a new reviewed version') from private.strategy_versions where frozen_at is not null;
create table private.strategy_transitions (
 id uuid primary key default gen_random_uuid(), strategy_id text not null references private.strategy_versions(id),
 from_state text not null, to_state text not null, actor uuid not null, created_at timestamptz not null default clock_timestamp(),
 strategy_hash text not null, code_commit text not null, reason text not null check(length(reason)>=12),
 validation_run_id uuid references private.validation_runs(id), configuration jsonb not null
);
create trigger immutable before update or delete on private.strategy_transitions for each row execute function private.immutable();
create or replace function private.no_strategy_rewrite() returns trigger language plpgsql set search_path='' as $$
begin
 if old.frozen_at is not null and (new.config<>old.config or new.config_hash<>old.config_hash or new.frozen_at is distinct from old.frozen_at or new.code_commit is distinct from old.code_commit)
 then raise exception 'Frozen configuration is immutable; create a new strategy version'; end if;
 if (new.lifecycle<>old.lifecycle or new.active<>old.active or new.research_approved_at is distinct from old.research_approved_at or new.paper_approved_at is distinct from old.paper_approved_at or new.owner_approved_at is distinct from old.owner_approved_at or new.frozen_at is distinct from old.frozen_at)
 and coalesce(current_setting('docked.strategy_transition',true),'')<>old.id
 then raise exception 'Use the audited strategy transition operation'; end if;
 return new;
end $$;
create function private.transition_strategy(p_id text,p_to text,p_actor uuid,p_reason text,p_commit text,p_run uuid default null)
returns text language plpgsql set search_path='' as $$
declare s private.strategy_versions; v private.validation_runs; valid boolean;
begin
 if not exists(select 1 from private.roles where user_id=p_actor and role in ('owner','admin')) then raise exception 'Administrator role required'; end if;
 if length(p_reason)<12 or p_commit!~'^[0-9a-f]{40}$' then raise exception 'Reason and exact code commit required'; end if;
 select * into s from private.strategy_versions where id=p_id for update;
 if not found then raise exception 'Strategy missing'; end if;
 valid=(s.lifecycle='DRAFT' and p_to='RESEARCH') or (s.lifecycle='RESEARCH' and p_to='VALIDATED')
 or (s.lifecycle='VALIDATED' and p_to='FROZEN_FOR_FORWARD_PAPER') or (s.lifecycle='FROZEN_FOR_FORWARD_PAPER' and p_to='FORWARD_PAPER')
 or (s.lifecycle='FORWARD_PAPER' and p_to='APPROVED_FOR_LIVE') or (s.lifecycle<>'RETIRED' and p_to='RETIRED');
 if not valid then raise exception 'Invalid strategy lifecycle transition'; end if;
 if s.frozen_at is not null and s.code_commit is distinct from p_commit then raise exception 'Frozen code commit mismatch'; end if;
 if p_to='FROZEN_FOR_FORWARD_PAPER' and not coalesce(
  (s.config->>'minEV')::numeric>=0.03 and (s.config->>'minEV')::numeric<=0.20
  and (s.config->>'minOdds')::numeric>=1.5 and (s.config->>'maxOdds')::numeric<=5
  and (s.config->>'minOdds')::numeric<=(s.config->>'maxOdds')::numeric,false)
 then raise exception 'Forward paper requires the 3%% EV release floor and odds within 1.5 to 5; research sensitivity settings cannot be frozen for release'; end if;
 if p_to in ('VALIDATED','APPROVED_FOR_LIVE') then
  select * into v from private.validation_runs where id=p_run and strategy_id=p_id;
  if not found or v.contaminated or v.report='{}'::jsonb or v.code_commit<>p_commit
   or v.manifest->>'configHash' is distinct from s.config_hash or coalesce((v.manifest->>'fixture')::boolean,true)
   or not coalesce((v.report->'validation'->>'valid')::boolean,false)
   or (p_to='VALIDATED' and (v.manifest->'datasetHashes'->>'canonical') is null)
   or (p_to='APPROVED_FOR_LIVE' and not exists(select 1 from private.tip_publications where strategy_id=p_id and evidence='forward_paper'))
   or (p_to='VALIDATED' and v.evidence<>'retrospective_backtest') or (p_to='APPROVED_FOR_LIVE' and v.evidence<>'forward_paper')
  then raise exception 'Matching uncontaminated genuine validation report required'; end if;
 end if;
 perform set_config('docked.strategy_transition',p_id,true);
 update private.strategy_versions set lifecycle=p_to,state_changed_at=clock_timestamp(),code_commit=p_commit,
 frozen_at=case when p_to='FROZEN_FOR_FORWARD_PAPER' then coalesce(frozen_at,clock_timestamp()) else frozen_at end,
 active=p_to in ('FORWARD_PAPER','APPROVED_FOR_LIVE'),
 research_approved_at=case when p_to='VALIDATED' then clock_timestamp() else research_approved_at end,
 paper_approved_at=case when p_to='APPROVED_FOR_LIVE' then clock_timestamp() else paper_approved_at end,
 owner_approved_at=case when p_to='APPROVED_FOR_LIVE' then clock_timestamp() else owner_approved_at end,
 approval_evidence=p_reason where id=p_id;
 insert into private.strategy_transitions(strategy_id,from_state,to_state,actor,strategy_hash,code_commit,reason,validation_run_id,configuration)
 values(p_id,s.lifecycle,p_to,p_actor,s.config_hash,p_commit,p_reason,p_run,s.config);
 perform set_config('docked.strategy_transition','',true);
 return p_to;
end $$;
insert into private.feature_flags(key,reason) values('forward_paper','Private forward paper awaits approved frozen strategy');

-- Renewing a policy must not erase historical losses from that jurisdiction's record.
-- Current recommendations are separately revalidated against current operator/price controls.
create function private.publication_region_matches(published_policy uuid,current_policy uuid) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from private.region_policies old_policy join private.region_policies current_policy_row
 on old_policy.country=current_policy_row.country and old_policy.state=current_policy_row.state
 where old_policy.id=published_policy and current_policy_row.id=current_policy and current_policy_row.approved
 and current_policy_row.effective_from<=now() and current_policy_row.effective_to>now() and current_policy_row.review_at>now()
 and 'tips'=any(current_policy_row.features))
$$;

create or replace function private.publication_guard() returns trigger language plpgsql set search_path='' as $$
declare e private.events; s private.strategy_versions; r private.region_policies; c private.candidate_decisions; actor_role text; q jsonb;
begin
 select * into e from private.events where id=new.event_id for share;
 select * into s from private.strategy_versions where id=new.strategy_id for share;
 select * into r from private.region_policies where id=new.region_policy_id for share;
 select * into c from private.candidate_decisions where id=new.candidate_id for share;
 select role into actor_role from private.roles where user_id=new.approved_by;
 if actor_role is null or actor_role not in ('owner','admin','analyst') then raise exception 'Approval role required'; end if;
 if new.evidence not in ('forward_paper','live_published') then raise exception 'Demo/backtest cannot enter publication ledger'; end if;
 if c.event_id is distinct from new.event_id or c.strategy_id is distinct from new.strategy_id or c.status<>'review'
 or c.decision_at>clock_timestamp() or c.decision_at>=e.start_at then raise exception 'Candidate linkage invalid'; end if;
 if e.status<>'scheduled' or e.start_at<=clock_timestamp()+interval '10 minutes' then raise exception 'Event not safely pre-start'; end if;
 if not s.active or s.frozen_at is null or s.research_approved_at is null or new.config_hash<>s.config_hash then raise exception 'Strategy not approved'; end if;
 if new.evidence='live_published' and (s.lifecycle<>'APPROVED_FOR_LIVE' or s.paper_approved_at is null or s.owner_approved_at is null) then raise exception 'Paper/release approval missing'; end if;
 if new.evidence='forward_paper' and s.lifecycle<>'FORWARD_PAPER' then raise exception 'Strategy not in forward paper'; end if;
 if not coalesce((select enabled from private.feature_flags where key=case when new.evidence='forward_paper' then 'forward_paper' else 'publication' end),false) then raise exception 'Publication paused'; end if;
 if not r.approved or r.effective_from>now() or r.effective_to<=now() or r.review_at<=now() or not ('tips'=any(r.features)) then raise exception 'Region restricted'; end if;
 if jsonb_array_length(new.sources)<3 then raise exception 'Offer plus two references required'; end if;
 if (select count(distinct value->>'operator') from jsonb_array_elements(new.sources))<3 then raise exception 'Independent offer and references required'; end if;
 for q in select * from jsonb_array_elements(new.sources) loop
  if q->'rules' is distinct from new.market_rules then raise exception 'Source market mismatch'; end if;
  if q->>'sourceAt' is null or q->>'snapshotAt' is null or q->>'receivedAt' is null
   or (q->>'sourceAt')::timestamptz>(q->>'snapshotAt')::timestamptz or (q->>'snapshotAt')::timestamptz>(q->>'receivedAt')::timestamptz
   or (q->>'receivedAt')::timestamptz>clock_timestamp() or (q->>'sourceAt')::timestamptz<clock_timestamp()-interval '3 minutes' then raise exception 'Stale/future evidence'; end if;
 end loop;
 if new.odds<new.minimum_odds or new.odds<1.5 or new.odds>5 or new.estimated_ev<greatest((s.config->>'minEV')::numeric,0.03) or new.estimated_ev>0.20
 or new.minimum_odds<ceil((1+greatest((s.config->>'minEV')::numeric,0.03))/new.probability*100)/100 then raise exception 'Price does not qualify'; end if;
 if abs(new.probability*new.odds-1-new.estimated_ev)>0.00000001 then raise exception 'EV/probability mismatch'; end if;
 new.published_at=clock_timestamp(); return new;
end $$;
create or replace function private.publish_outbox() returns trigger language plpgsql set search_path='' as $$ begin
 if new.evidence='live_published' then
  insert into private.outbox(dedupe_key,kind,payload,expires_at) values('publication:'||new.id,'publication',jsonb_build_object('tipId',new.id),new.published_at+interval '3 minutes');
 end if;
 insert into private.audit_events(actor,action,subject,details) values(new.approved_by::text,'publish',new.id::text,jsonb_build_object('evidence',new.evidence));
 return new;
end $$;

-- A correction must point to settlements of the same immutable publication.
create function private.correction_guard() returns trigger language plpgsql set search_path='' as $$ begin
 if new.settlement_id is null or new.replacement_settlement_id is null or new.settlement_id=new.replacement_settlement_id
 or not exists(select 1 from private.settlement_events where id=new.settlement_id and tip_id=new.tip_id)
 or not exists(select 1 from private.settlement_events where id=new.replacement_settlement_id and tip_id=new.tip_id)
 then raise exception 'Correction settlement linkage invalid'; end if;
 return new;
end $$;
create trigger correction_guard before insert on private.correction_events for each row execute function private.correction_guard();

-- Account closure revokes immediately; remote Auth erasure is retried by the durable worker.
-- Pseudonymous consent/publication/audit evidence stays append-only pending legal retention review.
create function private.disable_account(p_user uuid) returns void language plpgsql set search_path='' as $$
begin
 update public.profiles set disabled_at=coalesce(disabled_at,clock_timestamp()) where id=p_user;
 if not found then return; end if;
 update public.notification_preferences set paused=true,digest='off',edge_alerts=false,education=false,updated_at=now() where user_id=p_user;
 update private.outbox set state='suppressed',user_id=null,payload='{}',dedupe_key='erased:'||id::text,last_error='Account erased',lease_token=null,lease_until=null where user_id=p_user;
 update private.delivery_attempts set user_id=null,provider_id=null where user_id=p_user;
 delete from private.analytics_events where user_id=p_user;
 delete from private.unsubscribe_tokens where user_id=p_user;
 delete from public.saved_tips where user_id=p_user;
 delete from public.personal_entries where user_id=p_user;
 delete from auth.sessions where user_id=p_user;
 insert into private.job_runs(dedupe_key,kind,payload) values('account-deletion:'||p_user::text,'account_deletion',jsonb_build_object('userId',p_user)) on conflict do nothing;
 insert into private.audit_events(actor,action,subject) values('account-service','account_access_revoked',p_user::text);
end $$;

alter table private.provider_poll_runs enable row level security;
alter table private.strategy_transitions enable row level security;
revoke all on private.provider_poll_runs,private.strategy_transitions from public,anon,authenticated;
revoke all on function private.transition_strategy(text,text,uuid,text,text,uuid),private.correction_guard() from public,anon,authenticated;
revoke all on function private.disable_account(uuid) from public,anon,authenticated;
revoke all on function private.candidate_evidence_guard() from public,anon,authenticated;
revoke all on function private.publication_region_matches(uuid,uuid) from public,anon,authenticated;
