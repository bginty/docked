-- Support-assisted beta minimisation. No rows/accounts are erased on installation.
-- Historical ownership, supply and locked lineup records remain immutable.
create table beta_private.privacy_cases(
 id uuid primary key, user_id uuid not null, operator_id uuid not null,
 reason text not null check(length(reason)>=20), verified_at timestamptz not null default clock_timestamp(),
 state text not null default 'verified' check(state in('verified','local_redacted')),
 created_at timestamptz not null default clock_timestamp(), redacted_at timestamptz
);
create table beta_private.privacy_events(
 id bigint generated always as identity primary key, case_id uuid not null references beta_private.privacy_cases,
 action text not null, actor uuid not null, evidence jsonb not null, created_at timestamptz not null default clock_timestamp()
);
create trigger immutable before update or delete on beta_private.privacy_events for each row execute function beta_private.immutable();
alter table beta_private.privacy_cases enable row level security;
alter table beta_private.privacy_events enable row level security;
revoke all on beta_private.privacy_cases,beta_private.privacy_events from public,anon,authenticated,docked_app,docked_beta_app;

create function beta_private.require_privacy_owner() returns void language plpgsql security invoker set search_path='' as $$begin
 if not beta_private.active_member_session() or auth.jwt()->>'aal' is distinct from 'aal2'
 or not beta_private.owner_gameplay_identity(auth.uid())
 or not exists(select 1 from beta_private.roles where user_id=auth.uid() and role='owner') then raise exception 'Owner MFA required';end if;
end$$;

