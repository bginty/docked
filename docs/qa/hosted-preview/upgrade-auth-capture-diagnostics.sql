-- Preview-only function upgrade; root verifies target and applies. No capture payloads selected.
begin;
do $$begin if current_setting('docked.preview_project_ref',true) is distinct from 'bckkllmndoxzpzdqrevb' then raise exception 'Preview installation acknowledgement required'; end if; end $$;
create or replace function preview_auth.capture_email(event jsonb) returns jsonb
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
revoke all on function preview_auth.capture_email(jsonb) from public,anon,authenticated,service_role,supabase_auth_admin;
grant execute on function preview_auth.capture_email(jsonb) to supabase_auth_admin;
-- Changing the function invalidates any previously recorded proof. A fresh real canary is required.
update preview_auth.configuration set hook_verified_at=null,hook_verified_event_id=null,hook_function_sha256=null where singleton;
commit;
