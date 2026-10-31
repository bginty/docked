-- DISPOSABLE LOCAL ACCEPTANCE ONLY. No production migration or activation.
create table credits_sandbox.store_notifications (
 id text primary key,
 receipt_key text,
 kind text not null check(kind in ('test','purchase','voided','scheduled')),
 occurred_at bigint not null,
 state text not null default 'pending' check(state in ('pending','working','done')),
 attempts integer not null default 0,
 lease_until timestamptz,
 next_attempt_at timestamptz not null default clock_timestamp(),
 last_error text,
 created_at timestamptz not null default clock_timestamp(),
 completed_at timestamptz
);
create index store_notifications_due on credits_sandbox.store_notifications(next_attempt_at) where state <> 'done';
alter table credits_sandbox.store_notifications enable row level security;
revoke all on credits_sandbox.store_notifications from public;
