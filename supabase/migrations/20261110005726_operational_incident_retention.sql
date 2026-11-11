-- Dormant routine-incident minimisation, founder approved 90 days. No cron/login.
-- Financial/payment/security/audit sources are never touched by this worker.
do $$begin
 if current_user<>'postgres' then raise exception 'Reviewed postgres migration operator required';end if;
 if to_regclass('operations.incidents')is null then raise exception 'Incident review migration required';end if;
 if not exists(select 1 from pg_roles where rolname='docked_incident_retention')then
  create role docked_incident_retention nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
 end if;
 if exists(select 1 from pg_roles where rolname='docked_incident_retention'and(rolcanlogin or rolsuper or rolbypassrls or rolcreatedb or rolcreaterole or rolreplication or rolinherit))
 or exists(select 1 from pg_auth_members where member=(select oid from pg_roles where rolname='docked_incident_retention'))
 or exists(select 1 from pg_auth_members a join pg_roles m on m.oid=a.member join pg_roles g on g.oid=a.grantor
  where a.roleid=(select oid from pg_roles where rolname='docked_incident_retention')
  and not(m.rolname='postgres' and g.rolsuper and a.admin_option and not a.inherit_option and not a.set_option))then
  raise exception 'Retention role must have no executable memberships or elevated attributes';end if;
 if has_schema_privilege('docked_incident_retention','operations','CREATE')then
  raise exception 'Unexpected standing retention schema creation permission';end if;
end$$;
-- PostgreSQL 17 gives a non-superuser creator an unavoidable ADMIN-only grant
-- from the bootstrap superuser (INHERIT FALSE, SET FALSE). Do not relax runtime
-- access. The migration operator's own temporary grant exists only inside the
-- reviewed transaction and is removed below after ownership/ACL maintenance.
grant docked_incident_retention to postgres with admin false, inherit true, set true;
grant usage,create on schema operations to docked_incident_retention;
create table if not exists operations.retention_policy(
 id boolean primary key default true check(id), enabled boolean not null default false,
 routine_days int not null default 90 check(routine_days=90), version text not null default 'founder-routine-incidents-20261110-v1'
);
insert into operations.retention_policy(id)values(true)on conflict do nothing;
create table if not exists operations.preservation(
 code text primary key references operations.incidents, legal_hold boolean not null default false,
 investigation boolean not null default false, required_audit boolean not null default false,
 updated_at timestamptz not null default clock_timestamp()
);
create table if not exists operations.retention_receipts(
 id uuid primary key default gen_random_uuid(), code text not null, through_revision int not null,
 events_removed int not null, source_sha256 text not null check(source_sha256~'^[a-f0-9]{64}$'),
 policy_version text not null, retained_reason text not null default 'Routine operational details expired; minimal audit retained',
 created_at timestamptz not null default clock_timestamp(),unique(code,source_sha256)
);
alter table operations.retention_policy enable row level security;
alter table operations.preservation enable row level security;
alter table operations.retention_receipts enable row level security;
revoke all on operations.retention_policy,operations.preservation,operations.retention_receipts from public,anon,authenticated,service_role,docked_app,docked_beta_app,docked_commercial_app;

create or replace function operations.routine_expired(code_id text)returns boolean
language sql stable set search_path='' as $$
 select exists(select 1 from operations.incidents i where i.code=code_id and i.state='RESOLVED'
 -- Conservative allowlist. Unknown, financial, security and integrity incidents fail closed.
 and i.code in('support_delivery_drill','auth_mail_configuration_missing','auth_mail_failure')
 and greatest(i.last_seen,coalesce((select max(e.created_at)from operations.events e where e.code=i.code),i.last_seen))<clock_timestamp()-interval '90 days'
 and not exists(select 1 from operations.preservation p where p.code=i.code and(p.legal_hold or p.investigation or p.required_audit)))
$$;
create or replace function operations.retention_review(action_id text,payload jsonb default '{}')returns jsonb
language plpgsql security definer set search_path='' as $$declare u uuid;r operations.incidents;begin
 u:=operations.owner_actor();
 if action_id='preserve' then
  if payload-array['code','revision','legalHold','investigation','requiredAudit','reason']<>'{}'::jsonb
   or coalesce(length(trim(payload->>'reason')),0)not between 12 and 600
   or jsonb_typeof(payload->'legalHold')is distinct from 'boolean'
   or jsonb_typeof(payload->'investigation')is distinct from 'boolean'
   or jsonb_typeof(payload->'requiredAudit')is distinct from 'boolean' then raise exception 'Valid preservation decision required';end if;
  select * into strict r from operations.incidents where code=payload->>'code'for update;
  if r.revision is distinct from (payload->>'revision')::int then raise exception 'Incident changed';end if;
  insert into operations.preservation(code,legal_hold,investigation,required_audit)
   values(r.code,(payload->>'legalHold')::boolean,(payload->>'investigation')::boolean,(payload->>'requiredAudit')::boolean)
   on conflict(code)do update set legal_hold=excluded.legal_hold,investigation=excluded.investigation,required_audit=excluded.required_audit,updated_at=clock_timestamp();
  update operations.incidents set revision=revision+1 where code=r.code returning * into r;
  insert into operations.events(code,revision,action,actor,reason)values(r.code,r.revision,'PRESERVATION_REVIEW',u,trim(payload->>'reason'));
 elsif action_id is distinct from 'dry_run' or payload<>'{}'::jsonb then raise exception 'Unsupported retention review';end if;
 return jsonb_build_object('enabled',(select enabled from operations.retention_policy where id),'days',90,
  'eligible',coalesce((select jsonb_agg(jsonb_build_object('code',i.code,'revision',i.revision))from operations.incidents i where operations.routine_expired(i.code)),'[]'),
  'preservation',coalesce((select jsonb_agg(to_jsonb(p))from operations.preservation p),'[]'),
  'receipts',coalesce((select jsonb_agg(to_jsonb(rr))from operations.retention_receipts rr),'[]'));
