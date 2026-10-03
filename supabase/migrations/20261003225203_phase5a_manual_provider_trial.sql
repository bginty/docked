-- Isolated manual trial only. No provider configuration, rights, policy or permit is activated.
create table private.provider_trials (
 id uuid primary key default gen_random_uuid(), provider text not null unique check(provider='the-odds-api'),
 project_ref text not null check(project_ref='bckkllmndoxzpzdqrevb'),
 rights_reference text not null check(length(btrim(rights_reference))>=8),
 decision text not null check(decision in ('APPROVED_FOR_PREVIEW_TRIAL','REQUIRES_CLARIFICATION','NOT_PERMITTED')),
 reviewed_at timestamptz not null, next_review_at timestamptz not null, effective_to timestamptz not null,
 reviewed_by uuid not null, evidence_links jsonb not null check(jsonb_typeof(evidence_links)='array' and jsonb_array_length(evidence_links)>0),
 scopes jsonb not null, credit_cap integer not null check(credit_cap between 1 and 250), attempt_cap integer not null default 25 check(attempt_cap between 1 and 25),
 revoked_at timestamptz, revoke_reason text, created_at timestamptz not null default clock_timestamp(),
 check(reviewed_at<next_review_at and next_review_at<=effective_to)
);
create table private.provider_trial_permits (
 id uuid primary key default gen_random_uuid(), trial_id uuid not null references private.provider_trials(id),
 token_hash text not null check(token_hash ~ '^[a-f0-9]{64}$'), operation text not null check(operation in ('sports','events','odds','scores')),
 competition text, config_id uuid references private.market_data_config(id),
 expires_at timestamptz not null, created_by uuid not null, created_at timestamptz not null default clock_timestamp(),
 check((operation='sports' and competition is null and config_id is null) or(operation in ('events','odds','scores') and competition ~ '^[a-z0-9_]{1,100}$' and config_id is not null))
);
create table private.provider_trial_requests (
 id uuid primary key default gen_random_uuid(), permit_id uuid not null unique references private.provider_trial_permits(id),
 trial_id uuid not null references private.provider_trials(id), poll_run_id uuid not null unique references private.provider_poll_runs(id),
 scope text not null, reserved_credits integer not null check(reserved_credits between 0 and 250),
 reported_credits integer check(reported_credits>=0), remaining integer check(remaining>=0), used integer check(used>=0),
 status text not null default 'RESERVED' check(status in ('RESERVED','SUCCESS','FAILED')),
 started_at timestamptz not null default clock_timestamp(), headers_at timestamptz, completed_at timestamptz, error_code text,
 diagnostics jsonb not null default '{}'
);
create table private.provider_trial_diagnostics (
 id uuid primary key default gen_random_uuid(), trial_id uuid not null references private.provider_trials(id),
 observed_at timestamptz not null default clock_timestamp(), payload jsonb not null
);
create function private.provider_trial_active(p_rights text) returns boolean language sql volatile set search_path='' as $$
 select exists(select 1 from private.provider_trials t where provider='the-odds-api' and project_ref='bckkllmndoxzpzdqrevb' and rights_reference=p_rights and decision='APPROVED_FOR_PREVIEW_TRIAL' and revoked_at is null and reviewed_at<=clock_timestamp() and next_review_at>clock_timestamp() and effective_to>clock_timestamp()
 and not exists(select 1 from private.provider_trial_requests r where r.trial_id=t.id and (r.status='FAILED' or r.reported_credits>r.reserved_credits)))
