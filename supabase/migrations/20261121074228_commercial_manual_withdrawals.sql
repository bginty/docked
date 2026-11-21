-- Additive, dormant manual EFT foundation. This migration approves no cash
-- policy, rate, fee, destination, KYC provider, receipt settlement or payout.
-- Sandbox redemption tables and their production fences are unchanged.
create table commercial_billing.withdrawal_policies(
 version text primary key, policy jsonb not null,
 created_at timestamptz not null default clock_timestamp(),
 check(policy->>'version'=version)
);
create table commercial_billing.withdrawal_control(
 id boolean primary key default true check(id),
 requests_enabled boolean not null default false,
 payments_enabled boolean not null default false,
 policy_version text references commercial_billing.withdrawal_policies,
 updated_at timestamptz not null default clock_timestamp(),
 check(not (requests_enabled or payments_enabled) or policy_version is not null)
);
insert into commercial_billing.withdrawal_control(id) values(true);

create table commercial_billing.withdrawal_identity_bindings(
 member_id uuid primary key references commercial_billing.accounts,
 external_user_id text not null unique,
 provider_environment text not null check(provider_environment in('production','acceptance')),
 provider_applicant_id text unique,
 created_at timestamptz not null default clock_timestamp()
);
create table commercial_billing.withdrawal_identity_sessions(
 id uuid primary key default gen_random_uuid(),
 member_id uuid not null references commercial_billing.withdrawal_identity_bindings,
 external_user_id text not null,
 expires_at timestamptz not null,
 created_at timestamptz not null default clock_timestamp()
);
create table commercial_billing.withdrawal_identities(
 id uuid primary key default gen_random_uuid(),
 member_id uuid not null references commercial_billing.accounts,
 revision integer not null check(revision>0),
 fingerprint text not null check(fingerprint~'^[a-f0-9]{64}$'),
 evidence jsonb not null,
 created_at timestamptz not null default clock_timestamp(),
 unique(member_id,revision)
);
create index withdrawal_identity_current on commercial_billing.withdrawal_identities(member_id,revision desc);
create table commercial_billing.withdrawal_identity_checks(
 id uuid primary key default gen_random_uuid(),
 identity_id uuid not null references commercial_billing.withdrawal_identities,
 checked_at timestamptz not null,
 event_id text unique,
 created_at timestamptz not null default clock_timestamp()
);
create table commercial_billing.withdrawal_destinations(
 id uuid primary key,
 member_id uuid not null references commercial_billing.accounts,
 identity_revision integer not null,
 ciphertext_hash text not null check(ciphertext_hash~'^[a-f0-9]{64}$'),
 mask text not null check(mask~'^\*{4}[0-9]{4}$'),
 created_at timestamptz not null default clock_timestamp(),
 foreign key(member_id,identity_revision) references commercial_billing.withdrawal_identities(member_id,revision)
);
-- Payload is separated so an audited retention process can erase bank details
-- while preserving the immutable hash and financial request facts.
create table commercial_billing.withdrawal_destination_payloads(
 destination uuid primary key references commercial_billing.withdrawal_destinations,
 ciphertext text check(ciphertext is null or length(ciphertext) between 80 and 8192),
 ciphertext_hash text not null check(ciphertext_hash~'^[a-f0-9]{64}$'),
 created_at timestamptz not null default clock_timestamp(),
 purged_at timestamptz,
 check((ciphertext is null)=(purged_at is not null))
);
create table commercial_billing.withdrawal_beneficiary_verifications(
 id uuid primary key default gen_random_uuid(),
 destination uuid not null references commercial_billing.withdrawal_destinations,
 identity_revision integer not null,
 verified boolean not null,
 reviewer uuid not null,
 evidence_reference text not null check(length(evidence_reference) between 8 and 240),
 reason text not null check(length(reason) between 12 and 600),
 created_at timestamptz not null default clock_timestamp()
);
create index withdrawal_beneficiary_current on commercial_billing.withdrawal_beneficiary_verifications(destination,created_at desc,id desc);

