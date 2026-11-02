-- Dormant operational retention. No financial, Auth, ownership or scoring row
-- is changed. No worker login, membership, schedule or activation is provisioned.
create schema if not exists billing_retention;
revoke all on schema billing_retention from public,anon,authenticated,service_role,docked_commercial_app;
do $$begin
 if not exists(select 1 from pg_roles where rolname='docked_retention_worker') then
  create role docked_retention_worker nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
 end if;
end$$;
create table if not exists billing_retention.policy(
 id boolean primary key default true check(id),
 version text not null default 'operational-retention-2026-11-02-v1',
 enabled boolean not null default false,
 completed_job_days integer not null default 90 check(completed_job_days>=90),
 archive_days integer not null default 30 check(archive_days between 1 and 30),
 authority text, valid_until timestamptz,
 check(not enabled or (length(authority)>=12 and valid_until is not null))
);
insert into billing_retention.policy(id) values(true) on conflict do nothing;
create table if not exists billing_retention.holds(
 id uuid primary key default gen_random_uuid(),
 scope text not null check(scope in('all','job','receipt','member')),
 reference text not null, case_reference text not null check(length(case_reference) between 4 and 120),
 created_at timestamptz not null default clock_timestamp(), review_at timestamptz not null,
 released_at timestamptz,
 check(scope<>'all' or reference='*')
);
create index if not exists retention_active_holds on billing_retention.holds(scope,reference) where released_at is null;
create table if not exists billing_retention.archives(
 job_id text primary key references commercial_billing.jobs(id),
 policy_version text not null, receipt text, member_id uuid,
 encrypted_payload text not null, digest text not null check(digest~'^[a-f0-9]{64}$'),
 created_at timestamptz not null default clock_timestamp(), expires_at timestamptz not null
);
create table if not exists billing_retention.tombstones(
 job_id text primary key references commercial_billing.jobs(id),
 policy_version text not null, minimized_at timestamptz not null default clock_timestamp()
);
create table if not exists billing_retention.audit(
 id bigint generated always as identity primary key, at timestamptz not null default clock_timestamp(),
 actor text not null default session_user, action text not null,
 reference text not null, policy_version text not null
);
-- Policy/hold changes serialize with cleanup so a newly registered hold cannot
-- race a selected row. An overdue hold NEVER expires automatically.
create or replace function billing_retention.control_change() returns trigger
language plpgsql set search_path='' as $$begin
 perform pg_advisory_xact_lock(642920261102::bigint);
 if tg_op='DELETE' then raise exception 'Retention controls are released/versioned, not deleted'; end if;
 insert into billing_retention.audit(action,reference,policy_version)
 values(tg_table_name||':'||tg_op,case when tg_table_name='holds' then to_jsonb(new)->>'id' else 'policy' end,
 coalesce(to_jsonb(new)->>'version',(select version from billing_retention.policy where id)));
 return new;
