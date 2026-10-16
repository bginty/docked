-- Explicit, named staff admission. Does not grant a role or enrol any account.
-- Existing AAL2, session, admission, feature and owner-only guards remain intact.
create table beta_private.delegated_admin_admissions (
 user_id uuid primary key references auth.users(id),
 approved_by uuid not null references auth.users(id),
 authority text not null check(length(btrim(authority))>=20),
 enabled boolean not null default false,
 created_at timestamptz not null default clock_timestamp(),
 check(user_id<>approved_by)
);
alter table beta_private.delegated_admin_admissions enable row level security;
revoke all on beta_private.delegated_admin_admissions from public,anon,authenticated,service_role,docked_app,docked_beta_app;

create function beta_private.delegated_admin_admission_audit() returns trigger
language plpgsql set search_path='' as $$begin
 if tg_op='DELETE' then raise exception 'Staff admission history is permanent';end if;
 if tg_op='UPDATE' and (to_jsonb(new)-'enabled') is distinct from (to_jsonb(old)-'enabled') then raise exception 'Staff admission authority is immutable';end if;
 if new.enabled and (
  not beta_private.owner_gameplay_identity(new.approved_by)
  or not exists(select 1 from beta_private.roles where user_id=new.user_id and role='admin')
  or not exists(select 1 from beta_private.friends_roster r join auth.users u on u.id=r.user_id
    where r.user_id=new.user_id and r.enabled and r.email=lower(u.email)
    and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
    and coalesce(u.banned_until,'-infinity')<=clock_timestamp())
 ) then raise exception 'Existing owner approval and named verified admin required';end if;
 insert into beta_private.audit_events(actor,action,subject,details)
 values(new.approved_by::text,'delegated_admin_admission',new.user_id::text,
 jsonb_build_object('enabled',new.enabled,'authority',new.authority,'operation',tg_op));
 return new;
end$$;
create trigger delegated_admin_admission_audit before insert or update or delete
on beta_private.delegated_admin_admissions for each row execute function beta_private.delegated_admin_admission_audit();

alter function beta_private.beta_gameplay_identity(uuid) rename to beta_gameplay_identity_before_delegated_admin;
create function beta_private.beta_gameplay_identity(p_user uuid) returns boolean
language plpgsql security definer set search_path='' as $$begin
 -- The original function retains its control-row locks and ordinary-member path.
 if beta_private.beta_gameplay_identity_before_delegated_admin(p_user) then return true;end if;
 perform 1 from beta_private.delegated_admin_admissions where user_id=p_user for share;
 return exists(select 1 from beta_private.delegated_admin_admissions g
  join beta_private.roles role on role.user_id=g.user_id and role.role='admin'
  join beta_private.friends_roster r on r.user_id=g.user_id and r.enabled
  join auth.users u on u.id=g.user_id and lower(u.email)=r.email
  where g.user_id=p_user and g.enabled
  and exists(select 1 from beta_private.friends_control where enabled)
  and beta_private.owner_gameplay_identity(g.approved_by)
  and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
  and coalesce(u.banned_until,'-infinity')<=clock_timestamp());
 -- Identity permits normal authenticator enrolment. active_member_session and
 -- requireRole still require AAL2 before privileged gameplay or staff operations.
end$$;
revoke all on function beta_private.delegated_admin_admission_audit(),beta_private.beta_gameplay_identity_before_delegated_admin(uuid),beta_private.beta_gameplay_identity(uuid) from public,anon,authenticated,service_role,docked_app,docked_beta_app;
grant execute on function beta_private.beta_gameplay_identity(uuid) to docked_beta_app;
