-- An invitation reserves eligibility, not an Auth account, consent or cards.
create table beta_private.customer_invitations(
 id uuid primary key default gen_random_uuid(), email text unique not null check(email=lower(btrim(email))),
 token_digest text unique not null check(token_digest ~ '^[a-f0-9]{64}$'),
 intended_user uuid unique not null default gen_random_uuid(),
 expires_at timestamptz not null, created_at timestamptz not null default clock_timestamp(),
 authority text not null check(length(authority)>20), revoked_at timestamptz,
 account_bound_at timestamptz, last_attempt_at timestamptz,
 check(expires_at>created_at and expires_at<=created_at+interval '7 days')
);
alter table beta_private.customer_invitations enable row level security;
revoke all on beta_private.customer_invitations from public,anon,authenticated,docked_app,docked_beta_app;
create function beta_private.customer_invitation_guard() returns trigger language plpgsql set search_path='' as $$begin
 perform pg_advisory_xact_lock(71820341);
 update beta_private.admission_control set admission_revision=admission_revision+1 where id;
 if tg_op='DELETE' then raise exception 'Invitation history is permanent';end if;
 if tg_op='INSERT' then
  if exists(select 1 from auth.users u where lower(to_jsonb(u)->>'email')=new.email) then raise exception 'Existing account requires the existing admission workflow';end if;
  if (select count(*) from (select email from beta_private.customer_invitations union select email from beta_private.admissions where not administrator) slots)>=10 then raise exception 'Ten tester lifetime limit';end if;
 elsif (to_jsonb(new)-array['revoked_at','account_bound_at','last_attempt_at']) is distinct from (to_jsonb(old)-array['revoked_at','account_bound_at','last_attempt_at'])
 or (old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at)
 or (old.account_bound_at is not null and new.account_bound_at is distinct from old.account_bound_at) then raise exception 'Invitation identity is permanent';end if;
 return new;
end$$;
create trigger guard before insert or update or delete on beta_private.customer_invitations for each row execute function beta_private.customer_invitation_guard();
-- A separately scoped Edge Function role. No privileged Auth key in the web app.
do $$begin if not exists(select 1 from pg_roles where rolname='docked_signup_worker') then create role docked_signup_worker nologin nosuperuser nocreatedb nocreaterole noinherit;end if;end$$;
grant usage on schema beta_private to docked_signup_worker;
create function beta_private.begin_customer_signup(p_email text,p_digest text) returns uuid language plpgsql security definer set search_path='' as $$
declare i beta_private.customer_invitations;begin
 if not exists(select 1 from beta_private.friends_control where enabled) or not exists(select 1 from beta_private.admission_control where enabled and testers_enabled) then raise exception 'Invited signup unavailable';end if;
 select * into i from beta_private.customer_invitations where email=lower(btrim(p_email)) and token_digest=p_digest and revoked_at is null and expires_at>clock_timestamp() for update;
 if not found then raise exception 'Invite required';end if;
 if i.last_attempt_at>clock_timestamp()-interval '30 seconds' then raise exception 'Please wait before retrying';end if;
 update beta_private.customer_invitations set last_attempt_at=clock_timestamp() where id=i.id;
 return i.intended_user;
end$$;
create function beta_private.finish_customer_signup(p_user uuid,p_digest text) returns void language plpgsql security definer set search_path='' as $$
declare i beta_private.customer_invitations;begin
 perform pg_advisory_xact_lock(71820341);
 select * into i from beta_private.customer_invitations where intended_user=p_user and token_digest=p_digest and revoked_at is null and expires_at>clock_timestamp() for update;
 if not found or not exists(select 1 from beta_private.friends_control where enabled) or not exists(select 1 from beta_private.admission_control where enabled and testers_enabled) then raise exception 'Invitation unavailable';end if;
 if not exists(select 1 from auth.users u where u.id=p_user and lower(to_jsonb(u)->>'email')=i.email and not coalesce(u.is_anonymous,false)) or beta_private.gameplay_mfa_required(p_user) then raise exception 'Exact ordinary account required';end if;
 if i.account_bound_at is not null then return;end if;
 insert into beta_private.friends_roster(user_id,email,enabled,authority) values(p_user,i.email,true,i.authority);
 perform beta_private.reserve_admission(i.email,p_user,i.token_digest,i.id,i.expires_at,'customer-signup-service');
 update beta_private.customer_invitations set account_bound_at=clock_timestamp() where id=i.id;
 insert into beta_private.admission_events(admission_id,action,actor,details) select id,'customer_account_created',p_user::text,'{"consentRecorded":false,"cardsIssued":false}'::jsonb from beta_private.admissions where user_id=p_user;
