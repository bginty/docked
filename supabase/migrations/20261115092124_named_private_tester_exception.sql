-- Preparation only: no rows, invitations, Auth changes, credits or card issuance.
-- The separately reviewed operator may enable only the existing named account.
create table beta_private.named_tester_exception (
 user_id uuid primary key references auth.users on delete cascade
   check(user_id='d6ab4838-7108-4c50-8ab8-c5947ab55bd8'::uuid),
 country text not null check(country='US'), state text not null check(state='CA'),
 email_digest text not null check(email_digest ~ '^[a-f0-9]{64}$'),
 notice_version text not null check(notice_version='2026-11-15-private-tester-v1'),
 notice_sha256 text not null check(notice_sha256 ~ '^[a-f0-9]{64}$'),
 enabled boolean not null default false,
 authority_reference text not null check(length(authority_reference)>30),
 created_at timestamptz not null default clock_timestamp(),
 onboarding_expires_at timestamptz not null,
 check(onboarding_expires_at>created_at and onboarding_expires_at<=created_at+interval '7 days')
);
alter table beta_private.named_tester_exception enable row level security;
revoke all on beta_private.named_tester_exception from public,anon,authenticated,docked_app,docked_beta_app;

create function beta_private.named_tester_exception_serialize() returns trigger
language plpgsql set search_path='' as $$begin
 perform pg_advisory_xact_lock(71820342);
 update beta_private.admission_control set admission_revision=admission_revision+1 where id;
 return null;
end$$;
create trigger serialize before insert or update or delete on beta_private.named_tester_exception
for each statement execute function beta_private.named_tester_exception_serialize();
create function beta_private.named_tester_exception_guard() returns trigger
language plpgsql set search_path='' as $$begin
 if tg_op='UPDATE' and (to_jsonb(new)-'enabled') is distinct from (to_jsonb(old)-'enabled') then
  raise exception 'Named testing scope is immutable';
 end if;
 if tg_op='DELETE' then
  -- Auth erasure can cascade; an ordinary operator cannot erase review evidence.
  if pg_trigger_depth()<2 then raise exception 'Revoke named testing; preserve its history';end if;
  return old;
 end if;
 insert into beta_private.admission_events(admission_id,action,actor,details)
 select a.id,case when tg_op='INSERT' then 'named_tester_prepared' else 'named_tester_access_changed' end,
 session_user,jsonb_build_object('enabled',new.enabled,'noticeVersion',new.notice_version,
 'noticeSha256',new.notice_sha256,'authority',new.authority_reference,'consentRecorded',false)
 from beta_private.admissions a where a.user_id=new.user_id;
 return new;
end$$;
create trigger guard before insert or update or delete on beta_private.named_tester_exception
for each row execute function beta_private.named_tester_exception_guard();

-- Internal authorization: never trusts client metadata, role claims or a country override.
create function beta_private.named_tester_authorized(p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from beta_private.named_tester_exception e
  join auth.users u on u.id=e.user_id
  join beta_private.admissions a on a.user_id=e.user_id
  join beta_private.friends_roster r on r.user_id=e.user_id and r.enabled
  where e.user_id=p_user and e.enabled and e.country='US' and e.state='CA'
   and encode(sha256(convert_to(lower(u.email),'UTF8')),'hex')=e.email_digest
   and lower(u.email)=a.email and a.email=r.email
   and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
   and (to_jsonb(u)->>'deleted_at') is null and coalesce(u.banned_until,'-infinity')<=clock_timestamp()
   and a.status in('reserved','accepted') and not a.administrator
   and not exists(select 1 from beta_private.roles where user_id=p_user)
   and not beta_private.gameplay_mfa_required(p_user)
   and exists(select 1 from beta_private.friends_control where enabled)
   and exists(select 1 from beta_private.admission_control where enabled and testers_enabled)
   and not exists(select 1 from beta_private.feature_flags where key='registration' and enabled)
   and not exists(select 1 from private.feature_flags where key='registration' and enabled)
   and exists(select 1 from commercial_billing.control where id and not sales_enabled
      and not issuance_enabled and not transfers_enabled and not gameplay_enabled)
 )
