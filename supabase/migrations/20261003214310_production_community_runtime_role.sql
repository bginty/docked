-- Community-only server connection. Provisioning a password/login is a separate
-- exact-project operator action; this migration activates no account or feature.
-- This trusted backend role is NOT a browser JWT role. Application identity,
-- role/MFA and transactional authorization remain mandatory.
do $$ declare column_name text; managed boolean; begin
 select r.rolname='supabase_auth_admin' into managed from pg_class c join pg_roles r on r.oid=c.relowner where c.oid='auth.users'::regclass;
 if managed then
  foreach column_name in array array['id','email','email_confirmed_at','is_anonymous','raw_app_meta_data','banned_until'] loop
   if not exists(select 1 from pg_attribute where attrelid='auth.users'::regclass and attname=column_name and not attisdropped)
   then raise exception 'Managed Auth user schema differs from reviewed production contract'; end if;
  end loop;
  foreach column_name in array array['id','user_id','not_after'] loop
   if not exists(select 1 from pg_attribute where attrelid='auth.sessions'::regclass and attname=column_name and not attisdropped)
   then raise exception 'Managed Auth session schema differs from reviewed production contract'; end if;
  end loop;
  if not has_schema_privilege(current_user,'auth','USAGE')
   or not has_table_privilege(current_user,'auth.users','SELECT')
   or not has_table_privilege(current_user,'auth.sessions','SELECT')
   or not has_table_privilege(current_user,'auth.sessions','DELETE')
   or not exists(select 1 from pg_roles where rolname=current_user and (rolbypassrls or rolsuper))
  then raise exception 'Managed Auth projection-owner privileges require independent review'; end if;
 end if;
end $$;
do $$ begin
 if exists(select 1 from pg_roles where rolname='docked_app') then
  raise exception 'Existing docked_app role requires independent review';
 end if;
 create role docked_app nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
end $$;
alter role docked_app set search_path='';
grant usage on schema public,private to docked_app;
do $$ begin execute format('grant connect on database %I to docked_app',current_database()); end $$;

-- Exact, current read-model inventory; no ALL TABLES or default privileges.
-- Raw provider payloads, detailed quote evidence and preview fixture/invitation records
-- are deliberately absent. Derived ledgers remain read-only.
do $$ declare relation text; begin
 foreach relation in array array[
  'public.profiles','public.notification_preferences','public.saved_tips','public.personal_entries',
  'private.roles','private.consent_events','private.region_policies','private.bookmaker_eligibility',
  'private.sports','private.competitions','private.events','private.markets','private.selections',
  'private.source_health','private.strategy_versions','private.validation_runs','private.strategy_transitions',
  'private.candidate_decisions','private.tip_publications','private.tip_status_events','private.settlement_events',
  'private.correction_events','private.closing_snapshots','private.availability_observations',
  'private.articles','private.article_revisions','private.schedules','private.outbox','private.delivery_attempts',
  'private.job_runs','private.feature_flags','private.audit_events','private.launch_record','private.unsubscribe_tokens',
  'private.rate_limits','private.analytics_events','private.provider_poll_runs',
  'private.membership_plans','private.plan_prices','private.plan_entitlements','private.member_subscriptions',
  'private.subscription_events','private.commercial_approvals','private.community_competitions',
  'private.competition_rules','private.competition_prizes','private.competition_qualifications',
  'private.competition_rankings','private.prize_award_events','private.community_deals','private.sponsor_campaigns',
  'private.social_profiles','private.social_handle_history','private.social_follows','private.social_blocks',
  'private.social_mutes','private.social_posts','private.social_media','private.social_post_media',
  'private.social_comments','private.social_reactions','private.social_saved','private.social_reports',
  'private.social_moderation_events','private.social_notification_preferences','private.social_notifications',
  'private.social_notification_jobs','private.community_verification_rules','private.community_edges',
  'private.community_edge_status','private.community_result_sources','private.community_settlements',
  'private.community_corrections','private.leaderboard_rule_versions','private.leaderboard_snapshots',
  'private.leaderboard_notification_jobs','private.market_references','private.market_reference_methodologies',
  'private.market_reference_movements','private.community_edge_personal_notes','private.preview_tester_access',
  'private.app_onboarding','private.scanner_schedules','private.scanner_runs','private.scanner_candidates',
  'private.scanner_run_markets','private.scanner_reviews','private.operational_alerts',
  'private.community_recognition_snapshots','private.market_data_config','private.market_data_event_mappings'
 ] loop
  execute format('grant select on %s to docked_app',relation);
  execute format('create policy docked_app_select on %s for select to docked_app using(true)',relation);
 end loop;
end $$;
-- Recognition checks provenance IDs without needing prices or provider payloads.
grant select(id,evidence) on private.odds_snapshots to docked_app;
create policy docked_app_select on private.odds_snapshots for select to docked_app using(true);
-- Admin operational classification counts do not require source payload access.
grant select(classification,created_at) on private.community_quote_evidence to docked_app;
create policy docked_app_select on private.community_quote_evidence for select to docked_app using(true);