end$$;
create function beta_private.customer_signup_identity(p_user uuid) returns boolean language sql security definer set search_path='' as $$
 select exists(select 1 from beta_private.customer_invitations i join auth.users u on u.id=i.intended_user join beta_private.admissions a on a.user_id=u.id
 where u.id=p_user and i.account_bound_at is not null and i.revoked_at is null and lower(to_jsonb(u)->>'email')=i.email and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
 and a.status in('reserved','accepted') and (a.status='accepted' or i.expires_at>clock_timestamp()) and coalesce((to_jsonb(u)->>'banned_until')::timestamptz,'-infinity')<=clock_timestamp())
$$;
create function beta_private.accept_customer_admission(p_user uuid,p_session uuid,p_country text,p_state text,p_adult boolean,p_versions jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare control beta_private.admission_control; invite beta_private.admissions;begin
 select * into strict control from beta_private.admission_control where id for update;
 if not control.enabled or not control.testers_enabled or not exists(select 1 from beta_private.friends_control where enabled) or not beta_private.customer_signup_identity(p_user) then raise exception 'Verified invited account required';end if;
 if p_versions is distinct from control.policy_versions then raise exception 'Current policies required';end if;
 select * into strict invite from beta_private.admissions where user_id=p_user for update;
 if not exists(select 1 from auth.sessions where id=p_session and user_id=p_user and (not_after is null or not_after>clock_timestamp())) then raise exception 'Active session required';end if;
 if p_country is distinct from 'AU' or p_state is null or p_state<>all(array['ACT','NSW','NT','QLD','SA','TAS','VIC','WA']) or p_adult is distinct from true then raise exception 'Australian adult eligibility required';end if;
 if invite.status='accepted' then return invite.id;end if;
 if invite.status<>'reserved' or invite.expires_at<=clock_timestamp() then raise exception 'Invitation unavailable';end if;
 update beta_private.admissions set status='accepted',accepted_at=clock_timestamp(),country=p_country,state=p_state,age_attested=true,policy_digest=control.policy_digest,policy_versions=p_versions where id=invite.id;
 insert into beta_private.admission_events(admission_id,action,actor) values(invite.id,'accepted',p_user::text);
 return invite.id;
end$$;
revoke all on function beta_private.customer_invitation_guard(),beta_private.begin_customer_signup(text,text),beta_private.finish_customer_signup(uuid,text),beta_private.customer_signup_identity(uuid),beta_private.accept_customer_admission(uuid,uuid,text,text,boolean,jsonb) from public,anon,authenticated,docked_app,docked_beta_app;
grant execute on function beta_private.begin_customer_signup(text,text),beta_private.finish_customer_signup(uuid,text) to docked_signup_worker;
grant execute on function beta_private.customer_signup_identity(uuid),beta_private.accept_customer_admission(uuid,uuid,text,text,boolean,jsonb) to docked_beta_app;

-- Policy changes must not create an authentication loop for an existing member.
-- Existing consent stays recorded; explicit new acceptance appends events.
create function beta_private.pending_beta_consent(p_user uuid) returns boolean language sql security definer set search_path='' as $$
 select exists(select 1 from beta_private.admissions a join auth.users u on u.id=a.user_id cross join beta_private.admission_control c
 where c.enabled and a.user_id=p_user and a.status='accepted' and a.country='AU' and a.age_attested
 and (a.policy_versions is distinct from c.policy_versions or a.policy_digest is distinct from c.policy_digest)
 and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
 and coalesce((to_jsonb(u)->>'banned_until')::timestamptz,'-infinity')<=clock_timestamp()
 and beta_private.beta_gameplay_identity(p_user))
$$;
-- Preserve the exact existing guard and add only a separately validated consent
-- transition. No identity/status/region changes are allowed through this path.
do $$declare definition text;begin
 definition:=pg_get_functiondef('beta_private.admission_guard()'::regprocedure);
 if position('(old.status=''accepted'' and new.status not in(''revoked'',''suspended''))' in definition)=0 then raise exception 'Unexpected admission guard';end if;
 definition:=replace(definition,'(old.status=''accepted'' and new.status not in(''revoked'',''suspended''))',
 '(old.status=''accepted'' and new.status not in(''revoked'',''suspended'') and not (
 new.status=''accepted'' and (to_jsonb(new)-array[''policy_digest'',''policy_versions''])=(to_jsonb(old)-array[''policy_digest'',''policy_versions''])
 and new.user_id=auth.uid() and exists(select 1 from beta_private.admission_control c where c.enabled and c.policy_digest=new.policy_digest and c.policy_versions=new.policy_versions)
 and exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id where s.user_id=new.user_id and s.id=(auth.jwt()->>''session_id'')::uuid and (s.not_after is null or s.not_after>clock_timestamp()) and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false))
 and (not beta_private.gameplay_mfa_required(new.user_id) or auth.jwt()->>''aal''=''aal2'')))');
 execute definition;
