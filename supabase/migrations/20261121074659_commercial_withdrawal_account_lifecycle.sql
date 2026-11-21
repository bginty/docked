-- Dormant withdrawal account lifecycle. No provider erasure, payout, retention
-- approval or automatic retention duration is configured by this migration.
create table commercial_billing.withdrawal_account_lifecycle(
 member_id uuid primary key references commercial_billing.accounts,
 requested_at timestamptz not null default clock_timestamp(),
 provider_cleanup_state text not null check(provider_cleanup_state in('not_required','queued','confirmed')),
 local_cleanup_state text not null check(local_cleanup_state in('not_required','queued','confirmed')),
 financial_review_state text not null check(financial_review_state in('not_required','queued','confirmed')),
 retention_policy_version text,
 updated_at timestamptz not null default clock_timestamp(),
 completed_at timestamptz
);
create table commercial_billing.withdrawal_provider_cleanup_intents(
 member_id uuid primary key references commercial_billing.withdrawal_account_lifecycle,
 provider text not null check(provider='sumsub'),
 external_user_id text not null,
 provider_applicant_id text,
 state text not null default 'queued' check(state in('queued','confirmed')),
 requested_at timestamptz not null default clock_timestamp(),
 confirmed_at timestamptz,
 evidence_reference text,
 check((state='confirmed')=(confirmed_at is not null and evidence_reference is not null))
);
create table commercial_billing.withdrawal_retention_policies(
 version text primary key,
 review_reference text not null check(length(review_reference) between 8 and 240),
 provider_contract_reference text not null check(length(provider_contract_reference) between 8 and 240),
 valid_until timestamptz not null,
 created_at timestamptz not null default clock_timestamp()
);
create table commercial_billing.withdrawal_account_lifecycle_events(
 id bigint generated always as identity primary key,
 member_id uuid not null references commercial_billing.withdrawal_account_lifecycle,
 action text not null check(action in('CLOSURE_REQUESTED','FINANCIAL_REVIEWED','PROVIDER_CLEANUP_CONFIRMED','LOCAL_PAYLOAD_PURGED','PROVIDER_EVIDENCE_AFTER_CLOSURE')),
 actor text not null,
 policy_version text references commercial_billing.withdrawal_retention_policies,
 evidence_reference text,
 created_at timestamptz not null default clock_timestamp()
);

create function commercial_billing.withdrawal_account_closed(target uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from commercial_billing.withdrawal_account_lifecycle where member_id=target)
 or not exists(select 1 from public.profiles p join auth.users u on u.id=p.id
  where p.id=target and p.disabled_at is null and u.deleted_at is null
   and (u.banned_until is null or u.banned_until<=clock_timestamp()))
$$;

create function commercial_billing.withdrawal_pending_obligation(target uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from commercial_billing.withdrawals where member_id=target
  and status in('REQUESTED','UNDER_REVIEW','APPROVED','PAYMENT_IN_PROGRESS','EXCEPTION','SENT'))
 or exists(select 1 from commercial_billing.recovery_cases where member_id=target and state='OPEN')
 or commercial_billing.withdrawal_member_held(target)
$$;

-- Internal helper: profile triggers and the recorded deletion job alone invoke
-- it. The account row lock serialises closure with new withdrawal setup.
create function commercial_billing.queue_withdrawal_account_closure(target uuid) returns void
language plpgsql security definer set search_path='' as $$
declare binding commercial_billing.withdrawal_identity_bindings%rowtype;
 provider_needed boolean; local_needed boolean; financial_needed boolean;
begin
 perform 1 from commercial_billing.accounts where member_id=target for update;
 if not found then return;end if;
 select * into binding from commercial_billing.withdrawal_identity_bindings where member_id=target;
 provider_needed:=found;
 local_needed:=exists(select 1 from commercial_billing.withdrawal_identities where member_id=target)
  or exists(select 1 from commercial_billing.withdrawal_destinations where member_id=target);
 if not(provider_needed or local_needed or exists(select 1 from commercial_billing.withdrawals where member_id=target))
 then return;end if;
 financial_needed:=exists(select 1 from commercial_billing.withdrawals where member_id=target)
  or commercial_billing.withdrawal_pending_obligation(target);
 insert into commercial_billing.withdrawal_account_lifecycle(member_id,provider_cleanup_state,local_cleanup_state,financial_review_state)
 values(target,case when provider_needed then 'queued' else 'not_required' end,
  case when local_needed then 'queued' else 'not_required' end,
  case when financial_needed then 'queued' else 'not_required' end)
 on conflict(member_id) do nothing;
 if found then
  insert into commercial_billing.withdrawal_account_lifecycle_events(member_id,action,actor)
  values(target,'CLOSURE_REQUESTED','account-service');
 end if;
 if provider_needed then
  insert into commercial_billing.withdrawal_provider_cleanup_intents(member_id,provider,external_user_id,provider_applicant_id)
  values(target,'sumsub',binding.external_user_id,binding.provider_applicant_id) on conflict(member_id) do nothing;
 end if;
