-- PREPARED ONLY. Schema/security preparation does not retire any account.
-- The separately reviewed operator freezes a fresh manifest in one transaction,
-- then uses supported Supabase Admin soft deletion outside that transaction.
create schema launch_transition;
revoke all on schema launch_transition from public,anon,authenticated,service_role,docked_app,docked_beta_app,docked_commercial_app;
create table launch_transition.batches(
 id text primary key check(id~'^[a-f0-9]{64}$'),
 source_sha256 text not null check(source_sha256~'^[a-f0-9]{64}$'),
 approval_sha256 text not null check(approval_sha256~'^[a-f0-9]{64}$'),
 notice_sha256 text not null check(notice_sha256~'^[a-f0-9]{64}$'),
 state text not null check(state in('blocked','complete')),
 created_at timestamptz not null default clock_timestamp(),completed_at timestamptz
);
create unique index one_clean_transition on launch_transition.batches((true));
create table launch_transition.accounts(
 user_id uuid primary key references auth.users(id) on delete restrict,
 batch text not null references launch_transition.batches,
 kind text not null check(kind in('owner','customer','system')),
 identity_sha256 text not null check(identity_sha256~'^[a-f0-9]{64}$'),
 phase text not null check(phase in('retained','access_blocked','auth_retired')),
 check((kind='customer' and phase in('access_blocked','auth_retired')) or(kind<>'customer' and phase='retained'))
);
create table launch_transition.historical_cards(
 id text primary key, batch text not null references launch_transition.batches
);
create table launch_transition.events(
 id bigint generated always as identity primary key,batch text not null references launch_transition.batches,
 user_id uuid,action text not null,detail jsonb not null default '{}',created_at timestamptz not null default clock_timestamp()
);
create function launch_transition.immutable() returns trigger language plpgsql set search_path='' as $$begin raise exception 'Transition history is immutable';end$$;
create trigger transition_events_immutable before update or delete on launch_transition.events for each row execute function launch_transition.immutable();
create trigger transition_events_no_truncate before truncate on launch_transition.events for each statement execute function launch_transition.immutable();
create trigger transition_cards_immutable before update or delete on launch_transition.historical_cards for each row execute function launch_transition.immutable();
create trigger transition_cards_no_truncate before truncate on launch_transition.historical_cards for each statement execute function launch_transition.immutable();
do $$declare t text;begin foreach t in array array['batches','accounts','historical_cards','events']loop
 execute format('alter table launch_transition.%I enable row level security',t);
 execute format('revoke all on launch_transition.%I from public,anon,authenticated,service_role,docked_app,docked_beta_app,docked_commercial_app',t);