$$;
create function private.provider_trial_review_guard() returns trigger language plpgsql set search_path='' as $$
declare actor uuid;
begin
 actor:=private.scanner_assert_actor(true);
 if tg_op='DELETE' then raise exception 'Trial history cannot be removed';end if;
 if tg_op='UPDATE' then
  if old.revoked_at is not null or new.revoked_at is null or new.revoked_at>clock_timestamp() or length(btrim(new.revoke_reason))<3
   or (to_jsonb(new)-array['revoked_at','revoke_reason']) is distinct from (to_jsonb(old)-array['revoked_at','revoke_reason']) then raise exception 'Trial terms and cumulative budget are immutable';end if;
 else
  if new.reviewed_by is distinct from actor or new.reviewed_at>clock_timestamp() or new.reviewed_at<clock_timestamp()-interval '1 day'
   or new.effective_to>new.reviewed_at+interval '32 days' or not coalesce(new.scopes @> '{"display":true,"storage":true,"derived":true,"auditRetention":true}'::jsonb,false)
   or exists(select 1 from jsonb_array_elements_text(new.evidence_links)e(link) where link !~ '^https://the-odds-api[.]com/') then raise exception 'Reviewed explicit trial rights required';end if;
 end if;
 insert into private.audit_events(actor,action,subject,details) values(actor::text,'provider_trial_review',new.id::text,jsonb_build_object('decision',new.decision,'revoked',new.revoked_at is not null,'creditCap',new.credit_cap));return new;
end $$;
create trigger provider_trial_review before insert or update or delete on private.provider_trials for each row execute function private.provider_trial_review_guard();
create function private.provider_trial_permit_guard() returns trigger language plpgsql set search_path='' as $$
declare actor uuid;t private.provider_trials;c private.market_data_config;
begin
 if tg_op<>'INSERT' then raise exception 'Manual permits are immutable and cannot be replayed';end if;
 actor:=private.scanner_assert_actor(true);
 select * into t from private.provider_trials where id=new.trial_id for share;
 if new.created_by is distinct from actor or not private.provider_trial_active(t.rights_reference) or new.expires_at<=clock_timestamp()
 or new.expires_at>least(clock_timestamp()+interval '30 minutes',t.next_review_at,t.effective_to) then raise exception 'Current bounded manual permit required';end if;
 if new.operation<>'sports' then
  select * into c from private.market_data_config where id=new.config_id for share;
  if c.id is null or not c.enabled or c.provider<>t.provider or c.rights_reference<>t.rights_reference or c.effective_from>clock_timestamp() or c.effective_to<=clock_timestamp()
  or not exists(select 1 from jsonb_array_elements(c.configuration->'competitions')v where v->>'providerCompetitionId'=new.competition)
  or (new.operation='odds' and new.competition='americanfootball_nfl') or (new.operation='scores' and t.scopes->>'resultsInspection' is distinct from 'true') then raise exception 'Exact reviewed trial competition required';end if;
 end if;
 perform private.scanner_assert_actor(true);
 insert into private.audit_events(actor,action,subject,details) values(actor::text,'provider_trial_permit',new.id::text,jsonb_build_object('operation',new.operation,'competition',new.competition,'expiresAt',new.expires_at));return new;