create function beta_private.support_privacy_case(p_case uuid,p_user uuid,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$begin
 perform beta_private.require_privacy_owner();
 if p_user=auth.uid() or exists(select 1 from beta_private.roles where user_id=p_user)
 or not exists(select 1 from beta_private.admissions where user_id=p_user)
 or length(btrim(p_reason))<20 then raise exception 'Verified ordinary beta member case required';end if;
 insert into beta_private.privacy_cases(id,user_id,operator_id,reason) values(p_case,p_user,auth.uid(),p_reason) on conflict do nothing;
 if not exists(select 1 from beta_private.privacy_cases where id=p_case and user_id=p_user and reason=p_reason) then raise exception 'Conflicting case identity';end if;
 return p_case;
end$$;

create function beta_private.support_privacy_export(p_case uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid; sp uuid; result jsonb;
begin
 perform beta_private.require_privacy_owner();
 select user_id into u from beta_private.privacy_cases where id=p_case;
 if u is null then raise exception 'Verified support case required';end if;
 select id into sp from beta_private.social_profiles where user_id=u;
 select jsonb_build_object('scope','isolated-free-beta','exportedAt',clock_timestamp(),
 'profile',(select to_jsonb(p) from beta_public.profiles p where id=u),
 'socialProfile',(select jsonb_build_object('handle',handle,'displayName',display_name,'bio',bio,'status',status) from beta_private.social_profiles where id=sp),
 'cards',coalesce((select jsonb_agg(to_jsonb(c)) from beta_fantasy.cards c where owner_id=u),'[]'),
 'ownershipHistory',coalesce((select jsonb_agg(jsonb_build_object('card',card_id,'direction',case when to_user=u then 'received' else 'sent' end,'reason',reason,'reference',reference,'at',created_at)) from beta_fantasy.ownership_events where from_user=u or to_user=u),'[]'),
 'packs',coalesce((select jsonb_agg(to_jsonb(p)) from beta_fantasy.packs p where user_id=u),'[]'),
 'teams',coalesce((select jsonb_agg(to_jsonb(e)) from beta_fantasy.entries e where user_id=u),'[]'),
 'results',coalesce((select jsonb_agg(to_jsonb(r)) from beta_fantasy.results r where user_id=u),'[]'),
 'swaps',coalesce((select jsonb_agg(to_jsonb(s)-array['sender','recipient']) from beta_fantasy.swaps s where sender=u or recipient=u),'[]'),
 'posts',coalesce((select jsonb_agg(jsonb_build_object('id',id,'body',body,'sport',sport,'createdAt',created_at,'deletedAt',deleted_at)) from beta_private.social_posts where author_id=sp),'[]'),
 'comments',coalesce((select jsonb_agg(jsonb_build_object('id',id,'post',post_id,'body',body,'createdAt',created_at)) from beta_private.social_comments where author_id=sp),'[]'),
 'media',coalesce((select jsonb_agg(jsonb_build_object('id',id,'mime',mime,'alt',alt,'base64',encode(content,'base64'))) from beta_private.social_media where owner_id=sp),'[]'),
 'consents',coalesce((select jsonb_agg(jsonb_build_object('purpose',purpose,'version',version,'granted',granted,'at',created_at)) from beta_private.consent_events where user_id=u),'[]'),
 'outstandingSources',jsonb_build_array('Microsoft support correspondence: manual identity-scoped export','Security logs and third-party narratives: reviewed export','Shared Auth identity: separate verified request')) into result;
 insert into beta_private.privacy_events(case_id,action,actor,evidence) values(p_case,'export',auth.uid(),jsonb_build_object('scope','beta','thirdPartyIdentitiesRedacted',true));
 return result;
end$$;

create function beta_private.support_privacy_redact(p_case uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare c beta_private.privacy_cases; receipt jsonb;
begin
 perform beta_private.require_privacy_owner();
 select * into c from beta_private.privacy_cases where id=p_case for update;
 if not found then raise exception 'Verified support case required';end if;
 if c.state='local_redacted' then return jsonb_build_object('state','local_redacted','retry',true);end if;
 -- Existing erasure trigger removes social text, media bytes, handle history,
 -- follows, notifications and the account-to-social-profile link atomically.
 update beta_public.profiles set disabled_at=clock_timestamp() where id=c.user_id and disabled_at is null;
 update beta_private.admissions set status='suspended' where user_id=c.user_id and status in('reserved','accepted');
 update beta_private.friends_roster set enabled=false where user_id=c.user_id and enabled;
 update beta_fantasy.members set revoked_at=clock_timestamp() where user_id=c.user_id and revoked_at is null;
 delete from beta_public.profiles where id=c.user_id;
 delete from beta_private.analytics_events where user_id=c.user_id;
 update beta_private.outbox set state='suppressed',user_id=null,payload='{}',dedupe_key='erased:'||id::text,last_error='Privacy request',lease_token=null,lease_until=null where user_id=c.user_id;
 receipt:=jsonb_build_object('state','local_redacted','socialTextAndMediaRemoved',true,'betaAccessRevoked',true,
 'auditHistoryPreserved',true,'fullyAnonymous',false,'remainingTasks',jsonb_build_array(
 'Shared Auth identity and residual UUID link require verified cross-product review',
 'Shared Auth identity scope check and revocation/erasure',
 'Microsoft correspondence and provider logs/backups',
 'Review personal references in third-party text and audit reasons'));
 update beta_private.privacy_cases set state='local_redacted',redacted_at=clock_timestamp() where id=p_case;
 perform set_config('docked.privacy_case',p_case::text,true);
 update beta_private.friends_roster set email=replace(c.user_id::text,'-','')||'@deleted.invalid',enabled=false where user_id=c.user_id;
 update beta_private.admissions set email=replace(c.user_id::text,'-','')||'@deleted.invalid',user_id=null where user_id=c.user_id;
 perform set_config('docked.privacy_case','',true);
 insert into beta_private.privacy_events(case_id,action,actor,evidence) values(p_case,'local-redaction',auth.uid(),receipt);
 return receipt;
end$$;
revoke all on function beta_private.require_privacy_owner(),beta_private.support_privacy_case(uuid,uuid,text),beta_private.support_privacy_export(uuid),beta_private.support_privacy_redact(uuid) from public,anon,authenticated,docked_app,docked_beta_app;
-- Operator connection invokes with an independently verified existing owner AAL2 session.
-- No browser route or global identity deletion grant.

-- Explicit audited privacy exception, not a general bypass of admission identity.
-- SQL runtime roles cannot become the migration/function owner or execute the eraser.
create function beta_private.privacy_redaction_allowed(p_user uuid,p_email text) returns boolean language sql security invoker set search_path='' as $$
 select current_user=pg_catalog.pg_get_userbyid((select proowner from pg_catalog.pg_proc where oid='beta_private.support_privacy_redact(uuid)'::regprocedure))
 and p_email=replace(p_user::text,'-','')||'@deleted.invalid'
 and exists(select 1 from beta_private.privacy_cases where id::text=current_setting('docked.privacy_case',true) and user_id=p_user and state='local_redacted')
$$;
revoke all on function beta_private.privacy_redaction_allowed(uuid,text) from public,anon,authenticated,docked_app,docked_beta_app;
-- Preserve existing guard bodies verbatim after a narrowly constrained early return.
do $$declare definition text;begin
 definition:=pg_get_functiondef('beta_private.admission_guard()'::regprocedure);
 definition:=regexp_replace(definition,'begin','begin
 if tg_op=''UPDATE'' and old.status in(''suspended'',''revoked'') and new.user_id is null
 and (to_jsonb(new)-array[''email'',''user_id''])=(to_jsonb(old)-array[''email'',''user_id''])
 and beta_private.privacy_redaction_allowed(old.user_id,new.email) then return new;end if;', 'i');
 execute definition;
 definition:=pg_get_functiondef('beta_private.friends_roster_guard()'::regprocedure);
 definition:=regexp_replace(definition,'begin','begin
 if tg_op=''UPDATE'' and not new.enabled and not old.enabled
 and (to_jsonb(new)-''email'')=(to_jsonb(old)-''email'')
 and beta_private.privacy_redaction_allowed(old.user_id,new.email) then return new;end if;', 'i');
 execute definition;
 definition:=pg_get_functiondef('beta_private.friends_admission_guard()'::regprocedure);
 definition:=regexp_replace(definition,'begin','begin
 if tg_op=''UPDATE'' and old.status in(''suspended'',''revoked'') and new.user_id is null
 and (to_jsonb(new)-array[''email'',''user_id''])=(to_jsonb(old)-array[''email'',''user_id''])
 and beta_private.privacy_redaction_allowed(old.user_id,new.email) then return new;end if;', 'i');
 execute definition;
end$$;