-- Supabase Auth tables are owned by supabase_auth_admin. The migration role has
-- SELECT/DELETE but cannot change their policies or delegate DELETE. Private
-- security-barrier views use the existing migration-owner permissions; no Auth
-- table DDL/grants are issued. Only these fixed projection columns are exposed.
-- Minimal embedded Auth schemas omit optional columns. Hosted preflight must
-- confirm all six columns exist; fallback expressions are only test compatibility.
do $$ declare column_name text; expressions text[]:=array[]::text[]; fallback text; begin
 foreach column_name in array array['id','email','email_confirmed_at','is_anonymous','raw_app_meta_data','banned_until'] loop
  if exists(select 1 from pg_attribute where attrelid='auth.users'::regclass and attname=column_name and not attisdropped) then
   expressions:=array_append(expressions,format('u.%I',column_name));
  else
   fallback:=case column_name when 'id' then 'null::uuid' when 'email' then 'null::text' when 'is_anonymous' then 'false' when 'raw_app_meta_data' then '''{}''::jsonb' else 'null::timestamptz' end;
   expressions:=array_append(expressions,format('%s as %I',fallback,column_name));
  end if;
 end loop;
 execute 'create view private.runtime_auth_users with (security_barrier=true) as select '||array_to_string(expressions,',')||' from auth.users u';
end $$;
create view private.runtime_auth_sessions with (security_barrier=true) as select id,user_id,not_after from auth.sessions;
revoke all on private.runtime_auth_users,private.runtime_auth_sessions from public,anon,authenticated;
grant select on private.runtime_auth_users,private.runtime_auth_sessions to docked_app;
grant delete on private.runtime_auth_sessions to docked_app;
-- Do not delegate managed Auth schema permissions. These invoker claim readers
-- read only the same transaction-local verified claims used by existing helpers.
create function private.runtime_uid() returns uuid language sql stable set search_path='' as $$
 select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid
$$;
revoke all on function private.runtime_uid() from public,anon,authenticated;
grant execute on function private.runtime_uid() to docked_app;
-- Only the two existing invoker helpers called by community web reads/writes
-- require direct auth.uid access. Preserve their complete current definitions,
-- replacing that fixed claim-reader reference alone. No authority check is removed.
do $$ declare signature regprocedure; definition text; begin
 foreach signature in array array['private.community_assert_access(uuid,text)'::regprocedure,'private.social_post_visible(uuid,uuid)'::regprocedure] loop
  definition:=pg_get_functiondef(signature);
  if position('auth.uid()' in definition)=0 then raise exception 'Expected community claim reader changed; review migration'; end if;
  definition:=replace(definition,'auth.uid()','private.runtime_uid()');
  if signature='private.community_assert_access(uuid,text)'::regprocedure then
   if position('and length(trim(policy.evidence))>0 and p_feature=any(policy.features) then return; end if;' in definition)=0
   then raise exception 'Expected ordinary-region authorization branch changed; review migration'; end if;
   -- The session may expire while either FOR SHARE lock waits. Recheck using
   -- wall-clock time after those locks, for ordinary approval as well as Preview.
   definition:=replace(definition,'and length(trim(policy.evidence))>0 and p_feature=any(policy.features) then return; end if;',
     'and length(trim(policy.evidence))>0 and p_feature=any(policy.features) and private.active_member_session() then return; end if;');
  end if;
  execute definition;
 end loop;
end $$;

-- Preserve existing invoker erasure semantics. Session revocation goes through
-- the restricted updatable view, not a grant on the managed Auth table.
create or replace function private.disable_account(p_user uuid) returns void language plpgsql set search_path='' as $$
begin
 update public.profiles set disabled_at=coalesce(disabled_at,clock_timestamp()) where id=p_user;
 if not found then return; end if;
 update public.notification_preferences set paused=true,digest='off',edge_alerts=false,education=false,updated_at=now() where user_id=p_user;
 update private.outbox set state='suppressed',user_id=null,payload='{}',dedupe_key='erased:'||id::text,last_error='Account erased',lease_token=null,lease_until=null where user_id=p_user;
 update private.delivery_attempts set user_id=null,provider_id=null where user_id=p_user;
 delete from private.analytics_events where user_id=p_user;
 delete from private.unsubscribe_tokens where user_id=p_user;
 delete from public.saved_tips where user_id=p_user;
 delete from public.personal_entries where user_id=p_user;
 delete from private.runtime_auth_sessions where user_id=p_user;
 insert into private.job_runs(dedupe_key,kind,payload) values('account-deletion:'||p_user::text,'account_deletion',jsonb_build_object('userId',p_user)) on conflict do nothing;
 insert into private.audit_events(actor,action,subject) values('account-service','account_access_revoked',p_user::text);
end $$;

-- Reversible member/community state. Immutable trigger-protected identities and
-- posts receive no DELETE privilege. Browsers receive no additional grants.
do $$ declare relation text; begin
 foreach relation in array array[
  'public.profiles','private.social_follows','private.social_notification_preferences','private.social_notification_jobs'
 ] loop
  execute format('grant insert,update,delete on %s to docked_app',relation);
  execute format('create policy docked_app_insert on %s for insert to docked_app with check(true)',relation);
  execute format('create policy docked_app_update on %s for update to docked_app using(true) with check(true)',relation);
  execute format('create policy docked_app_delete on %s for delete to docked_app using(true)',relation);
 end loop;
 foreach relation in array array['public.notification_preferences','private.social_profiles','private.social_media','private.social_comments','private.social_reports','private.app_onboarding','private.rate_limits'] loop
  execute format('grant insert,update on %s to docked_app',relation);
  execute format('create policy docked_app_insert on %s for insert to docked_app with check(true)',relation);
  execute format('create policy docked_app_update on %s for update to docked_app using(true) with check(true)',relation);
 end loop;
 foreach relation in array array['public.saved_tips','public.personal_entries','private.social_handle_history','private.social_blocks','private.social_mutes','private.social_post_media','private.social_reactions','private.social_saved'] loop
  execute format('grant insert,delete on %s to docked_app',relation);
  execute format('create policy docked_app_insert on %s for insert to docked_app with check(true)',relation);
  execute format('create policy docked_app_delete on %s for delete to docked_app using(true)',relation);
 end loop;
 foreach relation in array array['private.audit_events','private.consent_events','private.social_moderation_events','private.analytics_events'] loop
  execute format('grant insert on %s to docked_app',relation);
  execute format('create policy docked_app_insert on %s for insert to docked_app with check(true)',relation);
 end loop;
end $$;
grant delete on private.analytics_events,private.unsubscribe_tokens,private.community_edge_personal_notes to docked_app;
create policy docked_app_delete on private.analytics_events for delete to docked_app using(true);
create policy docked_app_delete on private.unsubscribe_tokens for delete to docked_app using(true);
create policy docked_app_delete on private.community_edge_personal_notes for delete to docked_app using(true);

grant insert,update on private.social_posts to docked_app;
create policy docked_app_insert on private.social_posts for insert to docked_app with check(
 kind in('discussion','analysis','question','celebration') and official_tip_id is null and community_edge_id is null
 and author_id<>'00000000-0000-4000-8000-000000000001'::uuid);
create policy docked_app_update on private.social_posts for update to docked_app using(
 kind in('discussion','analysis','question','celebration') and official_tip_id is null and community_edge_id is null)
 with check(kind in('discussion','analysis','question','celebration') and official_tip_id is null and community_edge_id is null);
grant insert,update,delete on private.social_notifications to docked_app;
create policy docked_app_insert on private.social_notifications for insert to docked_app with check(type in('followed_post','comment','reply','reaction','follower','account','system'));
create policy docked_app_update on private.social_notifications for update to docked_app using(true) with check(true);
create policy docked_app_delete on private.social_notifications for delete to docked_app using(true);

-- Account-service queues only; no provider/scanner/publication jobs or deliveries.
grant insert,update on private.job_runs to docked_app;
create policy docked_app_insert on private.job_runs for insert to docked_app with check(kind='account_deletion');
create policy docked_app_update on private.job_runs for update to docked_app using(kind='account_deletion') with check(kind='account_deletion');
grant insert,update on private.outbox to docked_app;
create policy docked_app_insert on private.outbox for insert to docked_app with check(kind in('service','education') and state='queued');
create policy docked_app_update on private.outbox for update to docked_app using(true) with check(state in('suppressed','dead'));
grant update(user_id,provider_id) on private.delivery_attempts to docked_app;
create policy docked_app_update on private.delivery_attempts for update to docked_app using(true) with check(user_id is null and provider_id is null);

grant execute on function private.active_member_session(),private.disable_account(uuid),
 private.community_assert_access(uuid,text),private.community_actor(uuid,text,boolean),
 private.community_feature_allowed(uuid,text),private.community_post_allowed(uuid,uuid),
 private.social_profile_visible(uuid,uuid,boolean),private.social_post_visible(uuid,uuid),
 private.preview_tester_policy(uuid,text),private.publication_region_matches(uuid,uuid) to docked_app;

-- PostgreSQL row-locking SELECT requires UPDATE privilege. These identity-only
-- grants allow existing FOR SHARE authorization locks; WITH CHECK(false) denies
-- every actual UPDATE, including id=id. They cannot approve or edit a policy.
grant update(id) on private.region_policies,private.preview_tester_access to docked_app;
create policy docked_app_lock on private.region_policies for update to docked_app using(true) with check(false);
create policy docked_app_lock on private.preview_tester_access for update to docked_app using(true) with check(false);

-- Future schemas/tables/functions stay inaccessible unless a reviewed migration
-- enumerates them. Fail rather than silently inheriting permanent DDL authority.
do $$ begin
 if has_schema_privilege('docked_app','public','CREATE') or has_schema_privilege('docked_app','private','CREATE')
 or has_schema_privilege('docked_app','auth','CREATE') or exists(select 1 from pg_auth_members where member=(select oid from pg_roles where rolname='docked_app'))
 then raise exception 'docked_app inherited unexpected creation or role authority'; end if;
end $$;
