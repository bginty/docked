-- Additive protected-Preview owner acceptance boundary. No official schema/data changes.
-- Empty until the verified operator records the exact existing owner; no user is seeded.
create table beta_private.owner_gameplay_control(
 id boolean primary key default true check(id),
 owner_id uuid not null references auth.users(id),
 enabled boolean not null default false,
 authority text not null check(length(authority)>20),
 enabled_at timestamptz not null default clock_timestamp()
);
alter table beta_private.owner_gameplay_control enable row level security;
revoke all on beta_private.owner_gameplay_control from public,anon,authenticated,docked_app,docked_beta_app;

create function beta_private.owner_gameplay_identity(p_user uuid) returns boolean
language plpgsql security definer set search_path='' as $$begin
 return exists(select 1 from beta_private.owner_gameplay_control c
 join auth.users u on u.id=c.owner_id
 join beta_private.designated_administrators d on d.user_id=u.id
 join beta_private.roles r on r.user_id=u.id and r.role='owner'
 where c.enabled and c.owner_id=p_user and u.email_confirmed_at is not null
 and not coalesce(u.is_anonymous,false)
 and coalesce((to_jsonb(u)->>'banned_until')::timestamptz,'-infinity')<=clock_timestamp()
 and exists(select 1 from auth.mfa_factors f where f.user_id=u.id and f.status='verified'));
end$$;
revoke all on function beta_private.owner_gameplay_identity(uuid) from public,anon,authenticated,docked_app;
grant execute on function beta_private.owner_gameplay_identity(uuid) to docked_beta_app;

alter function beta_private.admitted(uuid) rename to admitted_before_owner_gameplay;
revoke all on function beta_private.admitted_before_owner_gameplay(uuid) from public,anon,authenticated,docked_app,docked_beta_app;
create function beta_private.admitted(p_user uuid) returns boolean
language plpgsql security definer set search_path='' as $$begin
 -- Existing local multi-account regression fixtures do not configure an owner window.
 -- Once configured, disabling the window denies everyone, never reopens testers.
 if exists(select 1 from beta_private.owner_gameplay_control) and not beta_private.owner_gameplay_identity(p_user) then return false; end if;
 return beta_private.admitted_before_owner_gameplay(p_user);
end$$;
revoke all on function beta_private.admitted(uuid) from public,anon,authenticated,docked_app;
grant execute on function beta_private.admitted(uuid) to docked_beta_app;

alter function beta_fantasy.production_eligible() rename to production_eligible_before_owner_gameplay;
create function beta_fantasy.production_eligible() returns uuid
language plpgsql set search_path='' as $$begin
 if exists(select 1 from beta_private.owner_gameplay_control) and
 (not beta_private.owner_gameplay_identity(auth.uid()) or coalesce(auth.jwt()->>'aal','')<>'aal2')
 then raise exception 'Owner gameplay requires verified owner MFA'; end if;
 return beta_fantasy.production_eligible_before_owner_gameplay();
end$$;
revoke all on function beta_fantasy.production_eligible(),beta_fantasy.production_eligible_before_owner_gameplay() from public,anon,authenticated,docked_app,docked_beta_app;
