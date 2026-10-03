-- Reviewed preview-only setup, NOT a production migration.
-- Sole permitted target: Docked Preview bckkllmndoxzpzdqrevb.
-- Caller must independently verify project identity, then set this connection's
-- docked.preview_project_ref to that exact ref before running this file.
-- No signup/send hook is enabled by this script. Configuration starts disabled.
begin;
do $$ begin
 if current_setting('docked.preview_project_ref',true) is distinct from 'bckkllmndoxzpzdqrevb' then
  raise exception 'Verified Docked Preview installation acknowledgement required';
 end if;
 if to_regnamespace('preview_auth') is not null then
  raise exception 'Preview capture schema already exists; inspect rather than overwrite';
 end if;
end $$;

create schema preview_auth;
revoke all on schema preview_auth from public,anon,authenticated,service_role;
alter default privileges in schema preview_auth revoke all on tables from public,anon,authenticated,service_role;
alter default privileges in schema preview_auth revoke execute on functions from public,anon,authenticated,service_role;

create table preview_auth.configuration (
 singleton boolean primary key default true check(singleton),
 project_ref text not null check(project_ref='bckkllmndoxzpzdqrevb'),
 site_url text not null check(site_url='http://localhost:3000'),
 enabled boolean not null default false,
 configured_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null default clock_timestamp(),
 hook_verified_at timestamptz,
 hook_verified_event_id uuid,
 hook_function_sha256 text check(hook_function_sha256 is null or hook_function_sha256 ~ '^[a-f0-9]{64}$'),
 check(expires_at<=configured_at+interval '24 hours')
);
insert into preview_auth.configuration(project_ref,site_url)
 values('bckkllmndoxzpzdqrevb','http://localhost:3000');

create table preview_auth.allowed_recipients (
 email text primary key check(email ~ '^docked-preview-[a-z0-9][a-z0-9-]{0,63}@example[.]invalid$'),
 approved_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null,
 revoked_at timestamptz,
 check(expires_at>approved_at and expires_at<=approved_at+interval '24 hours')
);
create table preview_auth.allowed_redirects (
 url text primary key check(url in ('http://localhost:3000/auth/callback','http://localhost:3000/auth/callback?next=/reset-password'))
);
insert into preview_auth.allowed_redirects(url) values
 ('http://localhost:3000/auth/callback'),('http://localhost:3000/auth/callback?next=/reset-password');

create table preview_auth.captured_mail (
 id uuid primary key default gen_random_uuid(),
 email text not null references preview_auth.allowed_recipients(email),
 auth_user_id uuid not null,
 action text not null check(action in ('signup','recovery')),
 token_hash text not null check(token_hash ~ '^(pkce_)?[a-f0-9]+$'
  and length(regexp_replace(token_hash,'^pkce_','')) between 40 and 256),
 redirect_to text not null references preview_auth.allowed_redirects(url),
 received_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null,
 check(expires_at>received_at and expires_at<=received_at+interval '30 minutes'),
 unique(email,action,token_hash)
);
create index on preview_auth.captured_mail(expires_at);

alter table preview_auth.configuration enable row level security;
alter table preview_auth.allowed_recipients enable row level security;
alter table preview_auth.allowed_redirects enable row level security;
alter table preview_auth.captured_mail enable row level security;
create policy hook_configuration on preview_auth.configuration for select to supabase_auth_admin using(true);
create policy hook_recipients on preview_auth.allowed_recipients for select to supabase_auth_admin using(true);
create policy hook_redirects on preview_auth.allowed_redirects for select to supabase_auth_admin using(true);
create policy hook_capture on preview_auth.captured_mail for insert to supabase_auth_admin with check (
 exists(select 1 from preview_auth.configuration c where c.singleton and c.enabled and c.project_ref='bckkllmndoxzpzdqrevb' and c.expires_at>clock_timestamp() and captured_mail.expires_at<=c.expires_at)
 and exists(select 1 from preview_auth.allowed_recipients a where a.email=captured_mail.email and a.revoked_at is null and a.expires_at>clock_timestamp() and captured_mail.expires_at<=a.expires_at)
 and exists(select 1 from preview_auth.allowed_redirects r where r.url=captured_mail.redirect_to)
);

