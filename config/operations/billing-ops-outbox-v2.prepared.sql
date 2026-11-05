-- V2 PREPARED ONLY: v1 remains preserved/unapproved. No Production apply.
-- Existing outbox/flags/audit and existing roles only; no schedule or email send.
begin;
do $preflight$
declare spec record;
begin
 if not exists(select 1 from pg_class where oid=to_regclass('private.outbox') and relrowsecurity) then raise exception 'Existing RLS outbox required'; end if;
 if not exists(select 1 from pg_class where oid=to_regclass('private.audit_events') and relrowsecurity) then raise exception 'Existing RLS audit boundary required'; end if;
 for spec in select * from (values('id','uuid'),('dedupe_key','text'),('kind','text'),('user_id','uuid'),('payload','jsonb'),('state','text'),('available_at','timestamp with time zone'),('expires_at','timestamp with time zone'),('lease_until','timestamp with time zone'),('lease_token','uuid'),('attempts','integer'),('last_error','text'),('created_at','timestamp with time zone')) v(name,typ) loop
  if not exists(select 1 from pg_attribute where attrelid='private.outbox'::regclass and attname=spec.name and format_type(atttypid,atttypmod)=spec.typ and not attisdropped) then raise exception 'Unexpected outbox schema'; end if;
 end loop;
 if not exists(select 1 from pg_attribute where attrelid='private.outbox'::regclass and attname='dedupe_key' and attnotnull and not attisdropped) then raise exception 'Existing dedupe_key NOT NULL boundary required'; end if;
 if to_regclass('private.feature_flags') is null or to_regclass('private.audit_events') is null or to_regclass('private.docked_auth_mail_outbox') is null or to_regclass('commercial_billing.jobs') is null or to_regclass('commercial_billing.recovery_cases') is null or to_regclass('credits_sandbox.store_notifications') is null then raise exception 'Existing health dependencies required'; end if;
 if exists(select 1 from unnest(array['commercial_billing.control','commercial_billing.receipts','commercial_billing.lots','commercial_billing.lines','commercial_billing.journals','commercial_billing.packs','commercial_billing.cards','commercial_billing.definitions']) required(name) where to_regclass(name) is null) then raise exception 'Existing financial invariant dependencies required'; end if;
 if not exists(select 1 from pg_roles where rolname='docked_commercial_app') or not exists(select 1 from pg_roles where rolname='service_role') then raise exception 'Existing restricted roles required'; end if;
 if exists(select 1 from private.feature_flags where key='billing_ops_alerts' and enabled) then raise exception 'Close operational alert admission before preparing functions'; end if;
 if exists(select 1 from private.outbox where payload->>'purpose'='billing_ops_health_v1' or dedupe_key like any(array['billing-ops-v1:%','billing-ops-v2:%'])) then
  if to_regprocedure('private.billing_ops_key(jsonb,timestamp with time zone)') is null or to_regprocedure('public.docked_billing_ops_enqueue()') is null then raise exception 'Reserved operational purpose/prefix collision; existing record review required'; end if;
  if exists(select 1 from private.outbox where (payload->>'purpose'='billing_ops_health_v1' or dedupe_key like any(array['billing-ops-v1:%','billing-ops-v2:%'])) and (kind<>'service' or user_id is not null or payload->>'purpose' is distinct from 'billing_ops_health_v1' or not (dedupe_key like any(array['billing-ops-v1:%','billing-ops-v2:%'])) or private.billing_ops_key(payload->'health',(payload->>'observedAt')::timestamptz) is distinct from dedupe_key)) then raise exception 'Existing reserved record differs; explicit review required'; end if;
 end if;
end $preflight$;
insert into private.feature_flags(key,enabled,reason) values('billing_ops_alerts',false,'Prepared aggregate-only operational alerts; approved recipient/window, durable worker and delivery drill required') on conflict do nothing;

