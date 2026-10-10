-- Additive preparation; no admission, sender or gameplay activation.
create table beta_private.friends_control(
 id boolean primary key default true check(id), enabled boolean not null default false,
 readiness_evidence text, approved_by text, approved_at timestamptz,
 check(not enabled or (length(readiness_evidence)>30 and length(approved_by)>2 and approved_at is not null))
);
insert into beta_private.friends_control(id) values(true);
create table beta_private.friends_roster(
 user_id uuid primary key references auth.users, email text unique not null check(email=lower(btrim(email))),
 enabled boolean not null default false, authority text not null check(length(authority)>20),
 created_at timestamptz not null default clock_timestamp()
);
alter table beta_private.friends_control enable row level security;
alter table beta_private.friends_roster enable row level security;
revoke all on beta_private.friends_control,beta_private.friends_roster from public,anon,authenticated,docked_app,docked_beta_app;
create function beta_private.friends_roster_guard() returns trigger language plpgsql set search_path='' as $$begin
 update beta_private.friends_control set id=id where id;
 if tg_op='DELETE' then raise exception 'Roster history is permanent';end if;
 if tg_op='UPDATE' and (to_jsonb(new)-'enabled') is distinct from (to_jsonb(old)-'enabled') then raise exception 'Roster identity immutable';end if;
 if tg_op='INSERT' and (select count(*) from beta_private.friends_roster)>=10 then raise exception 'Ten tester lifetime limit';end if;
 if beta_private.gameplay_mfa_required(new.user_id) or not exists(select 1 from auth.users u where u.id=new.user_id and lower(to_jsonb(u)->>'email')=new.email) then raise exception 'Exact ordinary member required';end if;
 return new;end$$;
create trigger guard before insert or update or delete on beta_private.friends_roster for each row execute function beta_private.friends_roster_guard();
alter function beta_private.beta_gameplay_identity(uuid) rename to beta_gameplay_identity_before_friends;
create function beta_private.beta_gameplay_identity(p_user uuid) returns boolean language plpgsql security definer set search_path='' as $$begin
 perform 1 from beta_private.friends_control where id for share;
 if not exists(select 1 from beta_private.friends_control where enabled) then return beta_private.beta_gameplay_identity_before_friends(p_user);end if;
 if beta_private.owner_gameplay_identity(p_user) then return true;end if;
 return exists(select 1 from beta_private.friends_roster r join auth.users u on u.id=r.user_id
 where r.user_id=p_user and r.enabled and lower(to_jsonb(u)->>'email')=r.email
 and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
 and coalesce((to_jsonb(u)->>'banned_until')::timestamptz,'-infinity')<=clock_timestamp()
 and not beta_private.gameplay_mfa_required(p_user)
 and exists(select 1 from beta_private.owner_gameplay_control c where beta_private.owner_gameplay_identity(c.owner_id)));
end$$;
-- Keep the old single-tester trigger as the inactive-mode path, preserving existing acceptance.
alter function beta_private.two_person_admission_guard() rename to two_person_admission_guard_before_friends;
drop trigger two_person_admission_guard on beta_private.admissions;
create function beta_private.friends_admission_guard() returns trigger language plpgsql set search_path='' as $$declare c beta_private.two_person_control;begin
 perform 1 from beta_private.friends_control where id for share;
 if exists(select 1 from beta_private.friends_control where enabled) then
 if new.administrator then
 if not beta_private.owner_gameplay_identity(new.user_id) then raise exception 'Existing owner only';end if;
 elsif not exists(select 1 from beta_private.friends_roster where user_id=new.user_id and email=new.email and (enabled or new.status in('revoked','suspended'))) then raise exception 'Named roster member required';end if;
 return new;end if;
 select * into c from beta_private.two_person_control where id for share;
 if not found then return new;end if;
 if new.administrator then
 if new.user_id is distinct from c.owner_id then raise exception 'Only the existing owner is exempt';end if;
 else
 if new.user_id is distinct from c.tester_id or (not c.tester_enabled and new.status not in('revoked','suspended')) then raise exception 'Only the designated tester may be invited';end if;
 if tg_op='INSERT' and exists(select 1 from beta_private.admissions where not administrator) then raise exception 'One tester lifetime admission limit';end if;
 end if;return new;end$$;
create trigger two_person_admission_guard before insert or update on beta_private.admissions for each row execute function beta_private.friends_admission_guard();
revoke all on function beta_private.beta_gameplay_identity(uuid),beta_private.beta_gameplay_identity_before_friends(uuid),beta_private.friends_roster_guard(),beta_private.friends_admission_guard() from public,anon,authenticated,docked_app,docked_beta_app;
grant execute on function beta_private.beta_gameplay_identity(uuid) to docked_beta_app;
