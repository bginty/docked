-- Isolated preview invitations and app onboarding. No grants, accounts or policy approvals are seeded.
create function private.preview_capabilities_valid(value text[]) returns boolean
language sql immutable set search_path='' as $$
 select value is not null and value @> array['community_social','public_profiles']::text[]
 and value <@ array['community_social','public_profiles','preview_market_fixtures','preview_top_docked']::text[]
 and cardinality(value)=(select count(distinct x) from unnest(value) x)
$$;
alter table private.preview_tester_access add column capabilities text[] not null default array['community_social','public_profiles']::text[]
 check(private.preview_capabilities_valid(capabilities));

create table private.app_onboarding (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 interests text not null check(interests in ('edges','community','both')),
 version text not null default 'app-beta-2026-10', completed_at timestamptz not null default clock_timestamp()
);

create table private.preview_beta_invitations (
 id uuid primary key default gen_random_uuid(), project_ref text not null check(project_ref='bckkllmndoxzpzdqrevb'),
 policy_id uuid not null references private.region_policies(id),
 token_hash text unique check(token_hash ~ '^[a-f0-9]{64}$'), email_hash text check(email_hash ~ '^[a-f0-9]{64}$'),
 capabilities text[] not null check(private.preview_capabilities_valid(capabilities)),
 fixture boolean not null default false,
 created_at timestamptz not null default clock_timestamp(), expires_at timestamptz not null,
 grant_hours integer not null check(grant_hours between 1 and 168),
 status text not null default 'pending' check(status in ('pending','reserved','redeemed','revoked','failed')),
 created_by text not null check(length(btrim(created_by)) between 3 and 200), reason text not null check(length(btrim(reason)) between 12 and 1000),
 reservation_id uuid, reserved_user_id uuid, redeemed_user_id uuid references public.profiles(id) on delete set null,
 changed_at timestamptz not null default clock_timestamp(),
 check(expires_at>created_at and expires_at<=created_at+interval '7 days'),
 check(status not in ('pending','reserved') or (token_hash is not null and email_hash is not null)),
 check(status<>'reserved' or (reservation_id is not null and reserved_user_id is not null))
);
create index preview_beta_invitation_status on private.preview_beta_invitations(status,expires_at);

create function private.preview_invitation_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and old.redeemed_user_id is not null and new.redeemed_user_id is null
 and old.status in ('redeemed','failed','revoked') and (to_jsonb(new)-'redeemed_user_id')=(to_jsonb(old)-'redeemed_user_id')
 then return new; end if; -- Minimal FK erasure is permitted even after the environment/grant expires.
 if current_setting('docked.hosted_preview_project',true) is distinct from 'bckkllmndoxzpzdqrevb'
 then raise exception 'Exact hosted preview required'; end if;
 if tg_op='DELETE' then raise exception 'Revoke invitations; retain minimal audit'; end if;
 if not exists(select 1 from private.region_policies p where p.id=new.policy_id and p.preview_community_only
   and p.country='XX' and p.state='DOCKED_PREVIEW' and p.minimum_age=18 and cardinality(p.operators)=0)
 then raise exception 'Isolated preview policy required'; end if;
 if tg_op='INSERT' and (new.status<>'pending' or new.reservation_id is not null or new.reserved_user_id is not null or new.redeemed_user_id is not null)
 then raise exception 'New invitation must be unused'; end if;
 if tg_op='UPDATE' then
  if (to_jsonb(new)-array['token_hash','email_hash','status','reservation_id','reserved_user_id','redeemed_user_id','changed_at']) is distinct from
     (to_jsonb(old)-array['token_hash','email_hash','status','reservation_id','reserved_user_id','redeemed_user_id','changed_at'])
  then raise exception 'Invitation authority is immutable'; end if;
  if not ((old.status='pending' and new.status in ('reserved','revoked')) or
    (old.status='reserved' and new.status in ('redeemed','failed','revoked')) or
    (old.status in ('redeemed','failed','revoked') and new.status=old.status and new.redeemed_user_id is null and old.redeemed_user_id is not null))
  then raise exception 'Invalid invitation lifecycle'; end if;
  if old.status<>'pending' and (new.reservation_id is distinct from old.reservation_id or new.reserved_user_id is distinct from old.reserved_user_id)
  then raise exception 'Reservation immutable'; end if;
  if old.status='pending' and new.status='reserved' and (old.token_hash is distinct from new.token_hash or old.email_hash is distinct from new.email_hash)
  then raise exception 'Reservation binding immutable'; end if;
  if new.status in ('reserved','redeemed') and (new.expires_at<=clock_timestamp() or not exists(select 1 from private.region_policies p where p.id=new.policy_id and p.approved and p.effective_from<=clock_timestamp() and p.effective_to>clock_timestamp() and p.review_at>clock_timestamp()))
  then raise exception 'Invitation expired or restricted'; end if;
  if new.status='reserved' and new.redeemed_user_id is not null then raise exception 'Premature redemption'; end if;
  if new.status='redeemed' and (new.redeemed_user_id is null or new.redeemed_user_id is distinct from new.reserved_user_id)
  then raise exception 'Redemption must match reserved identity'; end if;
 end if;
 if new.status in ('redeemed','revoked','failed') then new.token_hash=null;new.email_hash=null; end if;
 new.changed_at=clock_timestamp();
 insert into private.audit_events(actor,action,subject,details) values(coalesce(nullif(current_setting('docked.preview_actor',true),''),new.created_by),
  'preview_invitation_'||new.status,new.id::text,jsonb_build_object('projectRef',new.project_ref,'capabilities',new.capabilities,'expiresAt',new.expires_at));
 return new;
