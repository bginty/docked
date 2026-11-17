-- Install only in the exact separately approved transition package. These
-- operator functions have NO application/Auth-role grants. No call is made here.
create function launch_transition.source_digest() returns text
language sql stable set search_path='' as $$
 select encode(sha256(convert_to(jsonb_build_object(
 'auth',(select jsonb_agg(jsonb_build_object('id',id,'email',lower(email),'phone',phone,'email_verified',email_confirmed_at,'phone_verified',phone_confirmed_at,'deleted',deleted_at,'banned',banned_until)order by id)from auth.users),
 'mfa',(select jsonb_agg(jsonb_build_object('id',id,'user',user_id,'status',status,'type',factor_type)order by id)from auth.mfa_factors),
 'profiles',(select jsonb_agg(to_jsonb(p)order by id)from beta_public.profiles p),
 'roles',(select jsonb_agg(to_jsonb(r)order by user_id)from beta_private.roles r),
 'consent',(select jsonb_agg(to_jsonb(c)order by id)from beta_private.consent_events c),
 'state',(select encode(sha256(convert_to(document::text,'UTF8')),'hex')from credits_sandbox.state where id),
 'cards',(select encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(c)order by id),'[]')::text,'UTF8')),'hex')from beta_fantasy.cards c),
 'definitions',(select encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(d)order by id),'[]')::text,'UTF8')),'hex')from commercial_billing.definitions d)
 )::text,'UTF8')),'hex')
$$;
create function launch_transition.prepare(plan jsonb,expected_source text,approval text,notice text) returns text
language plpgsql set search_path='' as $$
declare b text:=encode(sha256(convert_to(plan::text,'UTF8')),'hex');acct record;f uuid;begin
 perform pg_advisory_xact_lock(71820342); -- same lock as beta financial writes
 lock beta_public.profiles,beta_private.roles,beta_private.consent_events,credits_sandbox.state,beta_fantasy.cards,commercial_billing.definitions in share row exclusive mode;
 lock public.profiles,private.roles,private.consent_events in share row exclusive mode;
 if exists(select 1 from launch_transition.batches)then
  if not exists(select 1 from launch_transition.batches where id=b and approval_sha256=approval and notice_sha256=notice)then raise exception 'Different transition already started';end if;
  return b; -- never recopy or re-enable partially retired accounts
 end if;
 if expected_source is distinct from launch_transition.source_digest()then raise exception 'Fresh transition source drift';end if;
 if approval!~'^[a-f0-9]{64}$' or notice!~'^[a-f0-9]{64}$' or approval is null or notice is null then raise exception 'Exact approval and notice references required';end if;
 if jsonb_typeof(plan) is distinct from 'array' or jsonb_array_length(plan)<>6 then raise exception 'Exact six classified identities required';end if;
 if(select count(distinct x->>'id')from jsonb_array_elements(plan)x)<>6
 or(select count(*)from jsonb_array_elements(plan)x where x->>'kind'='owner')<>2
 or(select count(*)from jsonb_array_elements(plan)x where x->>'kind'='customer')<>3
 or(select count(*)from jsonb_array_elements(plan)x where x->>'kind'='system')<>1 then raise exception 'Account classification changed';end if;
 if exists(select id from auth.users except select(x->>'id')::uuid from jsonb_array_elements(plan)x)
 or exists(select(x->>'id')::uuid from jsonb_array_elements(plan)x except select id from auth.users)
 then raise exception 'Unreviewed or missing Auth identity';end if;
 if exists(select 1 from public.profiles)or exists(select 1 from private.roles)or exists(select 1 from private.consent_events)
 or exists(select 1 from public.notification_preferences)then raise exception 'Public destination is not empty';end if;
 if exists(select 1 from private.feature_flags where key in('registration','operational_incident_cleanup')and enabled)
 or exists(select 1 from commercial_billing.control where sales_enabled or issuance_enabled or transfers_enabled or gameplay_enabled)
 or exists(select 1 from commercial_billing.receipts)or exists(select 1 from commercial_billing.cards)or exists(select 1 from commercial_billing.packs)
 or exists(select 1 from commercial_billing.accounts)or exists(select 1 from public_gameplay.rounds where enabled)
 or exists(select 1 from beta_fantasy.entries e join public_gameplay.rounds r on r.competition_id=e.competition_id)
 or exists(select 1 from beta_fantasy.round_drafts e join public_gameplay.rounds r on r.competition_id=e.competition_id)
 then raise exception 'Closed empty commercial runtime required';end if;
 for acct in select(x->>'id')::uuid id,x->>'kind'kind,x->>'emailSha256'email_sha,x->>'originalRole'original_role from jsonb_array_elements(plan)x loop
  if not exists(select 1 from auth.users u join beta_public.profiles p on p.id=u.id where u.id=acct.id and u.deleted_at is null and u.email_confirmed_at is not null
    and encode(sha256(convert_to(lower(u.email),'UTF8')),'hex')=acct.email_sha and not coalesce(u.is_anonymous,false))
  then raise exception 'Verified identity evidence changed';end if;
  if coalesce((select role::text from beta_private.roles where user_id=acct.id),'none')<>acct.original_role then raise exception 'Role drift';end if;
  if acct.kind='owner' and (acct.original_role not in('owner','admin')or not exists(select 1 from auth.mfa_factors where user_id=acct.id and status='verified'and factor_type='totp'))then raise exception 'Retained Owner identity/MFA prerequisite';end if;
  if acct.kind<>'owner' and acct.original_role<>'none' then raise exception 'Unexpected staff/system classification';end if;
 end loop;
 select(x->>'id')::uuid into strict f from jsonb_array_elements(plan)x where x->>'kind'='owner'and x->>'originalRole'='owner';
 insert into launch_transition.batches values(b,expected_source,approval,notice,'blocked',clock_timestamp(),null);
 -- Containment uses the immutable transition registry. Do not invoke generic
 -- profile-disable erasure triggers, which would destroy historical social data.
 insert into launch_transition.accounts select(x->>'id')::uuid,b,x->>'kind',x->>'emailSha256',case when x->>'kind'='customer'then'access_blocked'else'retained'end from jsonb_array_elements(plan)x;
 insert into launch_transition.historical_cards select id,b from(
  select id::text id from beta_fantasy.cards union
  select key from credits_sandbox.state cross join lateral jsonb_object_keys(document->'commerce'->'cards')key where state.id union
  select key from credits_sandbox.state cross join lateral jsonb_object_keys(document->'economy'->'instances')key where state.id
 )c;
 -- Exact profile/consent history for Owners only; old policy versions stay old.
 insert into public.profiles select p.* from beta_public.profiles p join launch_transition.accounts a on a.user_id=p.id where a.kind='owner';
 insert into private.consent_events select c.* from beta_private.consent_events c join launch_transition.accounts a on a.user_id=c.user_id where a.kind='owner';
 insert into public.notification_preferences select p.* from beta_public.notification_preferences p join launch_transition.accounts a on a.user_id=p.user_id where a.kind='owner';
 insert into private.roles(user_id,role,assigned_by,assigned_at)select user_id,'owner',f,clock_timestamp()from launch_transition.accounts where kind='owner';
 update beta_private.roles set role='owner',assigned_by=f,assigned_at=clock_timestamp()where user_id in(select user_id from launch_transition.accounts where kind='owner')and role<>'owner';

 update beta_private.friends_roster set enabled=false where user_id in(select user_id from launch_transition.accounts where kind='customer');
 update beta_private.named_tester_exception set enabled=false where user_id in(select user_id from launch_transition.accounts where kind='customer');
 update credits_sandbox.access set enabled=false where user_id in(select user_id from launch_transition.accounts);
 update credits_sandbox.trading_members set enabled=false where user_id in(select user_id from launch_transition.accounts);
 insert into launch_transition.events(batch,user_id,action,detail)select b,user_id,case when kind='owner'then'OWNER_RETAINED'when kind='customer'then'ACCESS_BLOCKED'else'SYSTEM_PRESERVED'end,jsonb_build_object('kind',kind,'commercialAssetsCopied',false,'authChanged',false)from launch_transition.accounts;
 insert into private.audit_events(actor,action,subject,details)values('reviewed-release-operator','clean_commercial_transition_prepared',b,jsonb_build_object('approval',approval,'notice',notice,'rolesGranted',2,'newConsentRecorded',false));
 return b;