end $$;
create trigger provider_trial_permit before insert or update or delete on private.provider_trial_permits for each row execute function private.provider_trial_permit_guard();
create function private.reserve_provider_trial(p_permit uuid,p_token_hash text,p_scope text,p_cost integer,p_poll uuid) returns uuid language plpgsql set search_path='' as $$
declare p private.provider_trial_permits;t private.provider_trials;h private.source_health;c private.market_data_config;spent bigint;attempts bigint;rid uuid;
begin
 select * into p from private.provider_trial_permits where id=p_permit;
 if p.id is null or p.token_hash is distinct from p_token_hash then raise exception 'Manual permit unavailable';end if;
 -- One lock covers every request and every UTC month; no budget reset or concurrent double-spend.
 select * into t from private.provider_trials where id=p.trial_id for update;
 insert into private.source_health(provider) values(t.provider) on conflict do nothing;
 select * into h from private.source_health where provider=t.provider for update;
 if p.config_id is not null then select * into c from private.market_data_config where id=p.config_id for share;end if;
 if not private.provider_trial_active(t.rights_reference) or p.expires_at<=clock_timestamp()
 or p_scope is distinct from (case when p.operation='sports' then 'sports' else p.operation||':'||p.competition end)
 or p_cost is null or p_cost<0 or p_cost is distinct from (case when p.operation='odds' then jsonb_array_length(c.configuration->'regions') when p.operation='scores' then 2 else 0 end)
 or (p.operation<>'sports' and (c.id is null or not c.enabled or c.rights_reference<>t.rights_reference or c.effective_from>clock_timestamp() or c.effective_to<=clock_timestamp()))
 or (p.operation<>'sports' and (h.rights_reference is distinct from t.rights_reference or h.capabilities->>'display' is distinct from 'true' or h.capabilities->>'retention' is distinct from 'true'))
 or exists(select 1 from private.provider_trial_requests where permit_id=p.id)
 or exists(select 1 from private.provider_trial_requests where trial_id=t.id and completed_at is null)
 or exists(select 1 from private.feature_flags where enabled and key in ('edge_scanner','auto_publish_docked_edges','publication','forward_paper','sending'))
 then raise exception 'Expired, replayed or mismatched trial authority';end if;
 select count(*),coalesce(sum(greatest(reserved_credits,coalesce(reported_credits,0))),0) into attempts,spent from private.provider_trial_requests where trial_id=t.id;
 if attempts>=t.attempt_cap or spent+p_cost>t.credit_cap or (p.operation<>'sports' and h.credits_remaining is null) or (p_cost>0 and h.credits_remaining<p_cost)
 or (h.circuit_until is not null and h.circuit_until>clock_timestamp()) then raise exception 'Trial credit or request budget exhausted or unknown';end if;
 if not exists(select 1 from private.provider_poll_runs where id=p_poll and provider=t.provider and quota_charge=0) then raise exception 'New trial poll record required';end if;
 perform set_config('docked.trial_write','reserve',true);
 insert into private.provider_trial_requests(permit_id,trial_id,poll_run_id,scope,reserved_credits) values(p.id,t.id,p_poll,p_scope,p_cost) returning id into rid;
 perform set_config('docked.trial_write','',true);
 update private.provider_poll_runs set quota_charge=p_cost where id=p_poll;
 update private.source_health set credits_remaining=case when credits_remaining is null then null else greatest(0,credits_remaining-p_cost) end where provider=t.provider;
 return rid;
end $$;
create function private.provider_trial_request_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'Trial request history is retained';end if;
 if tg_op='INSERT' and current_setting('docked.trial_write',true) is distinct from 'reserve' then raise exception 'Atomic trial reservation required';end if;
 if tg_op='UPDATE' and ((to_jsonb(new)-array['reported_credits','remaining','used','headers_at','status','completed_at','error_code','diagnostics']) is distinct from (to_jsonb(old)-array['reported_credits','remaining','used','headers_at','status','completed_at','error_code','diagnostics'])
 or old.completed_at is not null or (old.headers_at is not null and (new.reported_credits is distinct from old.reported_credits or new.remaining is distinct from old.remaining or new.used is distinct from old.used or new.headers_at is distinct from old.headers_at))) then raise exception 'Trial reservation and observed quota are immutable';end if;
 return new;
end $$;
create trigger provider_trial_request before insert or update or delete on private.provider_trial_requests for each row execute function private.provider_trial_request_guard();
create trigger provider_trial_diagnostics_immutable before update or delete on private.provider_trial_diagnostics for each row execute function private.immutable();
-- Existing current-evidence authority is additionally withdrawn when the trial review expires/revokes.
alter function private.market_data_source_current(text,timestamptz) rename to market_data_source_current_before_trial;
create function private.market_data_source_current(p_snapshot text,p_at timestamptz) returns boolean language sql volatile set search_path='' as $$
 select private.market_data_source_current_before_trial(p_snapshot,p_at) and not exists(
  select 1 from private.odds_snapshots q join private.provider_trials t on t.provider=q.provider and t.rights_reference=q.provenance
  where q.id=p_snapshot and (not private.provider_trial_active(t.rights_reference)))
$$;
do $$declare n text;begin
 foreach n in array array['provider_trials','provider_trial_permits','provider_trial_requests','provider_trial_diagnostics'] loop
  execute format('alter table private.%I enable row level security',n);
  execute format('revoke all on private.%I from public,anon,authenticated',n);
 end loop;
end $$;
revoke all on function private.provider_trial_active(text),private.provider_trial_review_guard(),private.provider_trial_permit_guard(),private.reserve_provider_trial(uuid,text,text,integer,uuid),private.provider_trial_request_guard(),private.market_data_source_current(text,timestamptz),private.market_data_source_current_before_trial(text,timestamptz) from public,anon,authenticated;