-- Actual reconciled net cash allocated to a receipt. Gross Play receipts and
-- provider receivables do not create these records automatically.
create table commercial_billing.withdrawal_cash_funding(
 id uuid primary key default gen_random_uuid(),
 receipt text not null references commercial_billing.receipts,
 net_cash_cents bigint not null check(net_cash_cents>0),
 bank_reference text not null unique,
 evidence_reference text not null,
 settled_at timestamptz not null,
 available_at timestamptz not null check(available_at>=settled_at),
 recorded_by uuid not null,
 created_at timestamptz not null default clock_timestamp()
);
create table commercial_billing.withdrawal_funding_revocations(
 funding uuid primary key references commercial_billing.withdrawal_cash_funding,
 reviewer uuid not null, evidence_reference text not null, reason text not null,
 created_at timestamptz not null default clock_timestamp()
);
create table commercial_billing.withdrawal_bank_references(
 reference text primary key,
 kind text not null check(kind in('FUNDING','SENT','RETURNED')),
 related_id uuid not null,
 created_at timestamptz not null default clock_timestamp()
);
create unique index withdrawal_bank_reference_canonical on commercial_billing.withdrawal_bank_references(lower(btrim(reference)));
create table commercial_billing.withdrawals(
 id uuid primary key default gen_random_uuid(),
 member_id uuid not null references commercial_billing.accounts,
 status text not null default 'REQUESTED' check(status in
 ('REQUESTED','UNDER_REVIEW','APPROVED','PAYMENT_IN_PROGRESS','EXCEPTION','SENT','RECONCILED','REJECTED','CANCELLED','RELEASED','RETURNED')),
 revision integer not null default 1 check(revision>0),
 credits bigint not null check(credits>0),
 gross_aud_cents bigint not null check(gross_aud_cents>0),
 fee_cents bigint not null check(fee_cents>=0),
 aud_cents bigint not null check(aud_cents>0 and aud_cents+fee_cents=gross_aud_cents),
 policy_version text not null references commercial_billing.withdrawal_policies,
 policy_snapshot jsonb not null,
 identity_id uuid not null references commercial_billing.withdrawal_identities,
 identity_revision integer not null,
 destination uuid not null references commercial_billing.withdrawal_destinations,
 destination_snapshot jsonb not null,
 beneficiary_verification uuid references commercial_billing.withdrawal_beneficiary_verifications,
 claimed_by uuid, claimed_at timestamptz,
 bank_reference text unique, return_reference text unique,
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 sent_at timestamptz, reconciled_at timestamptz, returned_at timestamptz,
 transaction_id bigint not null default txid_current(),
 foreign key(member_id,identity_revision) references commercial_billing.withdrawal_identities(member_id,revision)
);
create index withdrawal_member_history on commercial_billing.withdrawals(member_id,created_at desc,id);
create table commercial_billing.withdrawal_allocations(
 id uuid primary key default gen_random_uuid(),
 withdrawal uuid not null references commercial_billing.withdrawals,
 lot uuid not null references commercial_billing.lots,
 root_lot uuid not null references commercial_billing.lots,
 receipt text not null references commercial_billing.receipts,
 funding uuid not null references commercial_billing.withdrawal_cash_funding,
 credits bigint not null check(credits>0),
 cash_cents bigint not null check(cash_cents>0),
 created_at timestamptz not null default clock_timestamp(),
 unique(withdrawal,lot,funding)
);
create index withdrawal_source_exposure on commercial_billing.withdrawal_allocations(receipt,withdrawal);
create index withdrawal_funding_reserved on commercial_billing.withdrawal_allocations(funding,withdrawal);
create function commercial_billing.withdrawal_allocation_guard() returns trigger
language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from commercial_billing.withdrawals w
  join commercial_billing.lots l on l.id=new.lot and l.member_id=w.member_id and l.receipt=new.receipt
  join commercial_billing.lots root on root.id=new.root_lot and root.receipt=new.receipt
  join commercial_billing.withdrawal_cash_funding f on f.id=new.funding and f.receipt=new.receipt
  where w.id=new.withdrawal and w.status='REQUESTED' and w.transaction_id=txid_current())
 then raise exception 'Cannot append or change committed withdrawal funding';end if;
 return new;
end$$;
create trigger withdrawal_allocation_transaction before insert on commercial_billing.withdrawal_allocations
 for each row execute function commercial_billing.withdrawal_allocation_guard();
create function commercial_billing.withdrawal_reservation_complete() returns trigger
language plpgsql set search_path='' as $$
begin
 if (select coalesce(sum(credits),0) from commercial_billing.withdrawal_allocations where withdrawal=new.id)<>new.credits
 or (select coalesce(sum(cash_cents),0) from commercial_billing.withdrawal_allocations where withdrawal=new.id)<>new.gross_aud_cents
 or not exists(select 1 from commercial_billing.journals j join commercial_billing.lines l on l.journal=j.id
  where j.id='withdrawal:'||new.id||':reserve' and j.unit='CREDITS'
  and l.account='member:'||new.member_id and l.amount=-new.credits)
 or not exists(select 1 from commercial_billing.lines where journal='withdrawal:'||new.id||':reserve'
  and account='withdrawal:'||new.id||':reserved' and amount=new.credits)
 then raise exception 'Withdrawal reservation must be fully allocated and balanced';end if;
 return null;
