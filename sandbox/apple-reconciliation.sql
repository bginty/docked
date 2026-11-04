-- Disposable isolated acceptance only; NOT a Production migration.
-- Hosted member admission/receipt-provider extension needs separate review.
create table credits_sandbox.apple_store_notifications (
 id text primary key check(id ~ '^[a-f0-9]{64}$'),
 receipt_key text,
 kind text not null check(kind in ('test','verify','review')),
 occurred_at bigint not null,
 reason text not null,
 state text not null default 'pending' check(state in ('pending','working','done','attention')),
 attempts integer not null default 0,
 lease uuid, lease_until timestamptz,
 next_attempt_at timestamptz not null default clock_timestamp(),
 last_error text,
 created_at timestamptz not null default clock_timestamp(),
 completed_at timestamptz
);
create index apple_store_notifications_due on credits_sandbox.apple_store_notifications(next_attempt_at) where state <> 'done';
alter table credits_sandbox.apple_store_notifications enable row level security;
revoke all on credits_sandbox.apple_store_notifications from public;