end$$;

create function commercial_billing.withdrawal_closure_from_profile() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' then
  perform commercial_billing.queue_withdrawal_account_closure(old.id);
  return old;
 end if;
 if new.disabled_at is not null and old.disabled_at is null then
  perform commercial_billing.queue_withdrawal_account_closure(new.id);
 end if;
 return new;
end$$;
create trigger withdrawal_account_closure after update of disabled_at or delete on public.profiles
 for each row execute function commercial_billing.withdrawal_closure_from_profile();

-- An already-issued hosted verification link or delayed provider event can
-- produce a fresh provider check after access revocation. Reopen cleanup instead
-- of hiding that new processing behind a previously completed deletion.
create function commercial_billing.withdrawal_late_provider_check() returns trigger
language plpgsql security definer set search_path='' as $$
declare target uuid; binding commercial_billing.withdrawal_identity_bindings%rowtype;
begin
 select member_id into target from commercial_billing.withdrawal_identities where id=new.identity_id;
 if not exists(select 1 from commercial_billing.withdrawal_account_lifecycle where member_id=target) then return new;end if;
 perform 1 from commercial_billing.accounts where member_id=target for update;
 select * into binding from commercial_billing.withdrawal_identity_bindings where member_id=target;
 update commercial_billing.withdrawal_account_lifecycle set provider_cleanup_state='queued',local_cleanup_state='queued',
  completed_at=null,updated_at=clock_timestamp() where member_id=target;
 insert into commercial_billing.withdrawal_provider_cleanup_intents(member_id,provider,external_user_id,provider_applicant_id)
 values(target,'sumsub',binding.external_user_id,binding.provider_applicant_id)
 on conflict(member_id) do update set provider_applicant_id=excluded.provider_applicant_id,state='queued',confirmed_at=null,evidence_reference=null;
 update private.job_runs set state='pending_review',payload=jsonb_build_object('userId',target),lease_until=null,lease_token=null,
  failure_reason='New provider processing after account closure',owner_action='Review provider cleanup and retained identity evidence'
  where kind='account_deletion' and dedupe_key='account-deletion:'||target::text;
 insert into commercial_billing.withdrawal_account_lifecycle_events(member_id,action,actor)
 values(target,'PROVIDER_EVIDENCE_AFTER_CLOSURE','identity-service');
 return new;
end$$;
create trigger withdrawal_late_provider_cleanup after insert on commercial_billing.withdrawal_identity_checks
 for each row execute function commercial_billing.withdrawal_late_provider_check();