-- NULL-safe reservation: ordinary customer service/education rows are unchanged.
-- Owner-definer functions alone can create/change this reserved purpose/prefix.
drop policy if exists billing_ops_reserved_select on private.outbox;
create policy billing_ops_reserved_select on private.outbox as restrictive for select to public using(payload->>'purpose' is distinct from 'billing_ops_health_v1' and not (dedupe_key like any(array['billing-ops-v1:%','billing-ops-v2:%'])));
drop policy if exists billing_ops_reserved_insert on private.outbox;
create policy billing_ops_reserved_insert on private.outbox as restrictive for insert to public with check(payload->>'purpose' is distinct from 'billing_ops_health_v1' and not (dedupe_key like any(array['billing-ops-v1:%','billing-ops-v2:%'])));
drop policy if exists billing_ops_reserved_update on private.outbox;
create policy billing_ops_reserved_update on private.outbox as restrictive for update to public using(payload->>'purpose' is distinct from 'billing_ops_health_v1' and not (dedupe_key like any(array['billing-ops-v1:%','billing-ops-v2:%']))) with check(payload->>'purpose' is distinct from 'billing_ops_health_v1' and not (dedupe_key like any(array['billing-ops-v1:%','billing-ops-v2:%'])));
drop policy if exists billing_ops_reserved_delete on private.outbox;
create policy billing_ops_reserved_delete on private.outbox as restrictive for delete to public using(payload->>'purpose' is distinct from 'billing_ops_health_v1' and not (dedupe_key like any(array['billing-ops-v1:%','billing-ops-v2:%'])));
drop policy if exists billing_ops_signal_reserved_insert on private.audit_events;
create policy billing_ops_signal_reserved_insert on private.audit_events as restrictive for insert to public with check(action is distinct from 'billing_ops_signal');
create index if not exists billing_ops_signal_recent on private.audit_events(created_at) where action='billing_ops_signal';

create or replace function private.billing_ops_window() returns boolean
language plpgsql stable set search_path='' as $fn$
declare p jsonb;
begin
 if not exists(select 1 from private.feature_flags where key='billing_ops_alerts' and enabled) then return false; end if;
 select approvals->'opsAlerts' into p from commercial_billing.control where id;
 return coalesce(p->>'version'='billing-ops-policy-v2' and p->>'purpose'='billing_ops_health_v1' and p->>'recipient'='support@docked.com.au' and length(trim(p->>'authority'))>=20 and (p->>'validUntil')::timestamptz>clock_timestamp(),false);
exception when others then return false;
end $fn$;

create or replace function private.billing_ops_key(counts jsonb,observed timestamptz) returns text
language plpgsql immutable set search_path='' as $fn$
declare n text; names text[]:=array['commercialAttention','commercialOverdue','openRecoveryCases','testAttention','testOverdue','authMailFailures','authMailPending','authMailOverdue']; values_text text[]:='{}'; version text:='v1';
begin
 if observed is null or jsonb_typeof(counts) is distinct from 'object' then raise exception 'Complete aggregate counters required'; end if;
 if (select count(*) from jsonb_object_keys(counts))=20 then
  names:=names||array['purchaseFulfilmentFailures','duplicateReceiptAttempts','receiptReplayRejections','refundReconciliationFailures','walletLedgerMismatches','ledgerIntegrityFailures','packIssuanceFailures','opsNotificationFailures','reconciliationStaleReceipts','receiptAcknowledgementFailures','reconciliationFailures','receiptVerificationFailures']; version:='v2';
 elsif (select count(*) from jsonb_object_keys(counts))<>8 then raise exception 'Complete aggregate counters required'; end if;
 foreach n in array names loop
  if jsonb_typeof(counts->n) is distinct from 'number' or (counts->>n)!~'^[0-9]+$' or (counts->>n)::numeric>9007199254740991 then raise exception 'Invalid aggregate counter'; end if;
  -- A delivery problem is visible in context, but must not generate or vary an
  -- email in its own failing channel. Independent logs handle that escalation.
  if n<>'opsNotificationFailures' then values_text:=array_append(values_text,counts->>n); end if;
 end loop;
 return 'billing-ops-'||version||':'||to_char(date_trunc('hour',observed at time zone 'UTC'),'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')||':'||encode(sha256(convert_to(array_to_string(values_text,','),'UTF8')),'hex');
end $fn$;

-- A random per-attempt UUID is the sole idempotency reference. No customer,
-- receipt, token, provider payload, raw error or caller-selected message is kept.
create or replace function public.docked_billing_ops_signal(p_code text,p_operation uuid) returns boolean
language plpgsql security definer set search_path='' as $fn$
declare inserted uuid; prior private.audit_events;
begin
 if not private.billing_ops_window() then return false; end if;
 if p_operation is null or p_code is null or p_code not in('receipt_verification_failed','purchase_fulfilment_failed','receipt_duplicate_retry','receipt_replay_rejected','refund_reconciliation_failed','pack_issuance_failed','pack_supply_unavailable','acknowledgement_failed','reconciliation_failed') then raise exception 'Unsupported operational signal'; end if;
 insert into private.audit_events(id,actor,action,subject,details) values(p_operation,'billing-ops-observer','billing_ops_signal','billing-ops',jsonb_build_object('code',p_code)) on conflict(id) do nothing returning id into inserted;
 if inserted is null then
  select * into strict prior from private.audit_events where id=p_operation;
  if prior.action<>'billing_ops_signal' or prior.subject<>'billing-ops' or prior.details is distinct from jsonb_build_object('code',p_code) then raise exception 'Operational signal idempotency conflict'; end if;
 end if;
 return inserted is not null;