end$$;
create constraint trigger withdrawal_reservation_complete after insert on commercial_billing.withdrawals
 deferrable initially deferred for each row execute function commercial_billing.withdrawal_reservation_complete();
create table commercial_billing.withdrawal_compensation_lots(
 lot uuid primary key references commercial_billing.lots,
 allocation uuid not null unique references commercial_billing.withdrawal_allocations,
 root_lot uuid not null references commercial_billing.lots,
 reason text not null check(reason in('CANCELLED','REJECTED','RELEASED','RETURNED')),
 created_at timestamptz not null default clock_timestamp()
);
create table commercial_billing.withdrawal_exposure_resolutions(
 allocation uuid not null references commercial_billing.withdrawal_allocations,
 source_version text not null check(source_version~'^[a-f0-9]{32}$'),
 reviewer uuid not null, evidence_reference text not null, reason text not null,
 created_at timestamptz not null default clock_timestamp(),
 primary key(allocation,source_version)
);
create table commercial_billing.withdrawal_events(
 id bigint generated always as identity primary key,
 withdrawal uuid references commercial_billing.withdrawals,
 actor uuid not null, action text not null, details jsonb not null,
 created_at timestamptz not null default clock_timestamp()
);
create table commercial_billing.withdrawal_commands(
 actor uuid not null, request uuid not null,
 command_digest text not null check(command_digest~'^[a-f0-9]{64}$'),
 result jsonb not null,
 created_at timestamptz not null default clock_timestamp(),
 primary key(actor,request)
);

create function commercial_billing.withdrawal_binding_guard() returns trigger
language plpgsql set search_path='' as $$
begin
 if (to_jsonb(new)-'provider_applicant_id') is distinct from (to_jsonb(old)-'provider_applicant_id')
 or old.provider_applicant_id is not null or new.provider_applicant_id is null
 then raise exception 'Provider identity binding immutable'; end if;
 return new;
end$$;
create trigger withdrawal_binding_immutable before update on commercial_billing.withdrawal_identity_bindings
 for each row execute function commercial_billing.withdrawal_binding_guard();

create function commercial_billing.withdrawal_guard() returns trigger
language plpgsql set search_path='' as $$
begin
 if tg_op='INSERT' then
  if new.status<>'REQUESTED' or new.revision<>1 or new.claimed_by is not null
   or new.bank_reference is not null or new.return_reference is not null
  then raise exception 'New withdrawal must be unclaimed';end if;
 else
  if (to_jsonb(new)-array['status','revision','updated_at','beneficiary_verification','claimed_by','claimed_at','bank_reference','return_reference','sent_at','reconciled_at','returned_at'])
   is distinct from (to_jsonb(old)-array['status','revision','updated_at','beneficiary_verification','claimed_by','claimed_at','bank_reference','return_reference','sent_at','reconciled_at','returned_at'])
  or new.revision<>old.revision+1
  or (old.claimed_by is not null and new.claimed_by is distinct from old.claimed_by)
  or (old.claimed_at is not null and new.claimed_at is distinct from old.claimed_at)
  or (old.bank_reference is not null and new.bank_reference is distinct from old.bank_reference)
  or (old.return_reference is not null and new.return_reference is distinct from old.return_reference)
  or (old.sent_at is not null and new.sent_at is distinct from old.sent_at)
  or (old.reconciled_at is not null and new.reconciled_at is distinct from old.reconciled_at)
  then raise exception 'Frozen withdrawal facts immutable';end if;
  if not ((old.status='REQUESTED' and new.status in('UNDER_REVIEW','APPROVED','REJECTED','CANCELLED'))
   or (old.status='UNDER_REVIEW' and new.status in('APPROVED','REJECTED','CANCELLED'))
   or (old.status='APPROVED' and new.status in('PAYMENT_IN_PROGRESS','REJECTED','CANCELLED'))
   or (old.status='PAYMENT_IN_PROGRESS' and new.status in('EXCEPTION','SENT'))
   or (old.status='EXCEPTION' and new.status in('SENT','RELEASED'))
   or (old.status='SENT' and new.status in('RECONCILED','RETURNED'))
   or (old.status='RECONCILED' and new.status='RETURNED'))
  then raise exception 'Invalid withdrawal lifecycle transition';end if;
 end if;
 if new.status in('PAYMENT_IN_PROGRESS','EXCEPTION','SENT','RECONCILED','RELEASED','RETURNED')
  and (new.claimed_by is null or new.claimed_at is null)
 then raise exception 'Payment lifecycle requires a durable claimant';end if;
 if new.status in('SENT','RECONCILED','RETURNED') and (new.bank_reference is null or new.sent_at is null)
 then raise exception 'Sent payment requires bank evidence';end if;
 return new;
