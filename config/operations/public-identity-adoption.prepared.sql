-- PROPOSAL ONLY: never run without the separately approved public-runtime package.
-- The reviewed operator must set the fresh source SHA and approval reference in
-- this connection after backup/restore/drift checks. No implicit execution mode.
begin;
set local lock_timeout='3s';
set local statement_timeout='20s';
lock beta_public.profiles,beta_private.roles,beta_private.consent_events,beta_public.notification_preferences in share mode;
lock public.profiles,private.roles,private.consent_events,public.notification_preferences in share row exclusive mode;
create temporary table public_launch_identity_source(kind text,key text,document jsonb,primary key(kind,key)) on commit drop;
insert into public_launch_identity_source select 'profile',id::text,to_jsonb(p) from beta_public.profiles p;
insert into public_launch_identity_source select 'role',user_id::text,to_jsonb(p) from beta_private.roles p;
insert into public_launch_identity_source select 'consent',id::text,to_jsonb(p) from beta_private.consent_events p;
insert into public_launch_identity_source select 'notification',user_id::text,to_jsonb(p) from beta_public.notification_preferences p;
do $$declare actual text;begin
 if coalesce(current_setting('docked.public_adoption_approval',true),'') !~ '^[a-f0-9]{64}$' then raise exception 'Exact approved package reference required';end if;
 select encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(s) order by kind,key),'[]'::jsonb)::text,'UTF8')),'hex') into actual from public_launch_identity_source s;
 if actual is distinct from current_setting('docked.public_adoption_source_sha256',true) then raise exception 'Fresh identity source drift';end if;
 if (select count(*) from public_launch_identity_source where kind='profile')<>6
 or (select count(*) from public_launch_identity_source where kind='role')<>2
 or exists(select 1 from public_launch_identity_source where kind='role' and document->>'role' not in('owner','admin'))
 then raise exception 'Reviewed account/privilege scope changed';end if;
 if exists(select 1 from public.profiles) or exists(select 1 from private.roles)
 or exists(select 1 from private.consent_events) or exists(select 1 from public.notification_preferences)
 then raise exception 'Destination already populated: review, never overwrite or repeat';end if;
 if exists(select 1 from private.feature_flags where key='registration' and enabled)
 or exists(select 1 from commercial_billing.control where sales_enabled or issuance_enabled or transfers_enabled or gameplay_enabled)
 then raise exception 'All public/commercial gates must remain closed';end if;
end $$;
insert into public.profiles select (jsonb_populate_record(null::public.profiles,document)).* from public_launch_identity_source where kind='profile';
insert into private.roles select (jsonb_populate_record(null::private.roles,document)).* from public_launch_identity_source where kind='role';
insert into private.consent_events select (jsonb_populate_record(null::private.consent_events,document)).* from public_launch_identity_source where kind='consent';
insert into public.notification_preferences select (jsonb_populate_record(null::public.notification_preferences,document)).* from public_launch_identity_source where kind='notification';
-- Preserve original consent IDs, versions, actors and times. New commercial
-- notices still need the member's own consent; never mark old acceptance current.
do $$begin
 if exists(select kind,key,document from public_launch_identity_source except
  (select 'profile',id::text,to_jsonb(p) from public.profiles p union all
   select 'role',user_id::text,to_jsonb(p) from private.roles p union all
   select 'consent',id::text,to_jsonb(p) from private.consent_events p union all
   select 'notification',user_id::text,to_jsonb(p) from public.notification_preferences p))
 then raise exception 'Identity copy mismatch';end if;
end $$;
insert into private.audit_events(actor,action,subject,details) values('reviewed-release-operator','beta_identity_preserved','public-runtime',jsonb_build_object('sourceSha256',current_setting('docked.public_adoption_source_sha256'),'approvalPackage',current_setting('docked.public_adoption_approval'),'profiles',6,'existingRoles',2,'newConsentRecorded',false,'walletsCopied',false));
commit;
-- Beta data, Auth IDs/passwords/MFA/phones, balances, cards, custody, serials and
-- entitlements are untouched. No US commercial eligibility or public access is
-- granted; Brenton's country and all disabled states are retained verbatim.