end $fn$;

-- No client-supplied recipient, message, customer, receipt, token or counter.
-- PUBLIC schema avoids granting the commercial role USAGE on all private code.
create or replace function public.docked_billing_ops_enqueue() returns uuid
language plpgsql security definer set search_path='' as $fn$
declare h jsonb; observed timestamptz:=clock_timestamp(); k text; target uuid; prior private.outbox;
begin
 if not private.billing_ops_window() then return null; end if;
 select jsonb_build_object(
  'commercialAttention',(select count(*) from commercial_billing.jobs where state='attention'),
  'commercialOverdue',(select count(*) from commercial_billing.jobs where state in('pending','working') and created_at<clock_timestamp()-interval '1 hour'),
  'openRecoveryCases',(select count(*) from commercial_billing.recovery_cases where state='OPEN'),
  'testAttention',(select count(*) from credits_sandbox.store_notifications where state='attention'),
  'testOverdue',(select count(*) from credits_sandbox.store_notifications where state in('pending','working') and created_at<clock_timestamp()-interval '1 hour'),
  'authMailFailures',(select count(*) from private.docked_auth_mail_outbox where state in('failed','unknown')),
  'authMailPending',(select count(*) from private.docked_auth_mail_outbox where state in('pending','authorizing','dispatching')),
  'authMailOverdue',(select count(*) from private.docked_auth_mail_outbox where state in('pending','authorizing','dispatching') and expires_at<=clock_timestamp()),
  'purchaseFulfilmentFailures',(select count(*) from private.audit_events where action='billing_ops_signal' and details->>'code'='purchase_fulfilment_failed' and created_at>clock_timestamp()-interval '1 hour')+(select count(*) from commercial_billing.receipts r where r.state='PURCHASED' and (not r.credited or not r.money_recorded or not exists(select 1 from commercial_billing.lots l where l.receipt=r.key))),
  'duplicateReceiptAttempts',(select count(*) from private.audit_events where action='billing_ops_signal' and details->>'code'='receipt_duplicate_retry' and created_at>clock_timestamp()-interval '1 hour'),
  'receiptReplayRejections',(select count(*) from private.audit_events where action='billing_ops_signal' and details->>'code'='receipt_replay_rejected' and created_at>clock_timestamp()-interval '1 hour'),
  'refundReconciliationFailures',(select count(*) from private.audit_events where action='billing_ops_signal' and details->>'code'='refund_reconciliation_failed' and created_at>clock_timestamp()-interval '1 hour')+(select count(*) from commercial_billing.receipts r join commercial_billing.lots l on l.receipt=r.key where r.state='REVOKED' and r.refunded_cents=r.gross_cents and l.remaining>0),
  'walletLedgerMismatches',(select count(*) from (select member from (select account member,sum(l.amount) ledger from commercial_billing.lines l join commercial_billing.journals j on j.id=l.journal where j.unit='CREDITS' and account like 'member:%' group by account) a full join (select 'member:'||member_id::text member,sum(remaining) available from commercial_billing.lots group by member_id) b using(member) where coalesce(ledger,0)<>coalesce(available,0)) mismatch),
  'ledgerIntegrityFailures',(select count(*) from commercial_billing.journals j where (select count(*) from commercial_billing.lines l where l.journal=j.id)<2 or (select coalesce(sum(amount),0) from commercial_billing.lines l where l.journal=j.id)<>0),
  'packIssuanceFailures',(select count(*) from private.audit_events where action='billing_ops_signal' and details->>'code' in('pack_issuance_failed','pack_supply_unavailable') and created_at>clock_timestamp()-interval '1 hour')+(select count(*) from commercial_billing.packs p where jsonb_typeof(p.product->'cards') is distinct from 'number' or case when (p.product->>'cards')~'^[0-9]+$' then (p.product->>'cards')::numeric<>(select count(*) from commercial_billing.cards c where c.pack=p.id) else true end)+(select count(*) from commercial_billing.definitions d where d.issued<>d.legacy_issued+(select count(*) from commercial_billing.cards c where c.definition=d.id)),
  'opsNotificationFailures',(select count(*) from private.outbox o where o.payload->>'purpose'='billing_ops_health_v1' and (o.state='dead' or o.state='leased' and o.payload->>'phase'='dispatching' and o.lease_until<clock_timestamp())),
  'reconciliationStaleReceipts',(select count(*) from commercial_billing.receipts where state in('PENDING','PURCHASED','REVIEW') and next_reconcile_at<clock_timestamp()-interval '1 hour'),
  'receiptAcknowledgementFailures',(select count(*) from private.audit_events where action='billing_ops_signal' and details->>'code'='acknowledgement_failed' and created_at>clock_timestamp()-interval '1 hour')+(select count(*) from commercial_billing.jobs where kind='consume' and attempts>0 and state in('pending','working','attention')),
  'reconciliationFailures',(select count(*) from private.audit_events where action='billing_ops_signal' and details->>'code'='reconciliation_failed' and created_at>clock_timestamp()-interval '1 hour'),
  'receiptVerificationFailures',(select count(*) from private.audit_events where action='billing_ops_signal' and details->>'code'='receipt_verification_failed' and created_at>clock_timestamp()-interval '1 hour')
 ) into h;
 if not exists(select 1 from jsonb_each_text(h) x where x.key not in('authMailPending','duplicateReceiptAttempts','opsNotificationFailures') and x.value::bigint>0) then return null; end if;
 k:=private.billing_ops_key(h,observed);
 insert into private.outbox(dedupe_key,kind,user_id,payload,expires_at) values(k,'service',null,jsonb_build_object('purpose','billing_ops_health_v1','health',h,'observedAt',to_char(observed at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'phase','queued'),observed+interval '1 hour') on conflict(dedupe_key) do nothing returning id into target;
 if target is null then
  select * into strict prior from private.outbox where dedupe_key=k;
  if prior.kind<>'service' or prior.user_id is not null or prior.payload->>'purpose' is distinct from 'billing_ops_health_v1' or private.billing_ops_key(prior.payload->'health',(prior.payload->>'observedAt')::timestamptz)<>k then raise exception 'Operational idempotency conflict'; end if;
  return prior.id;
 end if;
 insert into private.audit_events(actor,action,subject,details) values('billing-ops-producer','billing_ops_enqueued',target::text,jsonb_build_object('key',k,'purpose','billing_ops_health_v1'));
 return target;
end $fn$;

-- Actual DB EXECUTE privileges authenticate this RPC. No auth.role(), custom JWT
-- claim or SECURITY DEFINER current_user check is treated as caller authority.
create or replace function public.docked_billing_ops_queue(p_action text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare r private.outbox; worker uuid; target uuid; outcome text; destination text; phase text;
begin
 if jsonb_typeof(p_data) is distinct from 'object' or p_action is null or p_action not in('claim','fence','settle') then raise exception 'Invalid operational action'; end if;
 worker:=(p_data->>'worker')::uuid;
 if worker is null then raise exception 'Worker required'; end if;
 if p_action='claim' then
  if p_data-array['worker']<>'{}'::jsonb then raise exception 'Invalid claim input'; end if;
  if not private.billing_ops_window() then return null; end if;
  -- Bounded cleanup. A previous dispatch fence can NEVER be leased again.
  with changed as (
   update private.outbox set state='dead',last_error='billing_ops_unknown_after_dispatch',lease_until=null,payload=payload||jsonb_build_object('outcome','unknown','phase','complete') where id in(
    select id from private.outbox where kind='service' and user_id is null and payload->>'purpose'='billing_ops_health_v1' and dedupe_key like any(array['billing-ops-v1:%','billing-ops-v2:%']) and state='leased' and payload->>'phase'='dispatching' and lease_until<clock_timestamp() order by created_at,id for update skip locked limit 20) returning id
  ) insert into private.audit_events(actor,action,subject,details) select 'billing-ops-worker','billing_ops_held_unknown',id::text,'{}'::jsonb from changed;
  with changed as (
   update private.outbox set state='dead',last_error='billing_ops_expired_or_exhausted',lease_until=null,payload=payload||jsonb_build_object('outcome','expired','phase','complete') where id in(
    select id from private.outbox where kind='service' and user_id is null and payload->>'purpose'='billing_ops_health_v1' and dedupe_key like any(array['billing-ops-v1:%','billing-ops-v2:%']) and state in('queued','leased') and payload->>'phase'<>'dispatching' and (expires_at<=clock_timestamp() or attempts>=5 and (lease_until is null or lease_until<clock_timestamp())) order by created_at,id for update skip locked limit 20) returning id
  ) insert into private.audit_events(actor,action,subject,details) select 'billing-ops-worker','billing_ops_expired',id::text,'{}'::jsonb from changed;
  select * into r from private.outbox where kind='service' and user_id is null and payload->>'purpose'='billing_ops_health_v1' and dedupe_key like any(array['billing-ops-v1:%','billing-ops-v2:%']) and available_at<=clock_timestamp() and expires_at>clock_timestamp() and attempts<5 and (state='queued' or state='leased' and lease_until<clock_timestamp()) and payload->>'phase' in('queued','claimed') order by created_at,id for update skip locked limit 1;
  if not found then return null; end if;
  update private.outbox set state='leased',lease_token=worker,lease_until=clock_timestamp()+interval '60 seconds',attempts=attempts+1,payload=payload||jsonb_build_object('phase','claimed') where id=r.id returning * into r;
  insert into private.audit_events(actor,action,subject,details) values('billing-ops-worker','billing_ops_claimed',r.id::text,jsonb_build_object('attempt',r.attempts));
  return jsonb_build_object('id',r.id,'lease',worker,'health',r.payload->'health','observedAt',r.payload->'observedAt');
 end if;
 if p_action='fence' and p_data-array['id','worker','key']<>'{}'::jsonb or p_action='settle' and p_data-array['id','worker','outcome']<>'{}'::jsonb then raise exception 'Unexpected operational input'; end if;
 target:=(p_data->>'id')::uuid;
 select * into r from private.outbox where id=target and kind='service' and user_id is null and payload->>'purpose'='billing_ops_health_v1' and dedupe_key like any(array['billing-ops-v1:%','billing-ops-v2:%']) for update;
 if not found or r.lease_token is distinct from worker then raise exception 'Operational lease unavailable'; end if;
 if p_action='settle' and r.payload->>'phase'='complete' and r.payload->>'outcome'=p_data->>'outcome' then return jsonb_build_object('outcome',p_data->>'outcome'); end if;
 if r.state<>'leased' or r.lease_until is null or r.lease_until<=clock_timestamp() then raise exception 'Operational lease expired'; end if;
 phase:=r.payload->>'phase';
 if p_action='fence' then
  if phase='dispatching' then return jsonb_build_object('fenced',false); end if;
  if not private.billing_ops_window() or phase<>'claimed' or r.expires_at<=clock_timestamp() or p_data->>'key' is distinct from r.dedupe_key or private.billing_ops_key(r.payload->'health',(r.payload->>'observedAt')::timestamptz)<>r.dedupe_key then raise exception 'Operational dispatch denied'; end if;
  update private.outbox set payload=payload||jsonb_build_object('phase','dispatching','dispatchedAt',clock_timestamp()) where id=r.id;
  insert into private.audit_events(actor,action,subject,details) values('billing-ops-worker','billing_ops_dispatch_fenced',r.id::text,'{}');
  return jsonb_build_object('fenced',true);
 end if;
 outcome:=p_data->>'outcome';
 if outcome is null or not (phase='dispatching' and outcome in('accepted','unknown') or phase='claimed' and outcome in('healthy','invalid')) then raise exception 'Invalid operational transition'; end if;
 destination:=case outcome when 'accepted' then 'sent' when 'healthy' then 'suppressed' else 'dead' end;
 update private.outbox set state=destination,lease_until=null,last_error=case outcome when 'accepted' then 'billing_ops_provider_202_accepted' when 'unknown' then 'billing_ops_provider_outcome_unknown' when 'invalid' then 'billing_ops_invalid_aggregate' else null end,payload=payload||jsonb_build_object('phase','complete','outcome',outcome,'completedAt',clock_timestamp()) where id=r.id;
 insert into private.audit_events(actor,action,subject,details) values('billing-ops-worker','billing_ops_settled',r.id::text,jsonb_build_object('outcome',outcome,'deliveryVerified',false));
 return jsonb_build_object('outcome',outcome);
end $fn$;

revoke all on function private.billing_ops_window(),private.billing_ops_key(jsonb,timestamptz),public.docked_billing_ops_enqueue(),public.docked_billing_ops_queue(text,jsonb) from public,anon,authenticated,service_role,docked_app,docked_commercial_app;
revoke all on function public.docked_billing_ops_signal(text,uuid) from public,anon,authenticated,service_role,docked_app,docked_commercial_app;
grant execute on function public.docked_billing_ops_enqueue() to docked_commercial_app;
grant execute on function public.docked_billing_ops_signal(text,uuid) to docked_commercial_app;
grant execute on function public.docked_billing_ops_queue(text,jsonb) to service_role;
commit;
