-- Prepared, default-off owner incident review. No schedule, email or new role.
-- Uses existing identity/MFA and reserved outbox; no financial mutation grants.
create schema if not exists operations;
revoke all on schema operations from public,anon,authenticated,service_role;
create table if not exists operations.incidents(
 code text primary key, severity text not null check(severity in('critical','high','warning','info')),
 state text not null default 'OPEN' check(state in('OPEN','ACKNOWLEDGED','RESOLVED')),
 observed_count bigint not null check(observed_count>=0), revision int not null default 1,
 first_seen timestamptz not null default clock_timestamp(), last_seen timestamptz not null default clock_timestamp()
);
create table if not exists operations.events(
 id bigint generated always as identity primary key, code text not null references operations.incidents,
 revision int not null, action text not null, actor uuid, reason text,
 created_at timestamptz not null default clock_timestamp(), unique(code,revision)
);
alter table operations.incidents enable row level security;
alter table operations.events enable row level security;
revoke all on all tables in schema operations from public,anon,authenticated,service_role,docked_app,docked_beta_app,docked_commercial_app;
create or replace function operations.owner_actor() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid();begin
 if u is null or auth.jwt()->>'aal' is distinct from 'aal2' or not exists(
  select 1 from auth.users a join auth.sessions s on s.user_id=a.id
  where a.id=u and s.id::text=auth.jwt()->>'session_id' and (s.not_after is null or s.not_after>clock_timestamp())
  and lower(a.email)='support@docked.com.au' and a.email_confirmed_at is not null and not coalesce(a.is_anonymous,false)
  and (a.banned_until is null or a.banned_until<=clock_timestamp())
  and (exists(select 1 from private.roles r join public.profiles p on p.id=r.user_id where r.user_id=u and r.role='owner' and p.disabled_at is null)
   or exists(select 1 from beta_private.roles r join beta_public.profiles p on p.id=r.user_id where r.user_id=u and r.role='owner' and p.disabled_at is null)))
 then raise exception 'Active owner MFA session required'; end if;return u;
end$$;
create or replace function operations.observe(code_id text, severity_id text, n bigint) returns void
language plpgsql set search_path='' as $$declare r operations.incidents;begin
 if n<=0 then return; end if;
 insert into operations.incidents(code,severity,observed_count)values(code_id,severity_id,n)on conflict do nothing;
 select * into strict r from operations.incidents where code=code_id for update;
 if r.state='RESOLVED' or r.observed_count<>n then
  update operations.incidents set state='OPEN',observed_count=n,severity=severity_id,revision=revision+1,last_seen=clock_timestamp() where code=code_id returning * into r;
 else update operations.incidents set last_seen=clock_timestamp() where code=code_id;end if;
 insert into operations.events(code,revision,action) values(code_id,r.revision,'OBSERVED') on conflict do nothing;
