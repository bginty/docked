-- Production email only. This migration does not install extensions, copy a
-- secret, create a cron job or enable sending. Activation is a separate gate.
-- Preserve the reviewed queue state machine behind a bounded admission wrapper.
alter function public.docked_mail_queue(text,jsonb) set schema private;
alter function private.docked_mail_queue(text,jsonb) rename to docked_mail_queue_core;
revoke all on function private.docked_mail_queue_core(text,jsonb) from public,anon,authenticated,service_role;
create function public.docked_mail_queue(p_action text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare pending_count integer; new_count integer;
begin
  if p_action='enqueue' then
    if jsonb_typeof(p_data->'jobs') is distinct from 'array' or jsonb_array_length(p_data->'jobs') not between 1 and 2 then raise exception 'Invalid mail batch'; end if;
    perform pg_advisory_xact_lock(1836018034,1);
    select count(*) into pending_count from private.docked_auth_mail_outbox
      where state in ('pending','authorizing','dispatching') and expires_at>clock_timestamp();
    select count(distinct j->>'id') into new_count from jsonb_array_elements(p_data->'jobs') j
      where not exists(select 1 from private.docked_auth_mail_outbox o where o.id=j->>'id');
    -- Four jobs/minute can clear a full healthy queue in eight minutes, within
    -- the existing fifteen-minute token-envelope TTL. Outages still fail closed.
    if pending_count+new_count>32 then raise exception 'Authentication mail capacity unavailable'; end if;
  end if;
  return private.docked_mail_queue_core(p_action,p_data);
end $$;
revoke all on function public.docked_mail_queue(text,jsonb) from public,anon,authenticated;
grant execute on function public.docked_mail_queue(text,jsonb) to service_role;

create table private.docked_mail_scheduler (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  project_ref text not null default 'pojoymtniryarxxunyvz' check (project_ref='pojoymtniryarxxunyvz'),
  last_tick_at timestamptz,
  last_request_at timestamptz,
  last_request_id bigint,
  last_error_code text check (last_error_code is null or last_error_code='scheduler_unavailable')
);
insert into private.docked_mail_scheduler(singleton) values(true);
alter table private.docked_mail_scheduler enable row level security;
revoke all on private.docked_mail_scheduler from public,anon,authenticated,service_role;

-- SECURITY INVOKER: only the migration owner / approved database administrator
-- can run this private scheduler; it is not a Data API endpoint.
create function private.docked_mail_tick() returns bigint
language plpgsql security invoker set search_path='' as $$
declare settings private.docked_mail_scheduler; signing_secret text;
  message_id text; stamp text; signature text; request_id bigint;
  body jsonb := '{"mode":"production","control":"drain"}'::jsonb;
begin
  select * into strict settings from private.docked_mail_scheduler where singleton for update;
  update private.docked_mail_scheduler set last_tick_at=clock_timestamp() where singleton;
  -- Cleanup remains safe when sending is disabled. Receipts/events are retained;
  -- only expired/terminal encrypted envelopes are erased by the reviewed RPC.
  perform public.docked_mail_queue('status','{"mode":"production"}'::jsonb);
  perform public.docked_mail_queue('status','{"mode":"controlled"}'::jsonb);
  if not settings.enabled then return null; end if;
  if settings.last_request_at>clock_timestamp()-interval '45 seconds' then return null; end if;
  if not exists(select 1 from private.docked_auth_mail_outbox
    where mode='production' and expires_at>clock_timestamp() and attempts<3
      and available_at<=clock_timestamp()
      and (state='pending' or (state='authorizing' and lease_until<clock_timestamp()))) then return null; end if;
  -- pg_net serializes a jsonb body using its text representation. Sign exactly
  -- that representation, including spaces, as required by Standard Webhooks.
  -- The Vault entry must be a secure copy of the existing hook secret, not a new key.
  begin
  select decrypted_secret into strict signing_secret from vault.decrypted_secrets
    where name='docked_auth_email_hook_existing';
  if signing_secret !~ '^v1,whsec_[A-Za-z0-9+/=]+$' then raise exception 'Mail scheduler signing configuration unavailable'; end if;
  if octet_length(decode(substring(signing_secret from 10),'base64'))<32 then raise exception 'Mail scheduler signing configuration unavailable'; end if;
  message_id:=gen_random_uuid()::text;
  stamp:=floor(extract(epoch from clock_timestamp()))::bigint::text;
  signature:='v1,' || encode(extensions.hmac(
    convert_to(message_id||'.'||stamp||'.'||body::text,'UTF8'),
    decode(substring(signing_secret from 10),'base64'),'sha256'),'base64');
  select net.http_post(
    url:='https://pojoymtniryarxxunyvz.supabase.co/functions/v1/docked-auth-email/worker',
    body:=body,
    headers:=jsonb_build_object('Content-Type','application/json','webhook-id',message_id,
      'webhook-timestamp',stamp,'webhook-signature',signature),
    timeout_milliseconds:=40000
  ) into request_id;
  update private.docked_mail_scheduler set last_request_at=clock_timestamp(),last_request_id=request_id,last_error_code=null where singleton;
  return request_id;
  exception when others then
    -- Keep the completed cleanup even when an extension/Vault/network enqueue
    -- fails. Never persist provider errors or credential-bearing SQL details.
    update private.docked_mail_scheduler set last_error_code='scheduler_unavailable' where singleton;
    return null;
  end;
end $$;
revoke all on function private.docked_mail_tick() from public,anon,authenticated,service_role;

create function private.docked_mail_health() returns jsonb
language sql security invoker set search_path='' as $$
  select jsonb_build_object(
    'enabled',s.enabled,'last_tick_at',s.last_tick_at,'last_request_at',s.last_request_at,'last_error_code',s.last_error_code,
    'stale_tick',s.last_tick_at is null or s.last_tick_at<clock_timestamp()-interval '3 minutes',
    'unknown',(select count(*) from private.docked_auth_mail_outbox where state='unknown'),
    'failed',(select count(*) from private.docked_auth_mail_outbox where state='failed'),
    'expired',(select count(*) from private.docked_auth_mail_outbox where state='expired'),
    'pending',(select count(*) from private.docked_auth_mail_outbox where state in ('pending','authorizing','dispatching')),
    'oldest_pending_seconds',(select extract(epoch from clock_timestamp()-min(created_at)) from private.docked_auth_mail_outbox where state in ('pending','authorizing','dispatching'))
  ) from private.docked_mail_scheduler s where singleton
$$;
revoke all on function private.docked_mail_health() from public,anon,authenticated,service_role;