end$$;
-- Read-only eligibility and exact worker privileges; no membership or scheduler.
grant usage on schema operations to docked_incident_retention;
grant select on operations.incidents,operations.events,operations.preservation,operations.retention_policy,operations.retention_receipts to docked_incident_retention;
grant delete on operations.incidents,operations.events,operations.preservation to docked_incident_retention;
-- Row locking needs UPDATE privilege. The trigger below denies actual updates.
grant update(code) on operations.incidents to docked_incident_retention;
grant insert on operations.retention_receipts to docked_incident_retention;
do $$declare t text;begin foreach t in array array['incidents','events','preservation','retention_policy','retention_receipts']loop
 execute format('drop policy if exists incident_retention_read on operations.%I',t);
 execute format('create policy incident_retention_read on operations.%I for select to docked_incident_retention using(true)',t);
end loop;end$$;
drop policy if exists incident_retention_delete on operations.events;
create policy incident_retention_delete on operations.events for delete to docked_incident_retention using(operations.routine_expired(code));
drop policy if exists incident_retention_delete on operations.incidents;
create policy incident_retention_delete on operations.incidents for delete to docked_incident_retention using(operations.routine_expired(code));
drop policy if exists incident_retention_lock on operations.incidents;
create policy incident_retention_lock on operations.incidents for update to docked_incident_retention using(operations.routine_expired(code))with check(false);
drop policy if exists incident_retention_delete on operations.preservation;
create policy incident_retention_delete on operations.preservation for delete to docked_incident_retention using(operations.routine_expired(code));
drop policy if exists incident_retention_receipt on operations.retention_receipts;
create policy incident_retention_receipt on operations.retention_receipts for insert to docked_incident_retention with check(operations.routine_expired(code));

create or replace function operations.audit_guard()returns trigger language plpgsql set search_path='' as $$begin
 if tg_op='DELETE' and current_user='docked_incident_retention'
 and coalesce((select enabled from operations.retention_policy where id),false)
 and operations.routine_expired(old.code)
 and exists(select 1 from operations.retention_receipts r join operations.incidents i on i.code=r.code
  where r.code=old.code and r.through_revision=i.revision and r.created_at>=transaction_timestamp())then return old;end if;
 raise exception 'Incident audit history is immutable outside approved retention';
end$$;
drop trigger if exists operations_audit_immutable on operations.events;
create trigger operations_audit_immutable before update or delete on operations.events for each row execute function operations.audit_guard();
drop trigger if exists incident_retention_guard on operations.incidents;
create trigger incident_retention_guard before delete on operations.incidents for each row execute function operations.audit_guard();
drop trigger if exists preservation_retention_guard on operations.preservation;
create trigger preservation_retention_guard before delete on operations.preservation for each row execute function operations.audit_guard();
drop trigger if exists retention_receipt_immutable on operations.retention_receipts;
create trigger retention_receipt_immutable before update or delete on operations.retention_receipts for each row execute function operations.immutable();
drop trigger if exists retention_receipt_truncate on operations.retention_receipts;
create trigger retention_receipt_truncate before truncate on operations.retention_receipts for each statement execute function operations.immutable();
create or replace function operations.prune_routine(limit_count int default 50)returns int
language plpgsql security definer set search_path='' as $$declare r operations.incidents;n int:=0;c int;h text;v text;begin
 if limit_count not between 1 and 100 then raise exception 'Bounded batch required';end if;
 select version into v from operations.retention_policy where id and enabled;
 if not found then raise exception 'Incident retention disabled';end if;
 for r in select * from operations.incidents i where operations.routine_expired(i.code)order by i.code for update skip locked limit limit_count loop
  -- Hold changes use this same incident row lock. Recheck after acquiring it.
  if not operations.routine_expired(r.code)then continue;end if;
  select count(*)::int,encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(e)order by e.id)::text,'[]'),'UTF8')),'hex') into c,h from operations.events e where code=r.code;
  insert into operations.retention_receipts(code,through_revision,events_removed,source_sha256,policy_version)values(r.code,r.revision,c,h,v);
  delete from operations.events where code=r.code;
  delete from operations.preservation where code=r.code;
  delete from operations.incidents where code=r.code;
  n:=n+1;
 end loop;return n;
end$$;
alter function operations.prune_routine(int)owner to docked_incident_retention;
revoke all on function operations.routine_expired(text),operations.retention_review(text,jsonb),operations.audit_guard(),operations.prune_routine(int)from public,anon,authenticated,service_role,docked_app,docked_beta_app,docked_commercial_app;
grant execute on function operations.routine_expired(text),operations.prune_routine(int)to docked_incident_retention;
grant execute on function operations.retention_review(text,jsonb)to docked_app,docked_beta_app;
revoke create on schema operations from docked_incident_retention;
revoke docked_incident_retention from postgres granted by postgres;
do $$begin
 if exists(select 1 from pg_auth_members a join pg_roles m on m.oid=a.member join pg_roles g on g.oid=a.grantor
  where a.roleid=(select oid from pg_roles where rolname='docked_incident_retention')
  and not(m.rolname='postgres' and g.rolsuper and a.admin_option and not a.inherit_option and not a.set_option))
 or has_schema_privilege('docked_incident_retention','operations','CREATE')then
  raise exception 'Temporary retention setup access was not removed';end if;
end$$;