end$$;
create function beta_private.renew_customer_consent(p_user uuid,p_session uuid,p_country text,p_state text,p_versions jsonb) returns void language plpgsql security definer set search_path='' as $$
declare a beta_private.admissions; c beta_private.admission_control; purpose text;begin
 select * into strict c from beta_private.admission_control where id for update;
 select * into strict a from beta_private.admissions where user_id=p_user for update;
 if not c.enabled or p_user is distinct from auth.uid() or (auth.jwt()->>'session_id')::uuid is distinct from p_session or p_versions is distinct from c.policy_versions or not beta_private.beta_gameplay_identity(p_user) or a.status<>'accepted' or p_country is distinct from a.country or p_state is distinct from a.state then raise exception 'Existing active consent identity required';end if;
 if beta_private.gameplay_mfa_required(p_user) and auth.jwt()->>'aal' is distinct from 'aal2' then raise exception 'Privileged MFA required';end if;
 if not exists(select 1 from auth.users u join auth.sessions s on s.user_id=u.id where u.id=p_user and s.id=p_session and (s.not_after is null or s.not_after>clock_timestamp()) and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)) then raise exception 'Verified session required';end if;
 if a.policy_versions=c.policy_versions and a.policy_digest=c.policy_digest then return;end if;
 update beta_private.admissions set policy_digest=c.policy_digest,policy_versions=c.policy_versions where id=a.id;
 update beta_public.profiles set accepted_version=c.policy_versions->>'terms' where id=p_user;
 foreach purpose in array array['terms','privacy','age_attestation'] loop
  insert into beta_private.consent_events(user_id,purpose,granted,version,actor) values(p_user,purpose,true,c.policy_versions->>(case when purpose='privacy' then 'privacy' else 'terms' end),p_user::text);
 end loop;
 insert into beta_private.admission_events(admission_id,action,actor,details) values(a.id,'policy_reaccepted',p_user::text,jsonb_build_object('previous',a.policy_versions,'resulting',c.policy_versions));
end$$;
revoke all on function beta_private.pending_beta_consent(uuid),beta_private.renew_customer_consent(uuid,uuid,text,text,jsonb) from public,anon,authenticated,docked_app;
grant execute on function beta_private.pending_beta_consent(uuid),beta_private.renew_customer_consent(uuid,uuid,text,text,jsonb) to docked_beta_app;
