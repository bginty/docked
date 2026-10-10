-- Dedicated two-person boundary. No account, invitation, inventory or flag is activated.
create table beta_private.two_person_control(
 id boolean primary key default true check(id),
 owner_id uuid not null references auth.users(id),
 tester_id uuid unique references auth.users(id),
 tester_enabled boolean not null default false,
 authority text not null check(length(authority)>20),
 check(tester_id is distinct from owner_id),
 check(not tester_enabled or tester_id is not null)
);
alter table beta_private.two_person_control enable row level security;
revoke all on beta_private.two_person_control from public,anon,authenticated,docked_app,docked_beta_app;
create function beta_private.two_person_control_guard() returns trigger language plpgsql set search_path='' as $$begin
 if tg_op='DELETE' then raise exception 'Two-person boundary is permanent'; end if;
 if tg_op='UPDATE' and (new.owner_id<>old.owner_id or (old.tester_id is not null and new.tester_id is distinct from old.tester_id)) then raise exception 'Beta participant identities are permanent';end if;
 if not exists(select 1 from beta_private.owner_gameplay_control where owner_id=new.owner_id) then raise exception 'Existing owner required';end if;
 if new.tester_id is not null and (exists(select 1 from beta_private.roles where user_id=new.tester_id) or exists(select 1 from beta_private.designated_administrators where user_id=new.tester_id)) then raise exception 'Tester must be an ordinary member';end if;
 if exists(select 1 from beta_private.admissions where not administrator and user_id is distinct from new.tester_id) then raise exception 'Unexpected existing tester admission';end if;
 return new;
end$$;
create trigger two_person_control_guard before insert or update or delete on beta_private.two_person_control for each row execute function beta_private.two_person_control_guard();

create function beta_private.gameplay_mfa_required(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from beta_private.roles where user_id=p_user)
 or exists(select 1 from beta_private.designated_administrators where user_id=p_user)
 or exists(select 1 from beta_private.owner_gameplay_control where owner_id=p_user)
$$;
create function beta_private.beta_gameplay_identity(p_user uuid) returns boolean language plpgsql security definer set search_path='' as $$begin
 perform 1 from beta_private.owner_gameplay_control where id for share;
 perform 1 from beta_private.two_person_control where id for share;
 if beta_private.owner_gameplay_identity(p_user) then return true;end if;
 return exists(select 1 from beta_private.two_person_control c join auth.users u on u.id=c.tester_id
 where c.tester_enabled and c.tester_id=p_user and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
 and coalesce((to_jsonb(u)->>'banned_until')::timestamptz,'-infinity')<=clock_timestamp()
 and not beta_private.gameplay_mfa_required(p_user)
 and beta_private.owner_gameplay_identity(c.owner_id));
end$$;
revoke all on function beta_private.gameplay_mfa_required(uuid),beta_private.beta_gameplay_identity(uuid) from public,anon,authenticated,docked_app;
grant execute on function beta_private.gameplay_mfa_required(uuid),beta_private.beta_gameplay_identity(uuid) to docked_beta_app;

create or replace function beta_private.admitted(p_user uuid) returns boolean language plpgsql security definer set search_path='' as $$begin
 if exists(select 1 from beta_private.owner_gameplay_control) and not beta_private.beta_gameplay_identity(p_user) then return false;end if;
 return beta_private.admitted_before_owner_gameplay(p_user);
end$$;
create or replace function beta_fantasy.production_eligible() returns uuid language plpgsql set search_path='' as $$begin
 if exists(select 1 from beta_private.owner_gameplay_control) and
 (not beta_private.beta_gameplay_identity(auth.uid()) or
 (beta_private.gameplay_mfa_required(auth.uid()) and coalesce(auth.jwt()->>'aal','')<>'aal2'))
 then raise exception 'Admitted beta identity and privileged MFA required';end if;
 return beta_fantasy.production_eligible_before_owner_gameplay();
end$$;

-- The control-row write in admission_guard remains the REPEATABLE READ serialization point.
-- This additional guard restricts lifetime admission to the single immutable designated tester.
create function beta_private.two_person_admission_guard() returns trigger language plpgsql set search_path='' as $$declare c beta_private.two_person_control;begin
 select * into c from beta_private.two_person_control where id for share;
 if not found then return new;end if;
 if new.administrator then
 if new.user_id is distinct from c.owner_id then raise exception 'Only the existing owner is exempt';end if;
 else
 if new.user_id is distinct from c.tester_id or (not c.tester_enabled and new.status not in('revoked','suspended')) then raise exception 'Only the designated tester may be invited';end if;
 if tg_op='INSERT' and exists(select 1 from beta_private.admissions where not administrator) then raise exception 'One tester lifetime admission limit';end if;
 end if;
 return new;
end$$;
create trigger two_person_admission_guard before insert or update on beta_private.admissions for each row execute function beta_private.two_person_admission_guard();
revoke all on function beta_private.two_person_control_guard(),beta_private.two_person_admission_guard() from public,anon,authenticated,docked_app,docked_beta_app;
-- Existing hosted owner is preserved. Installing this caps future invitations at
-- one immutable tester slot, initially empty and disabled. Fresh test databases
-- without an owner window remain unconfigured until their operator fixture.
insert into beta_private.two_person_control(owner_id,authority)
 select owner_id,'Owner approved two-person beta preparation; tester not yet designated or enabled' from beta_private.owner_gameplay_control;
