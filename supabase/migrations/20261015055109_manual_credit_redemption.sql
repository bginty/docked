-- Additive, inactive local-review infrastructure. No balances or lots updated.
create table credits_sandbox.redemption_staff (
 user_id uuid not null references auth.users(id), permission text not null check(permission in ('identity','review','payment')),
 enabled boolean not null default false, primary key(user_id,permission)
);
alter table credits_sandbox.redemption_staff enable row level security;
revoke all on credits_sandbox.redemption_staff from public,anon,authenticated,service_role;
grant select on credits_sandbox.redemption_staff to docked_beta_app;
create policy runtime_redemption_staff on credits_sandbox.redemption_staff for select to docked_beta_app using(true);

create function credits_sandbox.guard_redemption() returns trigger language plpgsql security invoker set search_path=pg_catalog as $$
declare p jsonb; pair record; prior jsonb;
begin
 p:=new.document->'redemption';
 if p is not null and p<>'null'::jsonb then
  if p->>'scope' is distinct from 'local-fixtures-only' or p->>'realDocumentsEnabled' is distinct from 'false' then raise exception 'Unapproved redemption boundary';end if;
  if p->>'enabled'='true' and current_database() not like 'docked_redemption_local_%' then raise exception 'Redemption restricted to dedicated local QA database';end if;
 end if;
 for pair in select key,value from jsonb_each(coalesce(new.document->'lots','{}')) loop
  if pair.value ? 'cashEligibility' and current_database() not like 'docked_redemption_local_%' then raise exception 'Test credits cannot acquire cash eligibility';end if;
  if tg_op='UPDATE' and old.document->'lots' ? pair.key and (old.document->'lots'->pair.key->'cashEligibility') is distinct from (pair.value->'cashEligibility') then raise exception 'Existing funding classification is immutable';end if;
 end loop;
 if tg_op='UPDATE' then
  for pair in select key,value from jsonb_each(coalesce(old.document->'withdrawals','{}')) where value ? 'manual' loop
   prior:=new.document->'withdrawals'->pair.key;
   if prior is null or (prior->'member') is distinct from (pair.value->'member') or (prior->'manual'->'requestedAt') is distinct from (pair.value->'manual'->'requestedAt') or (prior->'manual'->'policy') is distinct from (pair.value->'manual'->'policy') or (prior->'manual'->'destination') is distinct from (pair.value->'manual'->'destination') or (prior->'manual'->'rate') is distinct from (pair.value->'manual'->'rate') or (prior->'amount') is distinct from (pair.value->'amount') or (prior->'parts') is distinct from (pair.value->'parts') or (prior->'manual'->'audCents') is distinct from (pair.value->'manual'->'audCents') then raise exception 'Redemption financial snapshot is immutable';end if;
  end loop;
 end if;
 return new;
end$$;
revoke all on function credits_sandbox.guard_redemption() from public,anon,authenticated,service_role;
create trigger redemption_boundary before insert or update on credits_sandbox.state for each row execute function credits_sandbox.guard_redemption();
-- Rollback: disable feature; retain all ledger/history. Drop only this trigger,
-- function and empty staff configuration if no manual redemptions exist.