end$$;
create function launch_transition.record_auth_retired(b text,u uuid) returns void
language plpgsql set search_path='' as $$declare r launch_transition.accounts;begin
 select * into strict r from launch_transition.accounts where user_id=u and batch=b for update;
 if r.kind<>'customer'then raise exception 'Owner/system Auth retirement forbidden';end if;
 if not exists(select 1 from auth.users where id=u and deleted_at is not null)
 or exists(select 1 from auth.users where id=u and encode(sha256(convert_to(lower(email),'UTF8')),'hex')=r.identity_sha256)
 or exists(select 1 from auth.sessions where user_id=u)
 or exists(select 1 from private.verified_phone_claims where user_id=u)
 or exists(select 1 from auth.mfa_factors where user_id=u)
 then raise exception 'Supported Auth retirement not verified';end if;
 if r.phase='auth_retired'then return;end if;
 update launch_transition.accounts set phase='auth_retired'where user_id=u;
 insert into launch_transition.events(batch,user_id,action)values(b,u,'AUTH_RETIREMENT_VERIFIED');
end$$;
create function launch_transition.complete(b text) returns void language plpgsql set search_path='' as $$declare u uuid;begin
 perform 1 from launch_transition.batches where id=b for update;if not found then raise exception 'Unknown transition';end if;
 for u in select user_id from launch_transition.accounts where batch=b and kind='customer'loop perform launch_transition.record_auth_retired(b,u);end loop;
 if exists(select 1 from launch_transition.accounts a left join auth.users u on u.id=a.user_id where a.kind='owner'and(u.id is null or u.deleted_at is not null or not exists(select 1 from private.roles where user_id=a.user_id and role='owner')or not exists(select 1 from auth.mfa_factors where user_id=a.user_id and status='verified')))
 then raise exception 'Owner retention failed';end if;
 if exists(select 1 from launch_transition.batches where id=b and state='complete')then return;end if;
 update launch_transition.batches set state='complete',completed_at=clock_timestamp()where id=b;
 insert into launch_transition.events(batch,action)values(b,'TRANSITION_COMPLETE_GATES_CLOSED');
end$$;
revoke all on function launch_transition.source_digest(),launch_transition.prepare(jsonb,text,text,text),launch_transition.record_auth_retired(text,uuid),launch_transition.complete(text)from public,anon,authenticated,service_role,docked_app,docked_beta_app,docked_commercial_app;