-- Allowlisted export: no identity document, legal-name hash, ciphertext,
-- provider payload, other member's funding or operator evidence is selected.
create function private.withdrawal_account_export(target uuid,session uuid,aal text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare identity jsonb; requests jsonb; destinations jsonb; closure jsonb;
begin
 if target is distinct from auth.uid() or not commercial_billing.withdrawal_actor_allowed(target,session,aal,false)
 then raise exception 'Own active account session required';end if;
 select jsonb_build_object('provider',i.evidence->>'provider','status',i.evidence->>'status',
  'country',i.evidence->>'country','adult',i.evidence->'adult','revision',i.revision,
  'createdAt',i.created_at,'checkedAt',(select max(checked_at) from commercial_billing.withdrawal_identity_checks where identity_id=i.id))
 into identity from commercial_billing.withdrawal_identities i where i.member_id=target order by i.revision desc limit 1;
 select coalesce(jsonb_agg(jsonb_build_object('id',w.id,'status',w.status,'revision',w.revision,
  'credits',w.credits,'grossAudCents',w.gross_aud_cents,'feeCents',w.fee_cents,'audCents',w.aud_cents,
  'currency','AUD','policyVersion',w.policy_version,'destination',w.destination,'bankMask',d.mask,
  'createdAt',w.created_at,'updatedAt',w.updated_at,'sentAt',w.sent_at,'reconciledAt',w.reconciled_at,'returnedAt',w.returned_at)
  order by w.created_at,w.id),'[]'::jsonb)
 into requests from commercial_billing.withdrawals w join commercial_billing.withdrawal_destinations d on d.id=w.destination
 where w.member_id=target and d.member_id=target;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'bankMask',mask,'createdAt',created_at) order by created_at,id),'[]'::jsonb)
 into destinations from commercial_billing.withdrawal_destinations where member_id=target;
 select jsonb_build_object('requestedAt',requested_at,'providerCleanup',provider_cleanup_state,
  'localCleanup',local_cleanup_state,'financialReview',financial_review_state,'completedAt',completed_at)
 into closure from commercial_billing.withdrawal_account_lifecycle where member_id=target;
 if identity is null and requests='[]'::jsonb and destinations='[]'::jsonb and closure is null
  and not exists(select 1 from commercial_billing.withdrawal_identity_bindings where member_id=target)
 then return null;end if;
 return jsonb_build_object('identity',identity,'withdrawals',requests,'destinations',destinations,'accountClosure',closure);
end$$;

create function private.withdrawal_account_deletion_status(target uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare lifecycle commercial_billing.withdrawal_account_lifecycle%rowtype; outstanding boolean;
begin
 if exists(select 1 from public.profiles where id=target and disabled_at is null)
  or not exists(select 1 from private.job_runs where kind='account_deletion'
   and dedupe_key='account-deletion:'||target::text and (payload->>'userId'=target::text or state='done'))
 then raise exception 'Recorded revoked account deletion required';end if;
 perform commercial_billing.queue_withdrawal_account_closure(target);
 select * into lifecycle from commercial_billing.withdrawal_account_lifecycle where member_id=target;
 if not found then return null;end if;
 outstanding:=commercial_billing.withdrawal_pending_obligation(target);
 return jsonb_build_object('pending',outstanding or lifecycle.provider_cleanup_state='queued'
  or lifecycle.local_cleanup_state='queued' or lifecycle.financial_review_state='queued',
  'providerCleanup',lifecycle.provider_cleanup_state,'localCleanup',lifecycle.local_cleanup_state,
  'financialReview',case when outstanding then 'queued' else lifecycle.financial_review_state end,
  'requestedAt',lifecycle.requested_at,'completedAt',case when outstanding then null else lifecycle.completed_at end);
end$$;

-- A future reviewed operator workflow may record actual provider confirmation
-- and minimise local bank payloads. It sends nothing and runs no schedule.
-- No policy rows are inserted; every invocation fails closed until configured.
create function private.review_withdrawal_account_cleanup(target uuid,policy_version text,action text,evidence_reference text)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); current commercial_billing.withdrawal_account_lifecycle%rowtype;
begin
 if not commercial_billing.withdrawal_actor_allowed(actor,(auth.jwt()->>'session_id')::uuid,auth.jwt()->>'aal',true)
  or length(btrim(coalesce(evidence_reference,''))) not between 8 and 240
  or not exists(select 1 from commercial_billing.withdrawal_retention_policies p where p.version=policy_version and p.valid_until>clock_timestamp())
 then raise exception 'Current Owner session and approved retention evidence required';end if;
 perform 1 from commercial_billing.accounts where member_id=target for update;
 select * into current from commercial_billing.withdrawal_account_lifecycle where member_id=target for update;
 if not found or not commercial_billing.withdrawal_account_closed(target)
 then raise exception 'Recorded account closure required';end if;
 if commercial_billing.withdrawal_pending_obligation(target)
 then raise exception 'Outstanding withdrawal or recovery obligation';end if;
 if action='FINANCIAL_REVIEWED' then
  update commercial_billing.withdrawal_account_lifecycle set financial_review_state='confirmed' where member_id=target;
 elsif action='PROVIDER_CLEANUP_CONFIRMED' then
  if current.financial_review_state='queued' then raise exception 'Financial review pending';end if;
  update commercial_billing.withdrawal_provider_cleanup_intents set state='confirmed',confirmed_at=clock_timestamp(),
   evidence_reference=review_withdrawal_account_cleanup.evidence_reference where member_id=target and state='queued';
  if not found then raise exception 'Provider cleanup intent pending or already confirmed';end if;
  update commercial_billing.withdrawal_account_lifecycle set provider_cleanup_state='confirmed' where member_id=target;
 elsif action='LOCAL_PAYLOAD_PURGED' then
  if current.financial_review_state='queued' or current.provider_cleanup_state='queued'
  then raise exception 'Financial or provider review pending';end if;
  update commercial_billing.withdrawal_destination_payloads p set ciphertext=null,purged_at=clock_timestamp()
   from commercial_billing.withdrawal_destinations d where d.id=p.destination and d.member_id=target and p.ciphertext is not null;
  update commercial_billing.withdrawal_account_lifecycle set local_cleanup_state='confirmed' where member_id=target;
 else raise exception 'Unknown account cleanup action';end if;
 update commercial_billing.withdrawal_account_lifecycle set retention_policy_version=policy_version,updated_at=clock_timestamp(),
  completed_at=case when provider_cleanup_state<>'queued' and local_cleanup_state<>'queued' and financial_review_state<>'queued'
   then clock_timestamp() else null end where member_id=target;
 update private.job_runs set state='queued',available_at=clock_timestamp(),failure_reason=null,owner_action=null
  where kind='account_deletion' and dedupe_key='account-deletion:'||target::text and state='pending_review'
   and exists(select 1 from commercial_billing.withdrawal_account_lifecycle where member_id=target and completed_at is not null);
 insert into commercial_billing.withdrawal_account_lifecycle_events(member_id,action,actor,policy_version,evidence_reference)
 values(target,action,actor::text,policy_version,evidence_reference);