end$$;
drop trigger if exists retention_control_audit on billing_retention.policy;
create trigger retention_control_audit before insert or update or delete on billing_retention.policy for each row execute function billing_retention.control_change();
drop trigger if exists retention_hold_audit on billing_retention.holds;
create trigger retention_hold_audit before insert or update or delete on billing_retention.holds for each row execute function billing_retention.control_change();
create or replace function billing_retention.held(p_job text,p_receipt text,p_member uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select exists(select 1 from billing_retention.holds where released_at is null and
 (scope='all' or (scope='job' and reference=p_job) or (scope='receipt' and reference=p_receipt)
 or(scope='member' and reference=p_member::text)))
$$;
-- Financial records and encrypted purchase tokens are deliberately absent from
-- the cleanup surface. Their legal/provider closeout period is not guessed.
create or replace function billing_retention.candidates(p_limit integer default 100)
returns setof commercial_billing.jobs language sql security invoker set search_path='' as $$
 select j.* from commercial_billing.jobs j cross join billing_retention.policy p
 left join commercial_billing.receipts r on r.key=j.receipt
 where j.state='done' and j.completed_at<clock_timestamp()-p.completed_job_days*interval '1 day'
 and j.lease is null and j.lease_until is null
 and not exists(select 1 from billing_retention.tombstones t where t.job_id=j.id)
 and not billing_retention.held(j.id,j.receipt,r.member_id)
 and not exists(select 1 from commercial_billing.recovery_cases c where c.receipt=j.receipt and c.state='OPEN')
 and not exists(select 1 from commercial_billing.jobs pending where pending.receipt=j.receipt and pending.state<>'done')
 order by j.completed_at,j.id limit greatest(0,least(p_limit,100))
$$;
do $$declare t text; begin
 foreach t in array array['policy','holds','archives','tombstones','audit'] loop
  execute format('alter table billing_retention.%I enable row level security',t);
  execute format('revoke all on billing_retention.%I from public,anon,authenticated,service_role,docked_commercial_app',t);
  if not exists(select 1 from pg_policies where schemaname='billing_retention' and tablename=t and policyname='retention_worker') then
   execute format('create policy retention_worker on billing_retention.%I for select to docked_retention_worker using(true)',t);
  end if;
 end loop;
end$$;
-- Worker is a private operator capability, never an application/browser role.
grant usage on schema billing_retention,commercial_billing to docked_retention_worker;
grant select on billing_retention.policy,billing_retention.holds,billing_retention.archives,billing_retention.tombstones,billing_retention.audit to docked_retention_worker;
grant select on commercial_billing.jobs to docked_retention_worker;
grant select(key,member_id) on commercial_billing.receipts to docked_retention_worker;
grant select(receipt,state) on commercial_billing.recovery_cases to docked_retention_worker;
grant update(receipt,attempts,last_error,next_attempt_at) on commercial_billing.jobs to docked_retention_worker;
grant insert on billing_retention.archives,billing_retention.tombstones,billing_retention.audit to docked_retention_worker;
grant delete on billing_retention.archives to docked_retention_worker;
grant usage,select on all sequences in schema billing_retention to docked_retention_worker;
do $$begin
 if not exists(select 1 from pg_policies where schemaname='commercial_billing' and tablename='jobs' and policyname='retention_read') then
  create policy retention_read on commercial_billing.jobs for select to docked_retention_worker using(true);
  create policy retention_update on commercial_billing.jobs for update to docked_retention_worker
   using(state='done' and lease is null and lease_until is null
    and exists(select 1 from billing_retention.policy p where p.enabled and p.valid_until>clock_timestamp() and completed_at<clock_timestamp()-p.completed_job_days*interval '1 day')
    and exists(select 1 from billing_retention.archives a where a.job_id=id)
    and not billing_retention.held(id,receipt,(select r.member_id from commercial_billing.receipts r where r.key=receipt))
    and not exists(select 1 from commercial_billing.recovery_cases c where c.receipt=jobs.receipt and c.state='OPEN'))
   with check(state='done' and receipt is null and attempts=0 and last_error is null and lease is null and lease_until is null);
  create policy retention_receipts on commercial_billing.receipts for select to docked_retention_worker using(true);
  create policy retention_recovery on commercial_billing.recovery_cases for select to docked_retention_worker using(true);
 end if;
end$$;
do $$begin
 if not exists(select 1 from pg_policies where schemaname='billing_retention' and tablename='archives' and policyname='retention_archive_insert') then
  create policy retention_archive_insert on billing_retention.archives for insert to docked_retention_worker with check(
   exists(select 1 from billing_retention.policy p where p.enabled and p.valid_until>clock_timestamp() and p.version=policy_version)
   and expires_at<=clock_timestamp()+interval '30 days');
  create policy retention_archive_delete on billing_retention.archives for delete to docked_retention_worker using(
   expires_at<clock_timestamp() and not billing_retention.held(job_id,receipt,member_id)
   and not exists(select 1 from commercial_billing.recovery_cases c where c.receipt=archives.receipt and c.state='OPEN')
   and exists(select 1 from billing_retention.policy p where p.enabled and p.valid_until>clock_timestamp()));
  create policy retention_tombstone_insert on billing_retention.tombstones for insert to docked_retention_worker with check(
   exists(select 1 from billing_retention.archives a where a.job_id=tombstones.job_id));
  create policy retention_audit_insert on billing_retention.audit for insert to docked_retention_worker with check(action in('MINIMIZE_JOB','PURGE_ARCHIVE'));
 end if;
end$$;
drop trigger if exists retention_audit_immutable on billing_retention.audit;
create trigger retention_audit_immutable before update or delete on billing_retention.audit for each row execute function commercial_billing.immutable();
drop trigger if exists retention_tombstone_immutable on billing_retention.tombstones;
create trigger retention_tombstone_immutable before update or delete on billing_retention.tombstones for each row execute function commercial_billing.immutable();
revoke all on all functions in schema billing_retention from public,anon,authenticated,service_role,docked_commercial_app;
grant execute on function billing_retention.held(text,text,uuid),billing_retention.candidates(integer) to docked_retention_worker;
