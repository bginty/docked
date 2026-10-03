-- Read-only assertion results; this never selects token_hash/OTP/payload values.
begin transaction read only;
select project_ref,site_url,enabled,expires_at>clock_timestamp() as configuration_current,
 hook_verified_at is not null as verification_recorded,
 hook_function_sha256=encode(sha256(convert_to(pg_get_functiondef('preview_auth.capture_email(jsonb)'::regprocedure),'UTF8')),'hex') as verified_function_unchanged
from preview_auth.configuration;
select count(*)=4 and bool_and(c.relrowsecurity) as all_capture_tables_have_rls
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='preview_auth' and c.relkind='r';
select r.rolname,
 not has_schema_privilege(r.oid,'preview_auth','USAGE') as schema_denied,
 not has_table_privilege(r.oid,'preview_auth.captured_mail','SELECT') as read_denied,
 not has_table_privilege(r.oid,'preview_auth.captured_mail','INSERT') as write_denied,
 not has_function_privilege(r.oid,'preview_auth.capture_email(jsonb)','EXECUTE') as hook_denied
from pg_roles r where r.rolname in ('anon','authenticated','service_role');
select has_schema_privilege('supabase_auth_admin','preview_auth','USAGE') as hook_schema,
 has_function_privilege('supabase_auth_admin','preview_auth.capture_email(jsonb)','EXECUTE') as hook_execute,
 has_table_privilege('supabase_auth_admin','preview_auth.captured_mail','INSERT') as capture_insert,
 not has_table_privilege('supabase_auth_admin','preview_auth.captured_mail','SELECT') as capture_read_denied,
 not has_table_privilege('supabase_auth_admin','preview_auth.captured_mail','UPDATE') as capture_update_denied,
 not has_table_privilege('supabase_auth_admin','preview_auth.captured_mail','DELETE') as capture_delete_denied;
select p.proname,not p.prosecdef as security_invoker,p.proconfig
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='preview_auth';
select count(*) as expired_rows_requiring_purge from preview_auth.captured_mail where expires_at<=clock_timestamp();
select not exists(select 1 from information_schema.columns where table_schema='preview_auth' and table_name='captured_mail' and column_name in ('token','otp','payload')) as no_raw_otp_or_payload_column;
rollback;