end$$;
create trigger withdrawal_frozen_facts before insert or update on commercial_billing.withdrawals
 for each row execute function commercial_billing.withdrawal_guard();

-- A refunded receipt can fund a different member's resale proceeds. Existing
-- recovery_cases hold the purchaser; this preserves the additional seller
-- exposure, including after cash has left, until explicitly resolved.
create function commercial_billing.withdrawal_source_version(allocation uuid) returns text
language sql stable security definer set search_path='' as $$
 select md5(jsonb_build_object('receipt',r.key,'state',r.state,'refundedCents',r.refunded_cents,'providerAt',r.provider_at,
  'recovery',(select jsonb_build_object('state',c.state,'revision',c.revision,'exposure',c.exposure_credits) from commercial_billing.recovery_cases c where c.receipt=r.key),
  'fundingRevocation',(select jsonb_build_object('evidence',v.evidence_reference,'at',v.created_at) from commercial_billing.withdrawal_funding_revocations v where v.funding=a.funding))::text)
 from commercial_billing.withdrawal_allocations a join commercial_billing.receipts r on r.key=a.receipt where a.id=allocation
$$;
create function commercial_billing.withdrawal_member_held(target uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from commercial_billing.withdrawal_allocations a
 join commercial_billing.withdrawals w on w.id=a.withdrawal
 join commercial_billing.receipts r on r.key=a.receipt
 where w.member_id=target and (r.state<>'PURCHASED' or r.refunded_cents>0
  or exists(select 1 from commercial_billing.recovery_cases c where c.receipt=r.key and c.state='OPEN')
  or exists(select 1 from commercial_billing.withdrawal_funding_revocations v where v.funding=a.funding))
 and not exists(select 1 from commercial_billing.withdrawal_exposure_resolutions x where x.allocation=a.id and x.source_version=commercial_billing.withdrawal_source_version(a.id)))
$$;
create function commercial_billing.withdrawal_lot_hold_guard() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.remaining<old.remaining and new.refund_removed=old.refund_removed
  and commercial_billing.withdrawal_member_held(old.member_id)
 then raise exception 'Withdrawal source exposure requires account review';end if;
 return new;
end$$;
create trigger withdrawal_source_spending_hold before update on commercial_billing.lots
 for each row execute function commercial_billing.withdrawal_lot_hold_guard();

create function commercial_billing.withdrawal_mfa_satisfied(viewer uuid,aal text) returns boolean
language plpgsql stable security definer set search_path='' as $$
begin
 if aal='aal2' then return true;end if;
 if to_regclass('auth.mfa_factors') is null then return false;end if;
 return not exists(select 1 from auth.mfa_factors f where f.user_id=viewer and f.status='verified');
end$$;
create function commercial_billing.withdrawal_actor_allowed(viewer uuid,session uuid,aal text,owner boolean)
returns boolean language sql volatile security definer set search_path='' as $$
 select viewer is not null and viewer=auth.uid()
 and session::text=auth.jwt()->>'session_id' and aal=auth.jwt()->>'aal'
 and private.active_member_session()
 and commercial_billing.withdrawal_mfa_satisfied(viewer,aal)
 and exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id
  where s.id=session and u.id=viewer and u.deleted_at is null
  and (s.not_after is null or s.not_after>clock_timestamp())
  and (u.banned_until is null or u.banned_until<=clock_timestamp()))
 and (not owner or (aal='aal2' and exists(select 1 from private.roles where user_id=viewer and role='owner')))
$$;
create function commercial_billing.withdrawal_member_allowed(target uuid,terms_version text,privacy_version text)
returns boolean language sql volatile security definer set search_path='' as $$
 select private.active_member_session()
 and (target=auth.uid() or (auth.jwt()->>'aal'='aal2' and exists(select 1 from private.roles where user_id=auth.uid() and role='owner')))
 and exists(select 1 from public.profiles p join auth.users u on u.id=p.id
  where p.id=target and p.disabled_at is null and p.country='AU' and p.age_attested
  and p.accepted_version=terms_version and u.email_confirmed_at is not null and u.deleted_at is null
  and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until<=clock_timestamp())
  and private.public_phone_verified(p.id)
  and exists(select 1 from private.consent_events c where c.user_id=p.id and c.purpose='privacy'
   and c.granted and c.version=privacy_version and c.id=(select id from private.consent_events
    where user_id=p.id and purpose='privacy' order by created_at desc,id desc limit 1))
  and exists(select 1 from lateral(select * from private.region_policies r
   where r.country=p.country and r.state=p.state and r.effective_from<=clock_timestamp()
    and r.effective_to>clock_timestamp() order by r.effective_from desc,r.id desc limit 1)r
   where not r.preview_community_only and r.approved and r.minimum_age=18 and r.review_at>clock_timestamp()))
 and not exists(select 1 from private.social_profiles where user_id=target and status not in('active','restricted'))