end$$;

create function commercial_billing.withdrawal_payload_minimisation_guard() returns trigger
language plpgsql set search_path='' as $$
begin
 if (to_jsonb(new)-array['ciphertext','purged_at']) is distinct from (to_jsonb(old)-array['ciphertext','purged_at'])
  or old.ciphertext is null or new.ciphertext is not null or new.purged_at is null
 then raise exception 'Only reviewed payload minimisation is permitted';end if;
 return new;
end$$;
create trigger withdrawal_payload_minimisation before update on commercial_billing.withdrawal_destination_payloads
 for each row execute function commercial_billing.withdrawal_payload_minimisation_guard();

do $$declare t text;begin
 foreach t in array array['withdrawal_account_lifecycle','withdrawal_provider_cleanup_intents','withdrawal_retention_policies','withdrawal_account_lifecycle_events'] loop
  execute format('alter table commercial_billing.%I enable row level security',t);
  execute format('revoke all on commercial_billing.%I from public,anon,authenticated,service_role,docked_app,docked_beta_app,docked_commercial_app',t);
 end loop;
end$$;
create trigger withdrawal_lifecycle_audit_immutable before update or delete on commercial_billing.withdrawal_account_lifecycle_events
 for each row execute function commercial_billing.immutable();
create trigger withdrawal_lifecycle_no_delete before delete on commercial_billing.withdrawal_account_lifecycle
 for each row execute function commercial_billing.immutable();
revoke all on function commercial_billing.withdrawal_account_closed(uuid),commercial_billing.withdrawal_pending_obligation(uuid),
 commercial_billing.queue_withdrawal_account_closure(uuid),commercial_billing.withdrawal_closure_from_profile(),
 commercial_billing.withdrawal_late_provider_check(),
 commercial_billing.withdrawal_payload_minimisation_guard(),private.withdrawal_account_export(uuid,uuid,text),
 private.withdrawal_account_deletion_status(uuid),private.review_withdrawal_account_cleanup(uuid,text,text,text)
 from public,anon,authenticated,service_role,docked_app,docked_beta_app,docked_commercial_app;
grant execute on function commercial_billing.withdrawal_account_closed(uuid) to docked_commercial_app;
grant execute on function private.withdrawal_account_export(uuid,uuid,text),private.withdrawal_account_deletion_status(uuid)
 to docked_app;
grant execute on function private.review_withdrawal_account_cleanup(uuid,text,text,text) to docked_app;