end $$;
create trigger preview_invitation_guard before insert or update or delete on private.preview_beta_invitations
 for each row execute function private.preview_invitation_guard();

create function private.preview_tester_capability(p_actor uuid,p_capability text) returns boolean
language sql volatile set search_path='' as $$
 select coalesce(current_setting('docked.hosted_preview_project',true)='bckkllmndoxzpzdqrevb'
 and p_actor=auth.uid() and private.active_member_session()
 and p_capability in ('community_social','public_profiles','preview_market_fixtures','preview_top_docked')
 and exists(select 1 from private.preview_tester_access g join private.region_policies p on p.id=g.policy_id
   join public.profiles m on m.id=g.user_id
   where g.user_id=p_actor and g.project_ref='bckkllmndoxzpzdqrevb' and p_capability=any(g.capabilities)
   and g.created_at<=clock_timestamp() and g.expires_at>clock_timestamp() and g.revoked_at is null
   and m.disabled_at is null and m.age_attested and m.accepted_version<>''
   and p.preview_community_only and p.approved and p.country='XX' and p.state='DOCKED_PREVIEW' and p.minimum_age=18
   and p.features @> array['community_social','public_profiles']::text[] and p.features <@ array['community_social','public_profiles']::text[]
   and cardinality(p.operators)=0 and p.evidence like 'PREVIEW TEST ONLY:%'
   and p.effective_from<=clock_timestamp() and p.effective_to>clock_timestamp() and p.review_at>clock_timestamp()
   and (p_capability in ('community_social','public_profiles') or
    coalesce((select c.granted from private.consent_events c where c.user_id=p_actor and c.purpose='privacy' order by c.created_at desc,c.id desc limit 1),false))
 ),false)
$$;

create function private.assert_preview_tester_capability(p_actor uuid,p_capability text) returns uuid
language plpgsql set search_path='' as $$
declare g private.preview_tester_access; p private.region_policies;
begin
 if p_actor is distinct from auth.uid() or not private.active_member_session()
 or current_setting('docked.hosted_preview_project',true) is distinct from 'bckkllmndoxzpzdqrevb'
 then raise exception 'Active exact preview session required'; end if;
 perform 1 from public.profiles where id=p_actor for share;
 select * into g from private.preview_tester_access where user_id=p_actor and p_capability=any(capabilities)
 and revoked_at is null and expires_at>clock_timestamp() order by created_at desc,id desc limit 1;
 if not found then raise exception 'Preview capability unavailable'; end if;
 select * into p from private.region_policies where id=g.policy_id for share;
 select * into g from private.preview_tester_access where id=g.id for share;
 if g.revoked_at is not null or g.expires_at<=clock_timestamp() or p.effective_to<=clock_timestamp()
 or p.review_at<=clock_timestamp() or p.effective_from>clock_timestamp() or not p.approved
 or not p.preview_community_only or p.minimum_age<>18 or cardinality(p.operators)<>0
 or not private.preview_tester_capability(p_actor,p_capability)
 then raise exception 'Preview capability unavailable'; end if;
 return g.id;
end $$;

do $$ declare t text; begin foreach t in array array['app_onboarding','preview_beta_invitations'] loop
 execute format('alter table private.%I enable row level security',t);
 execute format('revoke all on private.%I from public,anon,authenticated',t);
end loop; end $$;
revoke all on function private.preview_capabilities_valid(text[]),private.preview_invitation_guard(),private.preview_tester_capability(uuid,text),private.assert_preview_tester_capability(uuid,text) from public,anon,authenticated;

create function private.assert_preview_beta_admin() returns void language plpgsql set search_path='' as $$
begin
 if current_setting('docked.hosted_preview_project',true) is distinct from 'bckkllmndoxzpzdqrevb'
 or not private.active_member_session() or auth.jwt()->>'aal' is distinct from 'aal2'
 or not exists(select 1 from private.roles where user_id=auth.uid() and role in ('owner','admin'))
 then raise exception 'Preview administrator MFA required'; end if;
end $$;
revoke all on function private.assert_preview_beta_admin() from public,anon,authenticated;
