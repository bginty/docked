-- Infrastructure only. No account, grant, policy approval or sporting record is created.
alter table private.region_policies add column preview_community_only boolean not null default false;
alter table private.region_policies add constraint preview_community_scope check (
 (not preview_community_only or (
   country='XX' and state='DOCKED_PREVIEW' and minimum_age=18
   and cardinality(features)>0 and features <@ array['community_social','public_profiles']::text[]
   and cardinality(operators)=0 and evidence like 'PREVIEW TEST ONLY:%'
 )) and (country<>'XX' or state<>'DOCKED_PREVIEW' or preview_community_only)
);

create table private.preview_tester_access (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 policy_id uuid not null references private.region_policies(id),
 project_ref text not null check(project_ref='bckkllmndoxzpzdqrevb'),
 created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null,
 granted_by text not null check(length(btrim(granted_by)) between 3 and 200),
 reason text not null check(length(btrim(reason)) between 10 and 1000),
 revoked_at timestamptz,
 revoked_by text,
 revocation_reason text,
 check(expires_at>created_at and expires_at<=created_at+interval '7 days'),
 check((revoked_at is null and revoked_by is null and revocation_reason is null)
   or (revoked_at is not null and revoked_by is not null and revocation_reason is not null
      and revoked_at>=created_at and length(btrim(revoked_by)) between 3 and 200
      and length(btrim(revocation_reason)) between 10 and 1000))
);
create index preview_tester_access_user on private.preview_tester_access(user_id,policy_id) where revoked_at is null;
alter table private.preview_tester_access enable row level security;
revoke all on private.preview_tester_access from public,anon,authenticated;

create function private.preview_tester_grant_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and (
  old.revoked_at is not null or new.revoked_at is null
  or (to_jsonb(new)-array['revoked_at','revoked_by','revocation_reason']) is distinct from
     (to_jsonb(old)-array['revoked_at','revoked_by','revocation_reason'])
 ) then raise exception 'Preview grants are immutable except first revocation'; end if;
 if not exists(select 1 from private.region_policies where id=new.policy_id and preview_community_only)
 then raise exception 'Preview community policy required'; end if;
 insert into private.audit_events(actor,action,subject,details)
 values(case when tg_op='INSERT' then new.granted_by else new.revoked_by end,
  case when tg_op='INSERT' then 'preview_tester_granted' else 'preview_tester_revoked' end,
  new.id::text,jsonb_build_object('policyId',new.policy_id,'projectRef',new.project_ref,'expiresAt',new.expires_at,
   'reason',case when tg_op='INSERT' then new.reason else new.revocation_reason end));
 return new;
end $$;
create trigger preview_tester_grant_guard before insert or update on private.preview_tester_access
 for each row execute function private.preview_tester_grant_guard();

-- This GUC is set only by the trusted server after the complete hosted-preview guard.
-- Browser roles cannot access this function/schema/table; a GUC or user_metadata alone grants nothing.
create function private.preview_tester_policy(p_actor uuid,p_feature text) returns uuid
 language sql volatile set search_path='' as $$
 select p.id from private.preview_tester_access a
 join private.region_policies p on p.id=a.policy_id
 join public.profiles m on m.id=a.user_id
 where current_setting('docked.hosted_preview_project',true)='bckkllmndoxzpzdqrevb'
 and p_feature in ('community_social','public_profiles')
 and a.user_id=p_actor and a.project_ref='bckkllmndoxzpzdqrevb'
 and a.created_at<=clock_timestamp() and a.expires_at>clock_timestamp() and a.revoked_at is null
 and m.disabled_at is null and m.age_attested and m.accepted_version<>''
 and p.preview_community_only and p.approved and p.minimum_age=18
 and p.country='XX' and p.state='DOCKED_PREVIEW' and cardinality(p.operators)=0
 and p.features <@ array['community_social','public_profiles']::text[] and p_feature=any(p.features)
 and p.evidence like 'PREVIEW TEST ONLY:%'
 and p.effective_from<=clock_timestamp() and p.effective_to>clock_timestamp() and p.review_at>clock_timestamp()
 order by a.created_at desc,a.id desc limit 1
$$;

create or replace function private.community_feature_allowed(p_actor uuid,p_feature text) returns boolean
 language sql volatile set search_path='' as $$
 select coalesce((select policy.approved and policy.minimum_age=18 and policy.review_at>clock_timestamp()
 and length(trim(policy.evidence))>0 and p_feature=any(policy.features)
 from public.profiles member
 join lateral (select * from private.region_policies r
   where not r.preview_community_only and r.country=member.country and r.state=member.state
   and r.effective_from<=clock_timestamp() and r.effective_to>clock_timestamp()
   order by r.effective_from desc,r.id desc limit 1) policy on true
 where member.id=p_actor and member.disabled_at is null and member.age_attested and member.accepted_version<>''),false)
 or private.preview_tester_policy(p_actor,p_feature) is not null
$$;

create or replace function private.community_assert_access(p_actor uuid,p_feature text) returns void
 language plpgsql set search_path='' as $$
declare member public.profiles; policy private.region_policies; preview_policy uuid;
begin
 if p_actor is distinct from auth.uid() or not private.active_member_session()
 then raise exception 'Active authenticated session required'; end if;
 select * into member from public.profiles where id=p_actor for share;
 if not found or member.disabled_at is not null or not member.age_attested or member.accepted_version=''
 then raise exception 'Account ineligible'; end if;
 select * into policy from private.region_policies
 where not preview_community_only and country=member.country and state=member.state
 and effective_from<=clock_timestamp() and effective_to>clock_timestamp()
 order by effective_from desc,id desc limit 1 for share;
 if found and policy.approved and policy.minimum_age=18 and policy.review_at>clock_timestamp()
 and policy.effective_from<=clock_timestamp() and policy.effective_to>clock_timestamp()
 and length(trim(policy.evidence))>0 and p_feature=any(policy.features) then return; end if;
 preview_policy := private.preview_tester_policy(p_actor,p_feature);
 if preview_policy is not null then
  -- Revocation/expiry checks happen again AFTER all potentially blocking locks.
  perform 1 from private.preview_tester_access a join private.region_policies p on p.id=a.policy_id
   where a.user_id=p_actor and p.id=preview_policy for share of a,p;
  if private.active_member_session() and private.preview_tester_policy(p_actor,p_feature)=preview_policy then return; end if;
 end if;
 raise exception 'Community feature restricted';
end $$;

revoke all on function private.preview_tester_grant_guard(),private.preview_tester_policy(uuid,text),
 private.community_feature_allowed(uuid,text),private.community_assert_access(uuid,text) from public,anon,authenticated;
