-- READ-ONLY catalog checks. Run only after the caller independently verifies
-- Docked Preview's project ref, organisation and database endpoint.
-- current_database() is normally "postgres" and cannot establish project identity.
-- This file neither creates Auth fixtures nor changes claims, roles or settings.
begin transaction read only;

select current_database() as database_name,current_user as connection_role,
       current_setting('server_version') as server_version,
       current_setting('server_encoding') as server_encoding,
       current_setting('default_table_access_method') as table_access_method;
select ssl,version as tls_version,cipher from pg_stat_ssl where pid=pg_backend_pid();

-- All required managed Auth columns must be present. Do not recreate auth tables.
with required(table_name,column_name) as (values
 ('users','id'),('users','email_confirmed_at'),('users','is_anonymous'),
 ('sessions','id'),('sessions','user_id'),('sessions','not_after'))
select r.table_name,r.column_name,c.data_type,c.column_name is not null as present
from required r left join information_schema.columns c
 on c.table_schema='auth' and c.table_name=r.table_name and c.column_name=r.column_name
order by r.table_name,r.column_name;
select to_regprocedure('auth.uid()') is not null as auth_uid_present,
       to_regprocedure('auth.jwt()') is not null as auth_jwt_present,
       to_regprocedure('pg_catalog.gen_random_uuid()') is not null as uuid_present,
       normalize('Docked',NFKD)='Docked' as unicode_normalization_available;
select has_table_privilege(current_user,'auth.sessions','SELECT') as server_can_check_sessions,
       has_table_privilege(current_user,'auth.sessions','DELETE') as server_can_revoke_sessions,
       has_table_privilege(current_user,'auth.users','SELECT') as server_can_check_verified_users;

-- Application policies rely on browser roles not bypassing RLS.
select rolname,rolsuper,rolbypassrls,rolcanlogin from pg_roles
where rolname in ('anon','authenticated','service_role','postgres') order by rolname;
select r.rolname,n.nspname,has_schema_privilege(r.oid,n.oid,'USAGE') as can_use,
       has_schema_privilege(r.oid,n.oid,'CREATE') as can_create
from pg_roles r cross join pg_namespace n
where r.rolname in ('anon','authenticated') and n.nspname='private';

-- After migration: zero rows. Before migration: absent tables are not a pass.
select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
where c.relkind in ('r','p') and (n.nspname='private' or
 (n.nspname='public' and c.relname in ('profiles','notification_preferences','saved_tips','personal_entries')))
and not c.relrowsecurity order by n.nspname,c.relname;
select n.nspname,count(*) as table_count,count(*) filter(where c.relrowsecurity) as rls_enabled
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where c.relkind in ('r','p') and (n.nspname='private' or
 (n.nspname='public' and c.relname in ('profiles','notification_preferences','saved_tips','personal_entries')))
group by n.nspname order by n.nspname;

-- Zero rows: no browser role has any private table privilege, including inherited grants.
select r.rolname,c.relname,v.privilege
from pg_roles r cross join pg_class c join pg_namespace n on n.oid=c.relnamespace
cross join (values('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) v(privilege)
where r.rolname in ('anon','authenticated') and n.nspname='private' and c.relkind in ('r','p')
and has_table_privilege(r.oid,c.oid,v.privilege)
order by r.rolname,c.relname,v.privilege;

-- Exactly four rows: authenticated SELECT only. No anon or browser writes.
select r.rolname,c.relname,v.privilege
from pg_roles r cross join pg_class c join pg_namespace n on n.oid=c.relnamespace
cross join (values('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) v(privilege)
where r.rolname in ('anon','authenticated') and n.nspname='public'
and c.relname in ('profiles','notification_preferences','saved_tips','personal_entries')
and has_table_privilege(r.oid,c.oid,v.privilege)
order by r.rolname,c.relname,v.privilege;

-- Exactly one authenticated EXECUTE: private.active_member_session(). No anon EXECUTE.
select r.rolname,p.proname,pg_get_function_identity_arguments(p.oid) as arguments
from pg_roles r cross join pg_proc p join pg_namespace n on n.oid=p.pronamespace
where r.rolname in ('anon','authenticated') and n.nspname='private'
and has_function_privilege(r.oid,p.oid,'EXECUTE') order by r.rolname,p.proname;
-- Exactly one definer, active_member_session, with a fixed empty search_path.
select p.proname,pg_get_userbyid(p.proowner) as owner,p.prosecdef,p.proconfig
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='private' and p.prosecdef;

-- Review actual policies rather than assuming the grant list proves row isolation.
select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies
where schemaname='public' and tablename in ('profiles','notification_preferences','saved_tips','personal_entries')
order by tablename,policyname;

-- Critical trigger installation. Presence proves installation, not execution acceptance.
select n.nspname,c.relname,t.tgname,t.tgenabled,p.proname as function_name
from pg_trigger t join pg_class c on c.oid=t.tgrelid
join pg_namespace n on n.oid=c.relnamespace join pg_proc p on p.oid=t.tgfoid
where not t.tgisinternal and ((n.nspname='private' and c.relname in
 ('tip_publications','settlement_events','correction_events','strategy_versions','candidate_decisions',
  'community_edges','community_quote_evidence','community_settlements','community_corrections',
  'social_profiles','social_posts','social_post_media','social_notification_jobs','leaderboard_snapshots'))
 or (n.nspname='public' and c.relname='profiles'))
order by n.nspname,c.relname,t.tgname;

-- Migration history existence only; inspect ordered version rows separately after applying.
select to_regclass('supabase_migrations.schema_migrations') is not null as migration_history_present;
select pg_get_userbyid(d.defaclrole) as owner,n.nspname,d.defaclobjtype,d.defaclacl
from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace
where n.nspname='private' or (d.defaclnamespace=0 and pg_get_userbyid(d.defaclrole)=current_user)
order by owner,d.defaclobjtype;
select p.proname,p.proacl from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='private' and p.proname='active_member_session';
rollback;
