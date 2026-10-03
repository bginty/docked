-- Review one known legacy free-bootstrap driver failure; never rewrite its request or quota.
create table private.provider_trial_failure_reviews (
 request_id uuid primary key references private.provider_trial_requests(id),
 trial_id uuid not null unique references private.provider_trials(id),
 reviewed_by uuid not null,
 reviewed_at timestamptz not null default clock_timestamp(),
 reason_code text not null check(reason_code='SERVER_TRANSACTION_COMPATIBILITY'),
 repair_code_commit text not null check(repair_code_commit ~ '^[a-f0-9]{40}$'),
 evidence_reference text not null check(length(btrim(evidence_reference)) between 10 and 300),
 evidence_sha256 text not null check(evidence_sha256 ~ '^[a-f0-9]{64}$')
);
alter table private.provider_trial_failure_reviews enable row level security;
revoke all on private.provider_trial_failure_reviews from public,anon,authenticated,docked_app;

create function private.provider_trial_failure_review_guard() returns trigger language plpgsql set search_path='' as $$
declare actor uuid;r private.provider_trial_requests;p private.provider_trial_permits;t private.provider_trials;
begin
 if tg_op<>'INSERT' then raise exception 'Driver failure reviews are immutable';end if;
 actor:=private.scanner_assert_actor(true);
 select * into t from private.provider_trials where id=new.trial_id for update;
 select * into r from private.provider_trial_requests where id=new.request_id for share;
 select * into p from private.provider_trial_permits where id=r.permit_id;
 if t.id is null or r.id is null or r.trial_id is distinct from t.id or p.operation is distinct from 'sports'
 or r.scope is distinct from 'sports' or r.status is distinct from 'FAILED' or r.reserved_credits<>0
 or r.headers_at is not null or r.reported_credits is not null or r.remaining is not null or r.used is not null
 or r.completed_at is null or r.error_code is distinct from 'TRIAL_REQUEST_FAILED'
 -- Only the original serializer/transaction failure signature is reviewable here. New failures have object diagnostics.
 or r.diagnostics is distinct from to_jsonb('{}'::text)
 or exists(select 1 from private.provider_trial_requests earlier where earlier.trial_id=t.id and (earlier.started_at,earlier.id)<(r.started_at,r.id))
 or t.provider<>'the-odds-api' or t.project_ref<>'bckkllmndoxzpzdqrevb' or t.decision<>'APPROVED_FOR_PREVIEW_TRIAL'
 or t.revoked_at is not null or t.reviewed_at>clock_timestamp() or least(t.next_review_at,t.effective_to)<=clock_timestamp()
 or new.reviewed_by is distinct from actor or new.reviewed_at>clock_timestamp() or new.reviewed_at<clock_timestamp()-interval '5 minutes'
 then raise exception 'Exact reviewed legacy free-bootstrap failure required';end if;
 perform private.scanner_assert_actor(true);
 insert into private.audit_events(actor,action,subject,details) values(actor::text,'provider_trial_driver_failure_review',r.id::text,
 jsonb_build_object('trialId',t.id,'reason',new.reason_code,'repairCommit',new.repair_code_commit,'evidenceReference',new.evidence_reference,'evidenceSha256',new.evidence_sha256,'originalFailureRetained',true,'quotaObservation','UNKNOWN'));
 return new;
end $$;
create trigger provider_trial_failure_review before insert or update or delete on private.provider_trial_failure_reviews for each row execute function private.provider_trial_failure_review_guard();

create or replace function private.provider_trial_active(p_rights text) returns boolean language sql volatile set search_path='' as $$
 select exists(select 1 from private.provider_trials t where provider='the-odds-api' and project_ref='bckkllmndoxzpzdqrevb' and rights_reference=p_rights and decision='APPROVED_FOR_PREVIEW_TRIAL' and revoked_at is null and reviewed_at<=clock_timestamp() and next_review_at>clock_timestamp() and effective_to>clock_timestamp()
 and not exists(select 1 from private.provider_trial_requests r where r.trial_id=t.id and
 (r.reported_credits>r.reserved_credits or (r.status='FAILED' and not exists(select 1 from private.provider_trial_failure_reviews review where review.request_id=r.id and review.trial_id=t.id)))))
$$;

-- New writes must carry an actual JSON object. Preserve existing completed legacy evidence unchanged.
create function private.provider_trial_diagnostic_shape_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if jsonb_typeof(new.diagnostics) is distinct from 'object' then raise exception 'Trial diagnostics must be a JSON object';end if;
 return new;
end $$;
create trigger provider_trial_diagnostic_shape before insert or update on private.provider_trial_requests for each row execute function private.provider_trial_diagnostic_shape_guard();

-- Retain the reviewed reservation algorithm; additionally lock/recheck the permit issuer at execution.
alter function private.reserve_provider_trial(uuid,text,text,integer,uuid) rename to reserve_provider_trial_before_driver_review;
create function private.reserve_provider_trial(p_permit uuid,p_token_hash text,p_scope text,p_cost integer,p_poll uuid) returns uuid language plpgsql set search_path='' as $$
declare issuer uuid;rid uuid;
begin
 select created_by into issuer from private.provider_trial_permits where id=p_permit;
 if issuer is null then raise exception 'Manual permit unavailable';end if;
 perform 1 from public.profiles where id=issuer for share;
 perform 1 from private.roles where user_id=issuer for share;
 perform 1 from auth.users where id=issuer for share;
 rid:=private.reserve_provider_trial_before_driver_review(p_permit,p_token_hash,p_scope,p_cost,p_poll);
 -- All quota/config lock waits have completed. A removed role, erased/disabled profile or ban denies atomically.
 if not exists(select 1 from public.profiles profile join private.roles role on role.user_id=profile.id join auth.users u on u.id=profile.id
 where profile.id=issuer and profile.disabled_at is null and role.role in ('owner','admin')
 and coalesce(nullif(to_jsonb(u)->>'banned_until','')::timestamptz,'-infinity'::timestamptz)<=clock_timestamp())
 then raise exception 'Current manual permit issuer required';end if;
 return rid;
end $$;
revoke all on function private.provider_trial_failure_review_guard(),private.provider_trial_diagnostic_shape_guard(),private.reserve_provider_trial_before_driver_review(uuid,text,text,integer,uuid),private.reserve_provider_trial(uuid,text,text,integer,uuid),private.provider_trial_active(text) from public,anon,authenticated,docked_app;