end loop;end$$;
create function launch_transition.identity_allowed(u uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select u is not null and not exists(select 1 from launch_transition.accounts where user_id=u and kind in('customer','system'))
$$;
create function launch_transition.beta_ended() returns boolean
language sql stable security definer set search_path='' as $$select exists(select 1 from launch_transition.batches)$$;
create function private.commercial_transition_status(u uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('allowed',launch_transition.identity_allowed(u),'betaEnded',launch_transition.beta_ended(),
 'commercialReady',exists(select 1 from launch_transition.batches where state='complete'))
$$;
create function beta_private.commercial_transition_status(u uuid) returns jsonb
language sql stable security definer set search_path='' as $$select private.commercial_transition_status(u)$$;
-- GoTrue v2.198 soft deletion obfuscates phone/email, retaining confirmation
-- timestamps. Deleted identities must never claim even a digit-only tombstone.
create or replace function private.sync_verified_phone_claim() returns trigger language plpgsql security definer set search_path='' as $$begin
 if tg_op='DELETE'then delete from private.verified_phone_claims where user_id=old.id;return old;end if;
 if tg_op='UPDATE'then
  if new.id is distinct from old.id then raise exception 'Auth identity changes require separate review';end if;
  delete from private.verified_phone_claims where user_id=old.id;
 end if;
 if new.deleted_at is null and new.phone_confirmed_at is not null and new.phone~'^\+?[1-9][0-9]{7,14}$'then
  insert into private.verified_phone_claims(canonical_phone,user_id)values(regexp_replace(new.phone,'^\+',''),new.id);
 end if;return new;end$$;
create or replace function private.public_phone_verified(u uuid) returns boolean language sql stable security definer set search_path='' as $$
 select launch_transition.identity_allowed(u) and exists(select 1 from auth.users a join private.verified_phone_claims p on p.user_id=a.id and p.canonical_phone=regexp_replace(a.phone,'^\+','')
 where a.id=u and a.deleted_at is null and a.phone~'^\+?614[0-9]{8}$'and a.phone_confirmed_at is not null and a.phone_confirmed_at<=clock_timestamp()
 and a.email_confirmed_at is not null and not coalesce(a.is_anonymous,false)and(a.banned_until is null or a.banned_until<=clock_timestamp()))
$$;

-- Existing authenticated tokens stop working as soon as the containment
-- transaction commits, before irreversible Auth soft deletion begins.
alter function beta_private.admitted(uuid) rename to admitted_before_clean_transition;
create function beta_private.admitted(p_user uuid) returns boolean language plpgsql security definer set search_path='' as $$begin
 if not launch_transition.identity_allowed(p_user) then return false;end if;
 return beta_private.admitted_before_clean_transition(p_user);
end$$;
create or replace function private.active_member_session() returns boolean language sql security definer set search_path='' as $$
 select launch_transition.identity_allowed(auth.uid()) and exists(
 select 1 from auth.sessions s join auth.users u on u.id=s.user_id join public.profiles p on p.id=u.id
 where s.user_id=auth.uid() and s.id::text=auth.jwt()->>'session_id'
 and u.deleted_at is null and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
 and(u.banned_until is null or u.banned_until<=clock_timestamp()) and p.disabled_at is null
 and(s.not_after is null or s.not_after>clock_timestamp())
 and(not exists(select 1 from private.roles where user_id=u.id) or auth.jwt()->>'aal'='aal2'))
$$;
-- Existing delegated staff admission remains exact-email/roster/approval bound;
-- Owner is the same existing role, not metadata or a separate permission model.
create or replace function beta_private.owner_gameplay_identity(p_user uuid) returns boolean language plpgsql security definer set search_path='' as $$begin
 return launch_transition.identity_allowed(p_user) and exists(
 select 1 from beta_private.roles r join auth.users u on u.id=r.user_id join beta_public.profiles p on p.id=u.id
 where r.user_id=p_user and r.role='owner' and p.disabled_at is null and u.deleted_at is null
 and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
 and coalesce(u.banned_until,'-infinity')<=clock_timestamp()
 and exists(select 1 from beta_private.owner_gameplay_control where enabled)
 and exists(select 1 from auth.mfa_factors where user_id=u.id and status='verified'));
end$$;
create or replace function beta_private.beta_gameplay_identity(p_user uuid) returns boolean language plpgsql security definer set search_path='' as $$begin
 if not launch_transition.identity_allowed(p_user) then return false;end if;
 if beta_private.beta_gameplay_identity_before_delegated_admin(p_user) then return true;end if;
 perform 1 from beta_private.delegated_admin_admissions where user_id=p_user for share;
 return exists(select 1 from beta_private.delegated_admin_admissions g
 join beta_private.roles role on role.user_id=g.user_id and role.role in('admin','owner')
 join beta_private.friends_roster r on r.user_id=g.user_id and r.enabled
 join auth.users u on u.id=g.user_id and lower(u.email)=r.email
 where g.user_id=p_user and g.enabled and exists(select 1 from beta_private.friends_control where enabled)
 and beta_private.owner_gameplay_identity(g.approved_by) and u.deleted_at is null
 and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
 and coalesce(u.banned_until,'-infinity')<=clock_timestamp());
end$$;
-- A partial transition can never open registration even if other release flags
-- are set accidentally. Existing eligibility, consent and expiry checks remain.
alter function public_gameplay.signup_allowed(text,text,text,text) rename to signup_allowed_before_clean_transition;
create function public_gameplay.signup_allowed(country_id text,state_id text,terms_id text,privacy_id text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from launch_transition.batches where state='complete')
 and public_gameplay.signup_allowed_before_clean_transition(country_id,state_id,terms_id,privacy_id)
$$;

-- No beta collection is a commercial collection. Historical source/custody,
-- sealed allocations and all lifetime supply counters are left intact.
create or replace function commercial_billing.preserved_collection_rows(u uuid,sport_id text)
returns table(id text,rarity text,serial bigint,snapshot jsonb,acquired_at timestamptz,preserved jsonb)
language sql stable security definer set search_path='' as $$
 select null::text,null::text,null::bigint,null::jsonb,null::timestamptz,null::jsonb where false
$$;
create or replace function commercial_billing.member_record(sport_id text) returns jsonb
language plpgsql stable security definer set search_path='' as $$declare u uuid:=auth.uid();answer jsonb;begin
 if u is null or sport_id not in('nfl','afl','nrl') or not private.active_member_session() then raise exception 'Authenticated member required';end if;
 with owned as materialized(select c.id::text id,d.rarity from commercial_billing.cards c
 join commercial_billing.definitions d on d.id=c.definition join commercial_billing.packs p on p.id=c.pack
 where c.owner_id=u and d.sport=sport_id and p.opened_at is not null), counts as(select rarity,count(*)::int n from owned group by rarity)
 select jsonb_build_object('member',u,'sport',sport_id,'total',(select count(*) from owned),
 'counts',coalesce((select jsonb_object_agg(rarity,n) from counts),'{}'),
 'entries',(select count(*) from beta_fantasy.entries e join public_gameplay.rounds r on r.competition_id=e.competition_id where e.user_id=u and r.sport=sport_id),
 'opened',(select count(*) from commercial_billing.packs where member_id=u and product->>'sport'=sport_id and opened_at is not null),
 'revision',md5(coalesce((select string_agg(id,',' order by id) from owned),''))) into answer;
 return answer;end$$;
alter function sports_feed.free_core_inventory(uuid,uuid) rename to free_core_inventory_before_clean_transition;
create function sports_feed.free_core_inventory(u uuid,cid uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(v),'[]') from jsonb_array_elements(sports_feed.free_core_inventory_before_clean_transition(u,cid))v
 where not exists(select 1 from launch_transition.historical_cards h where h.id=v->>'id')
$$;

-- Full in-app Owners may review/acknowledge/resolve incidents with their own
-- MFA identities. Founder inbox attestation remains recipient-only.
create or replace function operations.owner_actor() returns uuid
language plpgsql stable security definer set search_path='' as $$declare u uuid:=auth.uid();begin
 if not launch_transition.identity_allowed(u) or auth.jwt()->>'aal' is distinct from 'aal2' or not exists(
 select 1 from auth.users a join auth.sessions s on s.user_id=a.id
 where a.id=u and s.id::text=auth.jwt()->>'session_id' and(s.not_after is null or s.not_after>clock_timestamp())
 and a.deleted_at is null and a.email_confirmed_at is not null and not coalesce(a.is_anonymous,false)
 and(a.banned_until is null or a.banned_until<=clock_timestamp())
 and(exists(select 1 from private.roles r join public.profiles p on p.id=r.user_id where r.user_id=u and r.role='owner' and p.disabled_at is null)
 or exists(select 1 from beta_private.roles r join beta_public.profiles p on p.id=r.user_id where r.user_id=u and r.role='owner' and p.disabled_at is null)))
 then raise exception 'Active owner MFA session required';end if;return u;end$$;
alter function operations.review(text,jsonb) rename to review_before_clean_transition;
create function operations.review(action_id text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$declare u uuid:=operations.owner_actor();begin
 if action_id='confirm_delivery' and not exists(select 1 from auth.users where id=u and lower(email)='support@docked.com.au' and email_confirmed_at is not null)
 then raise exception 'Only the approved recipient can attest inbox receipt';end if;
 return operations.review_before_clean_transition(action_id,payload);end$$;

-- Defense in depth for direct Data API/Storage requests using still-signed JWTs.
-- Restrictive policies only narrow existing grants; no permissive policy is added.
do $$declare r record;begin for r in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where c.relkind='r' and c.relrowsecurity and(n.nspname in('public','private','beta_public','beta_private','beta_fantasy','sports_feed','commercial_billing','credits_sandbox') or(n.nspname='storage' and c.relname='objects'))
 loop execute format('create policy clean_transition_deny on %I.%I as restrictive for all to authenticated using(launch_transition.identity_allowed(auth.uid())) with check(launch_transition.identity_allowed(auth.uid()))',r.nspname,r.relname);end loop;end$$;
revoke all on all functions in schema launch_transition from public,anon,authenticated,service_role,docked_app,docked_beta_app,docked_commercial_app;
grant usage on schema launch_transition to authenticated;
grant execute on function launch_transition.identity_allowed(uuid) to authenticated;
revoke all on function private.commercial_transition_status(uuid),beta_private.commercial_transition_status(uuid),beta_private.admitted_before_clean_transition(uuid),beta_private.admitted(uuid),public_gameplay.signup_allowed_before_clean_transition(text,text,text,text),public_gameplay.signup_allowed(text,text,text,text),sports_feed.free_core_inventory_before_clean_transition(uuid,uuid),sports_feed.free_core_inventory(uuid,uuid),operations.review_before_clean_transition(text,jsonb),operations.review(text,jsonb) from public,anon,authenticated,service_role,docked_app,docked_beta_app,docked_commercial_app;
grant execute on function private.commercial_transition_status(uuid),public_gameplay.signup_allowed(text,text,text,text) to docked_app;
grant execute on function beta_private.commercial_transition_status(uuid),beta_private.admitted(uuid) to docked_beta_app;
grant execute on function operations.review(text,jsonb) to docked_app,docked_beta_app;
alter function beta_packs.member_allowed(uuid) rename to member_allowed_before_clean_transition;
create function beta_packs.member_allowed(u uuid) returns boolean language sql security definer set search_path='' as $$
 select not launch_transition.beta_ended() and launch_transition.identity_allowed(u) and beta_packs.member_allowed_before_clean_transition(u)
$$;
alter function beta_packs.assert_grant(uuid) rename to assert_grant_before_clean_transition;
create function beta_packs.assert_grant(u uuid) returns void language plpgsql security definer set search_path='' as $$begin
 if launch_transition.beta_ended() then raise exception 'Beta grants ended';end if;
 perform beta_packs.assert_grant_before_clean_transition(u);end$$;
revoke all on function beta_packs.member_allowed_before_clean_transition(uuid),beta_packs.member_allowed(uuid),beta_packs.assert_grant_before_clean_transition(uuid),beta_packs.assert_grant(uuid) from public,anon,authenticated,service_role,docked_app,docked_beta_app,docked_commercial_app;
grant execute on function beta_packs.member_allowed(uuid),beta_packs.assert_grant(uuid) to docked_beta_app;
alter function beta_private.begin_customer_signup(text,text) rename to begin_customer_signup_before_clean_transition;
create function beta_private.begin_customer_signup(p_email text,p_digest text) returns uuid language plpgsql security definer set search_path='' as $$begin
 if launch_transition.beta_ended() then raise exception 'Beta invitations have ended; use normal public registration when open';end if;
 return beta_private.begin_customer_signup_before_clean_transition(p_email,p_digest);end$$;
revoke all on function beta_private.begin_customer_signup_before_clean_transition(text,text),beta_private.begin_customer_signup(text,text) from public,anon,authenticated,service_role,docked_app,docked_beta_app,docked_commercial_app,docked_signup_worker;
grant execute on function beta_private.begin_customer_signup(text,text) to docked_signup_worker;
-- No account/role/phone/session/financial/card data or release flag is changed.
