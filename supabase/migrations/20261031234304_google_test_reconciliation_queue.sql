-- Prepared only. Requires owner approval before Production application.
-- Additive TEST notification inbox; no scheduler, programme or purchase activation.
-- Depends on 20261031123931_member_google_test_receipts.
create table credits_sandbox.store_notifications (
 id text primary key,
 receipt_key text,
 kind text not null check(kind in ('test','purchase','voided','scheduled')),
 occurred_at bigint not null,
 state text not null default 'pending' check(state in ('pending','working','done','attention')),
 attempts integer not null default 0,
 lease_until timestamptz,
 next_attempt_at timestamptz not null default clock_timestamp(),
 last_error text,
 created_at timestamptz not null default clock_timestamp(),
 completed_at timestamptz
);
create index store_notifications_due on credits_sandbox.store_notifications(next_attempt_at) where state in ('pending','working');
create index store_notifications_receipt on credits_sandbox.store_notifications(receipt_key,created_at desc);
alter table credits_sandbox.store_notifications enable row level security;
revoke all on credits_sandbox.store_notifications from public,anon,authenticated,service_role,docked_app,docked_beta_app;
grant select,insert,update on credits_sandbox.store_notifications to docked_beta_app;
create policy server_notifications on credits_sandbox.store_notifications to docked_beta_app using(true) with check(true);
-- Raw provider tokens are encrypted in the existing receipt table. Notification
-- rows contain only hashed references. No external scheduler secret is stored here.