end$$;
create or replace function operations.review(action_id text, payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid; r operations.incidents; n bigint; code_id text; target text;
begin
 u:=operations.owner_actor();
 if action_id is null or jsonb_typeof(payload) is distinct from 'object' then raise exception 'Invalid incident request';end if;
 if action_id='refresh' then
  if payload<>'{}'::jsonb then raise exception 'Unexpected refresh input';end if;
  perform operations.observe('wallet_ledger_mismatch','critical',(select count(*) from commercial_billing.accounts a where
   (select coalesce(sum(l.amount),0) from commercial_billing.lines l join commercial_billing.journals j on j.id=l.journal where j.unit='CREDITS' and l.account='member:'||a.member_id::text)
   is distinct from (select coalesce(sum(remaining),0) from commercial_billing.lots where member_id=a.member_id)));
  perform operations.observe('lifetime_supply_mismatch','critical',(select count(*) from commercial_billing.definitions d where d.issued>d.lifetime_cap or d.issued<>d.legacy_issued+(select count(*) from commercial_billing.cards c where c.definition=d.id)));
  perform operations.observe('incomplete_pack','critical',(select count(*) from commercial_billing.packs p where (p.product->>'cards')::int<>(select count(*)from commercial_billing.cards c where c.pack=p.id)));
  perform operations.observe('reconciliation_attention','high',(select count(*)from commercial_billing.jobs where state='attention'));
  perform operations.observe('reconciliation_overdue','high',(select count(*)from commercial_billing.jobs where state in('pending','working')and next_attempt_at<clock_timestamp()-interval '1 hour'));
  perform operations.observe('recovery_holds','warning',(select count(*)from commercial_billing.recovery_cases where state='OPEN'));
  perform operations.observe('alert_delivery_attention','high',(select count(*)from private.outbox o where o.payload->>'purpose'='billing_ops_health_v1'and (state='dead' or state in('queued','leased')and available_at<clock_timestamp()-interval '1 hour')));
  if to_regclass('private.docked_auth_mail_outbox')is null then
   perform operations.observe('auth_mail_configuration_missing','high',1);
  else
   execute 'select count(*)from private.docked_auth_mail_outbox where state in(''failed'',''unknown'')'into n;
   perform operations.observe('auth_mail_failure','high',n);
  end if;
  perform operations.observe('test_reconciliation_attention','warning',(select count(*)from credits_sandbox.store_notifications where state='attention'));
  perform operations.observe('ingestion_failure','high',(select count(*)from sports_feed.jobs where state='blocked'));
  perform operations.observe('unresolved_operational_exception','high',(select count(*)from private.job_runs where state='dead'));
  perform operations.observe('account_provisioning_failure','high',(select count(*)from private.audit_events where action='signup_profile_repair_required'and created_at>clock_timestamp()-interval '1 day'));
  for code_id,n in select details->>'code',count(*) from private.audit_events where action='billing_ops_signal'and created_at>clock_timestamp()-interval '1 hour'group by 1 loop
   if code_id in('receipt_verification_failed','purchase_fulfilment_failed','receipt_duplicate_retry','receipt_replay_rejected','refund_reconciliation_failed','pack_issuance_failed','pack_supply_unavailable','acknowledgement_failed','reconciliation_failed')then
    perform operations.observe(code_id,case when code_id='receipt_duplicate_retry'then 'info'when code_id='pack_supply_unavailable'then 'warning'else 'high'end,n);
   end if;
  end loop;
 elsif action_id='report' then
  code_id:=payload->>'code';
  if payload-array['code','reason']<>'{}'::jsonb or code_id not in('security_auth_incident','database_unavailable','ingestion_failure','unresolved_operational_exception')
   or code_id is null or coalesce(length(trim(payload->>'reason')),0)not between 12 and 600 then raise exception 'Valid operational category and safe evidence required';end if;
  perform operations.observe(code_id,case when code_id in('security_auth_incident','database_unavailable')then 'critical'else 'high'end,1);
  update operations.incidents set revision=revision+1 where code=code_id returning * into r;
  insert into operations.events(code,revision,action,actor,reason)values(code_id,r.revision,'REPORTED',u,trim(payload->>'reason'));
 elsif action_id in('acknowledge','resolve','confirm_delivery') then
  if payload-array['code','revision','reason']<>'{}'::jsonb or coalesce(length(trim(payload->>'reason')),0) not between 12 and 600 then raise exception 'Reason required; do not enter customer or secret data';end if;
  select * into strict r from operations.incidents where code=payload->>'code' for update;
  if r.revision is distinct from (payload->>'revision')::int then raise exception 'Incident changed; reload before review';end if;
  if action_id='confirm_delivery' and r.code<>'support_delivery_drill' then raise exception 'Delivery confirmation requires controlled drill';end if;
  target:=case when action_id='acknowledge' then 'ACKNOWLEDGED'else 'RESOLVED'end;
  update operations.incidents set state=target,revision=revision+1 where code=r.code returning * into r;
  insert into operations.events(code,revision,action,actor,reason) values(r.code,r.revision,upper(action_id),u,trim(payload->>'reason'));
 elsif action_id='drill' then
  if payload<>'{}'::jsonb then raise exception 'Unexpected drill input';end if;
  perform operations.observe('support_delivery_drill','info',1);
  -- Records a harmless drill only. Sending still requires the separately
  -- approved scoped outbox/Graph configuration. This never claims delivery.
 elsif action_id<>'read' or payload<>'{}'::jsonb then raise exception 'Unsupported incident action';end if;
 return jsonb_build_object(
  'incidents',coalesce((select jsonb_agg(to_jsonb(i) order by case i.state when 'OPEN'then 0 when 'ACKNOWLEDGED'then 1 else 2 end,i.last_seen desc)from operations.incidents i),'[]'),
  'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.id desc)from(select * from operations.events order by id desc limit 100)e),'[]'),
  'delivery',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'state',o.state,'attempts',o.attempts,'createdAt',o.created_at,'phase',o.payload->>'phase','outcome',o.payload->>'outcome','deliveryVerified',false) order by o.created_at desc)from(select * from private.outbox q where q.payload->>'purpose'='billing_ops_health_v1'order by created_at desc limit 30)o),'[]'),
  'emailEnabled',coalesce((select enabled from private.feature_flags where key='billing_ops_alerts'),false),
  'recipient','support@docked.com.au','custodian','Founder only','channel','Email only');
end$$;
create or replace function operations.immutable() returns trigger language plpgsql set search_path='' as $$begin raise exception 'Incident audit history is immutable';end$$;
drop trigger if exists operations_audit_immutable on operations.events;
create trigger operations_audit_immutable before update or delete on operations.events for each row execute function operations.immutable();
drop trigger if exists operations_audit_truncate on operations.events;
create trigger operations_audit_truncate before truncate on operations.events for each statement execute function operations.immutable();
-- Revoke only this migration's functions; the later pruning function has a
-- separate NOLOGIN owner and must not require standing operator membership.
revoke all on function operations.owner_actor(),operations.observe(text,text,bigint),operations.review(text,jsonb),operations.immutable() from public,anon,authenticated,service_role,docked_app,docked_beta_app,docked_commercial_app;
grant usage on schema operations to docked_app,docked_beta_app;
grant execute on function operations.review(text,jsonb) to docked_app,docked_beta_app;