create function preview_auth.capture_email(event jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare recipient text; action_name text; target text; secret_hash text; denied_field text;
        user_id uuid; deadline timestamptz; received timestamptz=clock_timestamp();
begin
 if current_user<>'supabase_auth_admin' then
  return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Preview capture caller denied'));
 end if;
 if octet_length(event::text)>32768 then
  return jsonb_build_object('error',jsonb_build_object('http_code',400,'message','Preview capture payload rejected'));
 end if;
 recipient=lower(event->'user'->>'email');
 action_name=event->'email_data'->>'email_action_type';
 target=event->'email_data'->>'redirect_to';
 secret_hash=event->'email_data'->>'token_hash';
 if recipient is null or recipient !~ '^docked-preview-[a-z0-9][a-z0-9-]{0,63}@example[.]invalid$' then denied_field='recipient';
 elsif action_name is null or action_name not in ('signup','recovery') then denied_field='action';
 elsif coalesce(event->'user'->>'new_email','')<>'' then denied_field='email_change';
 -- GoTrue's hook field is its external Auth URL, not the application's SITE_URL.
 elsif (event->'email_data'->>'site_url') is distinct from 'https://bckkllmndoxzpzdqrevb.supabase.co/auth/v1' then denied_field='site_url';
 elsif target is null or not exists(select 1 from preview_auth.allowed_redirects where url=target) then denied_field='redirect';
 elsif secret_hash is null or secret_hash !~ '^(pkce_)?[a-f0-9]+$'
  or length(regexp_replace(secret_hash,'^pkce_','')) not between 40 and 256 then denied_field='token_hash_format';
 elsif coalesce(event->'user'->>'id','') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then denied_field='user_id';
 end if;
 if denied_field is not null then
  -- Static field identifiers only: no payload values, addresses or credential fragments.
  return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Preview capture request denied: '||denied_field));
 end if;
 user_id=(event->'user'->>'id')::uuid;
 select least(a.expires_at,c.expires_at,received+interval '30 minutes') into deadline
 from preview_auth.allowed_recipients a cross join preview_auth.configuration c
 where a.email=recipient and a.revoked_at is null and a.expires_at>received
  and c.singleton and c.enabled and c.expires_at>received and c.project_ref='bckkllmndoxzpzdqrevb';
 if deadline is null then
  return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Preview capture allowlist inactive'));
 end if;
 insert into preview_auth.captured_mail(email,auth_user_id,action,token_hash,redirect_to,received_at,expires_at)
 values(recipient,user_id,action_name,secret_hash,target,received,deadline) on conflict do nothing;
 -- Do not return tokens or payloads to Auth responses or logs. No network function exists here.
 return '{}'::jsonb;
end $$;

-- Owner/controlled acceptance runner only. Run periodically and in test teardown.
create function preview_auth.purge_expired() returns integer
language plpgsql security invoker set search_path='' as $$
declare removed integer;
begin
 delete from preview_auth.captured_mail m where m.expires_at<=clock_timestamp()
  or not exists(select 1 from preview_auth.allowed_recipients a where a.email=m.email and a.revoked_at is null and a.expires_at>clock_timestamp())
  or not exists(select 1 from preview_auth.configuration c where c.singleton and c.enabled and c.expires_at>clock_timestamp());
 get diagnostics removed=row_count;
 delete from preview_auth.allowed_recipients a where (a.expires_at<=clock_timestamp() or a.revoked_at is not null)
  and not exists(select 1 from preview_auth.captured_mail m where m.email=a.email);
 return removed;
end $$;

revoke all on all tables in schema preview_auth from public,anon,authenticated,service_role,supabase_auth_admin;
revoke all on all functions in schema preview_auth from public,anon,authenticated,service_role,supabase_auth_admin;
grant usage on schema preview_auth to supabase_auth_admin;
grant select on preview_auth.configuration,preview_auth.allowed_recipients,preview_auth.allowed_redirects to supabase_auth_admin;
grant insert on preview_auth.captured_mail to supabase_auth_admin;
grant execute on function preview_auth.capture_email(jsonb) to supabase_auth_admin;
commit;
