-- Empty, disabled-by-default Google TEST admission. No grants, money, products
-- or existing wallet documents are inserted/updated by this migration.
create table credits_sandbox.store_test_admissions (
 user_id uuid primary key references auth.users(id),
 version text not null,
 enabled boolean not null default false,
 expires_at timestamptz not null,
 products jsonb not null check(jsonb_typeof(products)='array' and jsonb_array_length(products) between 1 and 2),
 authority_note text not null check(length(trim(authority_note))>20)
);
alter table credits_sandbox.store_test_admissions enable row level security;
revoke all on credits_sandbox.store_test_admissions from public,anon,authenticated,service_role,docked_app,docked_beta_app;

-- Function belongs to the existing private trust boundary; app cannot grant
-- itself admission. Locks the grant against concurrent revocation until commit.
create function credits_sandbox.member_store_test_admission() returns jsonb
language plpgsql security definer set search_path='' as $$
declare g credits_sandbox.store_test_admissions; k text; begin
 if not beta_private.active_member_session() or not beta_private.admitted(auth.uid()) then return null; end if;
 select kind into k from credits_sandbox.access where user_id=auth.uid() and enabled for share;
 if k is null or (k='owner' and auth.jwt()->>'aal' is distinct from 'aal2') then return null;end if;
 select * into g from credits_sandbox.store_test_admissions where user_id=auth.uid() and enabled and expires_at>clock_timestamp() for share;
 if g.user_id is null then return null;end if;
 return jsonb_build_object('version',g.version,'expiresAt',floor(extract(epoch from g.expires_at)*1000),'products',g.products);
end$$;
revoke all on function credits_sandbox.member_store_test_admission() from public,anon,authenticated,service_role,docked_app;
grant execute on function credits_sandbox.member_store_test_admission() to docked_beta_app;

create table credits_sandbox.store_receipts (
 provider text not null check(provider='google'), receipt_key text not null,
 member_id text not null, product jsonb not null,
 status text not null check(status in ('PENDING','PURCHASED','CANCELLED','REVOKED')),
 encrypted_reference text not null, updated_at timestamptz not null default clock_timestamp(),
 primary key(provider,receipt_key)
);
create table credits_sandbox.store_events (
 provider text not null, receipt_key text not null,status text not null,
 created_at timestamptz not null default clock_timestamp(),
 primary key(provider,receipt_key,status),foreign key(provider,receipt_key) references credits_sandbox.store_receipts
);
create table credits_sandbox.store_outbox (
 provider text not null,receipt_key text not null,
 state text not null default 'pending' check(state in ('pending','working','done','cancelled')),
 attempts integer not null default 0,lease_until timestamptz,
 updated_at timestamptz not null default clock_timestamp(),
 primary key(provider,receipt_key),foreign key(provider,receipt_key) references credits_sandbox.store_receipts
);
create index store_member_receipts on credits_sandbox.store_receipts(member_id,updated_at);
create index store_delivery_due on credits_sandbox.store_outbox(updated_at) where state in ('pending','working');
alter table credits_sandbox.store_receipts enable row level security;
alter table credits_sandbox.store_events enable row level security;
alter table credits_sandbox.store_outbox enable row level security;
revoke all on credits_sandbox.store_receipts,credits_sandbox.store_events,credits_sandbox.store_outbox from public,anon,authenticated,service_role,docked_app,docked_beta_app;
grant select,insert,update on credits_sandbox.store_receipts,credits_sandbox.store_outbox to docked_beta_app;
grant select,insert on credits_sandbox.store_events to docked_beta_app;
create policy server_receipts on credits_sandbox.store_receipts to docked_beta_app using(true) with check(true);
create policy server_events on credits_sandbox.store_events to docked_beta_app using(true) with check(true);
create policy server_outbox on credits_sandbox.store_outbox to docked_beta_app using(true) with check(true);
create trigger immutable before update or delete on credits_sandbox.store_events for each row execute function credits_sandbox.immutable();
