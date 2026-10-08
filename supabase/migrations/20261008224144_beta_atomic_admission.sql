-- Application authorization is distinct from Supabase Auth identity. No account
-- is created or enabled by this migration. Only an operator may approve policy
-- evidence or designate the owner; neither email nor user_metadata grants roles.
create table beta_private.admission_control(
 id boolean primary key default true check(id), enabled boolean not null default false,
 policy_digest text check(policy_digest ~ '^[a-f0-9]{64}$'),
 policy_versions jsonb, approved_by text, approved_at timestamptz,
 check(not enabled or (policy_digest is not null and jsonb_typeof(policy_versions)='object'
 and policy_versions ?& array['terms','privacy','beta','community','fantasy','competition','responsible_gambling']
 and length(approved_by)>2 and approved_at is not null))
);
insert into beta_private.admission_control(id) values(true);
create table beta_private.designated_administrators(
 user_id uuid primary key references auth.users,
 designated_by text not null check(length(designated_by)>2),
 designated_at timestamptz not null default clock_timestamp()
);
create table beta_private.admissions(
 id uuid primary key default gen_random_uuid(),
 email text unique not null check(email=lower(btrim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
 user_id uuid unique references auth.users,
 administrator boolean not null default false,
 token_digest text unique not null check(token_digest ~ '^[a-f0-9]{64}$'),
 request_id uuid unique not null,
 expires_at timestamptz not null,
 created_at timestamptz not null default clock_timestamp(),
 status text not null default 'reserved' check(status in('reserved','accepted','revoked','suspended')),
 accepted_at timestamptz,
 country text check(country='AU'), state text check(state in('ACT','NSW','NT','QLD','SA','TAS','VIC','WA')),
 age_attested boolean not null default false,
 policy_digest text, policy_versions jsonb,
 check(expires_at>created_at),
 check(status<>'accepted' or (accepted_at is not null and user_id is not null and country='AU' and state is not null and age_attested and policy_digest is not null))
);
create table beta_private.admission_events(
 id bigint generated always as identity primary key,
 admission_id uuid not null references beta_private.admissions,
 action text not null, actor text not null, details jsonb not null default '{}', created_at timestamptz not null default clock_timestamp()
);
create trigger immutable before update or delete on beta_private.admission_events for each row execute function beta_private.immutable();
do $$declare t text;begin
 foreach t in array array['admission_control','designated_administrators','admissions','admission_events'] loop
 execute format('alter table beta_private.%I enable row level security',t);
 execute format('revoke all on beta_private.%I from public,anon,authenticated,docked_app,docked_beta_app',t);
 end loop;
end$$;

create function beta_private.admission_guard() returns trigger language plpgsql set search_path='' as $$begin
 perform 1 from beta_private.admission_control where id for update;
 if tg_op='DELETE' then raise exception 'Admission history is permanent'; end if;
 if tg_op='UPDATE' and (to_jsonb(new)-array['status','accepted_at','country','state','age_attested','policy_digest','policy_versions','token_digest','expires_at'])
 is distinct from (to_jsonb(old)-array['status','accepted_at','country','state','age_attested','policy_digest','policy_versions','token_digest','expires_at']) then
 raise exception 'Invitation identity and token are immutable'; end if;
 if tg_op='INSERT' or new.token_digest is distinct from old.token_digest then
 if new.expires_at<=clock_timestamp() or new.expires_at>clock_timestamp()+interval '7 days' or new.status<>'reserved' then raise exception 'Invitation expiry required within seven days';end if;
 end if;
 if new.administrator and (new.user_id is null or not exists(select 1 from beta_private.designated_administrators where user_id=new.user_id)) then
 raise exception 'Explicit designated administrator required'; end if;
 if tg_op='INSERT' and not new.administrator and (select count(*) from beta_private.admissions where not administrator)>=10 then
 raise exception 'Ten tester lifetime admission limit'; end if;
 if tg_op='UPDATE' and (old.status in('revoked','suspended') or (old.status='accepted' and new.status not in('revoked','suspended'))) then
 raise exception 'Invalid admission transition'; end if;
 return new;
end$$;
create trigger guard before insert or update or delete on beta_private.admissions for each row execute function beta_private.admission_guard();

-- Owner/operator preparation: reserve only for a known Auth identity. An Auth
-- identity has no gameplay permission until verified acceptance succeeds. A
-- failed mail send retains its reservation; never silently releases capacity.
create function beta_private.reserve_admission(p_email text,p_user uuid,p_digest text,p_request uuid,p_expires timestamptz,p_actor text)
 returns uuid language plpgsql set search_path='' as $$declare prior beta_private.admissions; result uuid; normalized text:=lower(btrim(p_email)); admin boolean;begin
 perform 1 from beta_private.admission_control where id for update;
 if not exists(select 1 from beta_private.admission_control where enabled) then raise exception 'Approved beta policies and activation required'; end if;
 if not exists(select 1 from auth.users u where u.id=p_user and lower(to_jsonb(u)->>'email')=normalized and not coalesce(u.is_anonymous,false)) then raise exception 'Exact Auth identity required'; end if;
 select * into prior from beta_private.admissions where request_id=p_request or email=normalized;
 if found then
 if prior.email=normalized and prior.user_id=p_user and prior.token_digest=p_digest and prior.request_id=p_request then return prior.id;end if;
 raise exception 'Existing invitation requires operator reconciliation';end if;
 admin:=exists(select 1 from beta_private.designated_administrators where user_id=p_user);
 insert into beta_private.admissions(email,user_id,administrator,token_digest,request_id,expires_at) values(normalized,p_user,admin,p_digest,p_request,p_expires) returning id into result;
 insert into beta_private.admission_events(admission_id,action,actor,details) values(result,'reserved',p_actor,jsonb_build_object('tokenDigest',p_digest,'expiresAt',p_expires));
 return result;
end$$;

create function beta_private.accept_admission(p_token text,p_user uuid,p_session uuid,p_country text,p_state text,p_adult boolean,p_versions jsonb)
 returns uuid language plpgsql security definer set search_path='' as $$declare invite beta_private.admissions; control beta_private.admission_control;begin
 select * into strict control from beta_private.admission_control where id for update;
 if not control.enabled or control.policy_versions is distinct from p_versions then raise exception 'Current approved beta policies required';end if;
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception 'Invalid invitation';end if;
 select * into invite from beta_private.admissions where token_digest=encode(sha256(convert_to(p_token,'UTF8')),'hex') for update;
 if not found or invite.user_id is distinct from p_user or invite.status in('revoked','suspended') then raise exception 'Invalid invitation';end if;
 if not exists(select 1 from auth.users u join auth.sessions s on s.user_id=u.id where u.id=p_user and s.id=p_session
 and lower(to_jsonb(u)->>'email')=invite.email and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
 and (s.not_after is null or s.not_after>clock_timestamp()) and coalesce((to_jsonb(u)->>'banned_until')::timestamptz,'-infinity')<=clock_timestamp()) then
 raise exception 'Verified active invitation session required';end if;
 if p_country is distinct from 'AU' or p_state is null or p_state<>all(array['ACT','NSW','NT','QLD','SA','TAS','VIC','WA']) or p_adult is distinct from true then raise exception 'Australian adult eligibility required';end if;
 -- Recovery of a committed acceptance is allowed only for the same verified
 -- identity/session context; it never creates a second account or consumes a slot.
 if invite.status='accepted' then return invite.id;end if;
 if invite.expires_at<=clock_timestamp() then raise exception 'Invitation expired';end if;
 update beta_private.admissions set status='accepted',accepted_at=clock_timestamp(),country=p_country,state=p_state,age_attested=true,
 policy_digest=control.policy_digest,policy_versions=p_versions where id=invite.id;
 insert into beta_private.admission_events(admission_id,action,actor) values(invite.id,'accepted',p_user::text);
 return invite.id;
end$$;

create function beta_private.admitted(p_user uuid) returns boolean language plpgsql security definer set search_path='' as $$declare ok boolean;begin
 perform 1 from beta_private.admission_control where id for share;
 perform 1 from beta_private.admissions where user_id=p_user for share;
 select exists(select 1 from beta_private.admissions a cross join beta_private.admission_control c
 where c.enabled and a.user_id=p_user and a.status='accepted' and a.country='AU' and a.age_attested
 and a.policy_digest=c.policy_digest and a.policy_versions=c.policy_versions) into ok;
 return ok;
end$$;
alter function beta_private.active_member_session() rename to pre_admission_session;
create function beta_private.active_member_session() returns boolean language plpgsql volatile security definer set search_path='' as $$begin
 return beta_private.admitted(auth.uid()) and beta_private.pre_admission_session();
end$$;
create function beta_private.profile_admission_guard() returns trigger language plpgsql security definer set search_path='' as $$begin
 if not beta_private.admitted(new.id) then raise exception 'Accepted beta admission required';end if;
 if new.country<>'AU' or not new.age_attested or not exists(select 1 from beta_private.admissions a where a.user_id=new.id and a.state=new.state
 and a.policy_versions->>'terms'=new.accepted_version) then raise exception 'Beta eligibility or policy mismatch';end if;
 return new;
end$$;
create trigger beta_admission before insert or update on beta_public.profiles for each row execute function beta_private.profile_admission_guard();

create function beta_private.manage_admission(p_id uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$declare u uuid:=auth.uid();begin
 perform 1 from beta_private.admission_control where id for update;
 if not beta_private.active_member_session() or auth.jwt()->>'aal' is distinct from 'aal2'
 or not exists(select 1 from beta_private.designated_administrators where user_id=u)
 or not exists(select 1 from beta_private.roles where user_id=u and role in('owner','admin')) then raise exception 'Designated administrator MFA required';end if;
 if p_status not in('revoked','suspended') then raise exception 'Unsupported admission action';end if;
 update beta_private.admissions set status=p_status where id=p_id;
 if not found then raise exception 'Unknown admission';end if;
 insert into beta_private.admission_events(admission_id,action,actor) values(p_id,p_status,u::text);
end$$;
create function beta_private.admin_reserve_admission(p_email text,p_user uuid,p_digest text,p_request uuid,p_expires timestamptz)
 returns uuid language plpgsql security definer set search_path='' as $$declare u uuid:=auth.uid();begin
 perform 1 from beta_private.admission_control where id for update;
 if not beta_private.active_member_session() or auth.jwt()->>'aal' is distinct from 'aal2'
 or not exists(select 1 from beta_private.designated_administrators where user_id=u)
 or not exists(select 1 from beta_private.roles where user_id=u and role in('owner','admin')) then raise exception 'Designated administrator MFA required';end if;
 return beta_private.reserve_admission(p_email,p_user,p_digest,p_request,p_expires,u::text);
end$$;
create function beta_private.renew_admission(p_id uuid,p_digest text,p_expires timestamptz) returns void language plpgsql security definer set search_path='' as $$declare u uuid:=auth.uid(); old_token text;begin
 perform 1 from beta_private.admission_control where id for update;
 if not beta_private.active_member_session() or auth.jwt()->>'aal' is distinct from 'aal2'
 or not exists(select 1 from beta_private.designated_administrators where user_id=u)
 or not exists(select 1 from beta_private.roles where user_id=u and role in('owner','admin')) then raise exception 'Designated administrator MFA required';end if;
 select token_digest into old_token from beta_private.admissions where id=p_id and status='reserved' for update;
 if not found or p_digest=old_token then raise exception 'Only pending invitations can be reissued with a new token';end if;
 if exists(select 1 from beta_private.admission_events where details->>'tokenDigest'=p_digest) then raise exception 'Invitation token cannot be reused';end if;
 update beta_private.admissions set token_digest=p_digest,expires_at=p_expires where id=p_id;
 insert into beta_private.admission_events(admission_id,action,actor,details) values(p_id,'renewed',u::text,jsonb_build_object('tokenDigest',p_digest,'expiresAt',p_expires,'supersededDigest',old_token));
end$$;
-- Server receives only narrow entry points, never admission table mutation.
revoke all on function beta_private.reserve_admission(text,uuid,text,uuid,timestamptz,text),beta_private.pre_admission_session(),beta_private.admission_guard(),beta_private.profile_admission_guard() from public,anon,authenticated,docked_app,docked_beta_app;
revoke all on function beta_private.accept_admission(text,uuid,uuid,text,text,boolean,jsonb),beta_private.admitted(uuid),beta_private.active_member_session(),beta_private.manage_admission(uuid,text),beta_private.admin_reserve_admission(text,uuid,text,uuid,timestamptz) from public,anon,authenticated,docked_app;
grant execute on function beta_private.accept_admission(text,uuid,uuid,text,text,boolean,jsonb),beta_private.admitted(uuid),beta_private.active_member_session(),beta_private.manage_admission(uuid,text),beta_private.admin_reserve_admission(text,uuid,text,uuid,timestamptz) to docked_beta_app;
revoke all on function beta_private.renew_admission(uuid,text,timestamptz) from public,anon,authenticated,docked_app;
grant execute on function beta_private.renew_admission(uuid,text,timestamptz) to docked_beta_app;
-- No global Auth reads/revocation through the beta server connection.
create or replace view beta_private.runtime_auth_users with(security_barrier=true) as select u.id,u.email,u.email_confirmed_at,u.is_anonymous,u.raw_app_meta_data,u.banned_until from private.runtime_auth_users u
 where exists(select 1 from beta_private.admissions a where a.user_id=u.id);
create or replace view beta_private.runtime_auth_sessions with(security_barrier=true) as select s.id,s.user_id,s.not_after from auth.sessions s
 where exists(select 1 from beta_private.admissions a where a.user_id=s.user_id);
revoke delete on beta_private.runtime_auth_sessions from docked_beta_app;
-- Disabling beta access is application-scoped. It cannot delete official sessions
-- or enqueue global identity deletion through the existing erasure worker.
create or replace function beta_private.disable_account(p_user uuid) returns void language plpgsql security definer set search_path='' as $$begin
 if p_user is distinct from auth.uid() or not beta_private.active_member_session() then raise exception 'Own active beta session required';end if;
 update beta_private.admissions set status='suspended' where user_id=p_user;
 insert into beta_private.admission_events(admission_id,action,actor) select id,'suspended',p_user::text from beta_private.admissions where user_id=p_user;
end$$;