$$;
create function commercial_billing.lock_withdrawal_control() returns setof commercial_billing.withdrawal_control
language sql security definer set search_path='' as $$select * from commercial_billing.withdrawal_control where id for share$$;
create function commercial_billing.stop_withdrawals(actor uuid,reason text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if length(btrim(reason)) not between 12 and 600 or not coalesce(commercial_billing.withdrawal_actor_allowed(actor,(auth.jwt()->>'session_id')::uuid,auth.jwt()->>'aal',true),false)
 then raise exception 'Current Owner MFA session and stop reason required';end if;
 update commercial_billing.withdrawal_control set requests_enabled=false,payments_enabled=false,updated_at=clock_timestamp() where id;
 insert into commercial_billing.withdrawal_events(actor,action,details) values(actor,'emergency-stop',jsonb_build_object('reason',reason));
end$$;

do $$declare t text;begin
 foreach t in array array['withdrawal_policies','withdrawal_control','withdrawal_identity_bindings','withdrawal_identity_sessions','withdrawal_identities','withdrawal_identity_checks','withdrawal_destinations','withdrawal_destination_payloads','withdrawal_beneficiary_verifications','withdrawal_cash_funding','withdrawal_funding_revocations','withdrawal_bank_references','withdrawals','withdrawal_allocations','withdrawal_compensation_lots','withdrawal_exposure_resolutions','withdrawal_events','withdrawal_commands'] loop
  execute format('alter table commercial_billing.%I enable row level security',t);
  execute format('revoke all on commercial_billing.%I from public,anon,authenticated,service_role,docked_app,docked_beta_app',t);
  execute format('create policy commercial_server on commercial_billing.%I to docked_commercial_app using(true) with check(true)',t);
  execute format('grant select on commercial_billing.%I to docked_commercial_app',t);
  if t not in('withdrawal_control','withdrawal_policies') then
   execute format('grant insert on commercial_billing.%I to docked_commercial_app',t);
  end if;
  if t not in('withdrawal_control','withdrawals','withdrawal_identity_bindings','withdrawal_destination_payloads') then
   execute format('create trigger withdrawal_immutable before update or delete on commercial_billing.%I for each row execute function commercial_billing.immutable()',t);
  else
   execute format('create trigger withdrawal_no_delete before delete on commercial_billing.%I for each row execute function commercial_billing.immutable()',t);
  end if;
 end loop;
end$$;
grant update on commercial_billing.withdrawals to docked_commercial_app;
grant update(provider_applicant_id) on commercial_billing.withdrawal_identity_bindings to docked_commercial_app;
grant usage,select on sequence commercial_billing.withdrawal_events_id_seq to docked_commercial_app;
revoke all on function commercial_billing.withdrawal_binding_guard(),commercial_billing.withdrawal_guard(),
 commercial_billing.withdrawal_allocation_guard(),commercial_billing.withdrawal_reservation_complete(),
 commercial_billing.withdrawal_member_held(uuid),commercial_billing.withdrawal_lot_hold_guard(),
 commercial_billing.withdrawal_source_version(uuid),commercial_billing.withdrawal_mfa_satisfied(uuid,text),
 commercial_billing.withdrawal_actor_allowed(uuid,uuid,text,boolean),commercial_billing.withdrawal_member_allowed(uuid,text,text),
 commercial_billing.lock_withdrawal_control(),commercial_billing.stop_withdrawals(uuid,text) from public,anon,authenticated,service_role,docked_app,docked_beta_app,docked_commercial_app;
grant execute on function commercial_billing.withdrawal_member_held(uuid),
 commercial_billing.withdrawal_source_version(uuid),
 commercial_billing.withdrawal_actor_allowed(uuid,uuid,text,boolean),commercial_billing.withdrawal_member_allowed(uuid,text,text),
 commercial_billing.lock_withdrawal_control(),commercial_billing.stop_withdrawals(uuid,text) to docked_commercial_app;
-- No runtime policy/activation authority, login, real documents, payout bank,
-- external payment call, identity evidence or member balance is provisioned.