$$;
create function beta_private.named_tester_setup_identity(p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select beta_private.named_tester_authorized(p_user) and exists(
  select 1 from beta_private.named_tester_exception e join beta_private.admissions a on a.user_id=e.user_id
  where e.user_id=p_user and (a.status='accepted' or e.onboarding_expires_at>clock_timestamp()))
$$;

-- Only this existing identity can store US/CA; all other admissions remain AU.
alter table beta_private.admissions drop constraint admissions_country_check;
alter table beta_private.admissions add constraint admissions_country_check check(
 country='AU' or (country='US' and (
  user_id='d6ab4838-7108-4c50-8ab8-c5947ab55bd8'::uuid or
  (user_id is null and status in('revoked','suspended')))));
alter table beta_private.admissions drop constraint admissions_state_check;
alter table beta_private.admissions add constraint admissions_state_check check(
 state in('ACT','NSW','NT','QLD','SA','TAS','VIC','WA') or
 (state='CA' and country='US' and (
  user_id='d6ab4838-7108-4c50-8ab8-c5947ab55bd8'::uuid or
  (user_id is null and status in('revoked','suspended')))));
alter table beta_private.admissions drop constraint admissions_check1;
alter table beta_private.admissions add constraint admissions_check1 check(status<>'accepted' or coalesce(
 accepted_at is not null and user_id is not null and state is not null and age_attested and policy_digest is not null and
 (country='AU' or (country='US' and state='CA' and not administrator and
 user_id='d6ab4838-7108-4c50-8ab8-c5947ab55bd8'::uuid)),false));

create or replace function beta_private.admitted_before_owner_gameplay(p_user uuid) returns boolean
language plpgsql security definer set search_path='' as $$declare ok boolean;begin
 perform 1 from beta_private.admission_control where id for share;
 perform 1 from beta_private.admissions where user_id=p_user for share;
 select exists(select 1 from beta_private.admissions a cross join beta_private.admission_control c
 where c.enabled and (a.administrator or c.testers_enabled) and a.user_id=p_user and a.status='accepted'
 and (a.country='AU' or (a.country='US' and a.state='CA' and beta_private.named_tester_authorized(p_user)))
 and a.age_attested and a.policy_digest=c.policy_digest and a.policy_versions=c.policy_versions) into ok;
 return ok;
end$$;

create or replace function beta_private.customer_signup_identity(p_user uuid) returns boolean
language sql security definer set search_path='' as $$
 select beta_private.named_tester_setup_identity(p_user) or exists(
 select 1 from beta_private.customer_invitations i join auth.users u on u.id=i.intended_user join beta_private.admissions a on a.user_id=u.id
 where u.id=p_user and i.account_bound_at is not null and i.revoked_at is null and lower(to_jsonb(u)->>'email')=i.email and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
 and a.status in('reserved','accepted') and (a.status='accepted' or i.expires_at>clock_timestamp()) and coalesce((to_jsonb(u)->>'banned_until')::timestamptz,'-infinity')<=clock_timestamp())
$$;

create or replace function beta_private.pending_beta_consent(p_user uuid) returns boolean
language sql security definer set search_path='' as $$
 select exists(select 1 from beta_private.admissions a join auth.users u on u.id=a.user_id cross join beta_private.admission_control c
 where c.enabled and a.user_id=p_user and a.status='accepted'
 and (a.country='AU' or (a.country='US' and a.state='CA' and beta_private.named_tester_authorized(p_user))) and a.age_attested
 and (a.policy_versions is distinct from c.policy_versions or a.policy_digest is distinct from c.policy_digest)
 and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
 and coalesce((to_jsonb(u)->>'banned_until')::timestamptz,'-infinity')<=clock_timestamp()
 and beta_private.beta_gameplay_identity(p_user))
$$;

create or replace function beta_private.profile_admission_guard() returns trigger
language plpgsql security definer set search_path='' as $$begin
 if not beta_private.admitted(new.id) then raise exception 'Accepted beta admission required';end if;
 if not new.age_attested or not exists(select 1 from beta_private.admissions a
 where a.user_id=new.id and a.country=new.country and a.state=new.state and a.policy_versions->>'terms'=new.accepted_version
 and (new.country='AU' or (new.country='US' and new.state='CA' and beta_private.named_tester_authorized(new.id)))) then
  raise exception 'Beta eligibility or policy mismatch';
 end if;
 return new;
end$$;

create function beta_private.accept_named_tester(p_user uuid,p_session uuid,p_country text,p_state text,
 p_adult boolean,p_versions jsonb,p_notice text,p_notice_accepted boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare c beta_private.admission_control; a beta_private.admissions; e beta_private.named_tester_exception;
begin
 perform pg_advisory_xact_lock(71820342);
 select * into strict c from beta_private.admission_control where id for update;
 select * into strict e from beta_private.named_tester_exception where user_id=p_user for share;
 select * into strict a from beta_private.admissions where user_id=p_user for update;
 if p_user is distinct from auth.uid() or p_session is distinct from (auth.jwt()->>'session_id')::uuid
 or not beta_private.named_tester_setup_identity(p_user) or not beta_private.beta_gameplay_identity(p_user)
 or not exists(select 1 from auth.sessions s where s.user_id=p_user and s.id=p_session and (s.not_after is null or s.not_after>clock_timestamp())) then
  raise exception 'Own active named tester session required';
 end if;
 if p_country is distinct from e.country or p_state is distinct from e.state or p_adult is distinct from true
 or p_versions is distinct from c.policy_versions or p_notice is distinct from e.notice_version or p_notice_accepted is distinct from true then
  raise exception 'Current personal testing notice and own eligibility acceptance required';
 end if;
 if a.status='accepted' then
  if a.country is distinct from p_country or a.state is distinct from p_state then raise exception 'Accepted region cannot be replaced';end if;
  perform beta_private.renew_customer_consent(p_user,p_session,p_country,p_state,p_versions);
  return a.id;
 end if;
 if a.status<>'reserved' then raise exception 'Pending named tester admission required';end if;
 update beta_private.admissions set status='accepted',accepted_at=clock_timestamp(),country=e.country,state=e.state,
  age_attested=true,policy_digest=c.policy_digest,policy_versions=p_versions where id=a.id;
 insert into beta_private.admission_events(admission_id,action,actor,details)
 values(a.id,'named_tester_accepted',p_user::text,jsonb_build_object(
  'noticeVersion',e.notice_version,'noticeSha256',e.notice_sha256,'country',e.country,'state',e.state,
  'authority',e.authority_reference,'evidenceType','own authenticated consent',
  'supersedesExpiredInvitationForSetupOnly',true));
 return a.id;
end$$;

revoke all on function beta_private.named_tester_exception_serialize(),beta_private.named_tester_exception_guard(),beta_private.named_tester_authorized(uuid),
 beta_private.named_tester_setup_identity(uuid),beta_private.accept_named_tester(uuid,uuid,text,text,boolean,jsonb,text,boolean)
 from public,anon,authenticated,docked_app,docked_beta_app;
grant execute on function beta_private.named_tester_setup_identity(uuid),
 beta_private.accept_named_tester(uuid,uuid,text,text,boolean,jsonb,text,boolean) to docked_beta_app;
