-- Dedicated production email only. Do not apply this directory to Preview.
create schema if not exists private;
create table private.docked_auth_mail_outbox (
  id text primary key check (id ~ '^[a-f0-9]{64}$'),
  fingerprint text not null check (fingerprint ~ '^[a-f0-9]{64}$'),
  mode text not null check (mode in ('controlled','production')),
  envelope jsonb,
  state text not null default 'pending' check (state in ('pending','authorizing','dispatching','accepted','unknown','failed','expired')),
  attempts integer not null default 0 check (attempts between 0 and 3),
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default clock_timestamp() + interval '15 minutes',
  available_at timestamptz not null default clock_timestamp(),
  worker uuid, lease_until timestamptz, dispatched_at timestamptz,
  last_code text,
  check ((state in ('pending','authorizing','dispatching')) = (envelope is not null))
);
create index docked_auth_mail_ready on private.docked_auth_mail_outbox(mode,state,available_at);
create table private.docked_auth_mail_events (
  sequence bigint generated always as identity primary key,
  job_id text not null references private.docked_auth_mail_outbox(id),
  phase text not null,
  code text,
  occurred_at timestamptz not null default clock_timestamp()
);
alter table private.docked_auth_mail_outbox enable row level security;
alter table private.docked_auth_mail_events enable row level security;
revoke all on private.docked_auth_mail_outbox,private.docked_auth_mail_events from public,anon,authenticated,service_role;

create function public.docked_mail_queue(p_action text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare j jsonb; r private.docked_auth_mail_outbox; result jsonb := '[]'::jsonb;
  target_mode text := p_data->>'mode'; target_worker uuid; next_state text; code text;
begin
  if target_mode is null or target_mode not in ('controlled','production') then raise exception 'Invalid mail mode'; end if;
  if p_action='enqueue' then
    if jsonb_typeof(p_data->'jobs') is distinct from 'array' or jsonb_array_length(p_data->'jobs') not between 1 and 2 then raise exception 'Invalid mail batch'; end if;
    for j in select value from jsonb_array_elements(p_data->'jobs') loop
      if jsonb_typeof(j->'envelope') is distinct from 'object' or octet_length((j->'envelope')::text)>32768 then raise exception 'Invalid mail envelope'; end if;
      insert into private.docked_auth_mail_outbox(id,fingerprint,mode,envelope)
        values(j->>'id',j->>'fingerprint',target_mode,j->'envelope') on conflict(id) do nothing;
      select * into strict r from private.docked_auth_mail_outbox where id=j->>'id' for update;
      if r.fingerprint is distinct from j->>'fingerprint' or r.mode<>target_mode then raise exception 'Mail idempotency conflict'; end if;
      result := result || jsonb_build_array(jsonb_build_object('id',r.id,'state',r.state));
    end loop;
    return result;
  elsif p_action in ('claim','status') then
    -- A crash after dispatch is ambiguous and NEVER automatically sent again.
    with changed as (
      update private.docked_auth_mail_outbox set state='unknown',envelope=null,last_code='dispatch_lease_expired'
      where mode=target_mode and state='dispatching' and lease_until<clock_timestamp()
      returning id
    ) insert into private.docked_auth_mail_events(job_id,phase,code) select id,'unknown','dispatch_lease_expired' from changed;
    with changed as (
      update private.docked_auth_mail_outbox set state='expired',envelope=null,last_code='expired'
      where mode=target_mode and state in ('pending','authorizing') and expires_at<=clock_timestamp()
      returning id
    ) insert into private.docked_auth_mail_events(job_id,phase,code) select id,'expired','expired' from changed;
    if p_action='status' then
      select * into r from private.docked_auth_mail_outbox where id=p_data->>'id' and mode=target_mode;
      if not found then return null; end if;
      return jsonb_build_object('id',r.id,'state',r.state,'attempts',r.attempts,'code',r.last_code,'dispatched_at',r.dispatched_at,
        'events',(select coalesce(jsonb_agg(jsonb_build_object('phase',e.phase,'code',e.code,'at',e.occurred_at) order by e.sequence),'[]'::jsonb) from private.docked_auth_mail_events e where e.job_id=r.id));
    end if;
    target_worker := (p_data->>'worker')::uuid;
    if target_worker is null then raise exception 'Worker required'; end if;
    select * into r from private.docked_auth_mail_outbox
      where mode=target_mode and (p_data->>'id' is null or id=p_data->>'id')
      and expires_at>clock_timestamp() and attempts<3 and available_at<=clock_timestamp()
      and (state='pending' or (state='authorizing' and lease_until<clock_timestamp()))
      order by created_at for update skip locked limit 1;
    if not found then return null; end if;
    update private.docked_auth_mail_outbox set state='authorizing',attempts=attempts+1,worker=target_worker,lease_until=clock_timestamp()+interval '90 seconds'
      where id=r.id returning * into r;
    insert into private.docked_auth_mail_events(job_id,phase) values(r.id,'authorizing');
    return jsonb_build_object('id',r.id,'envelope',r.envelope,'fingerprint',r.fingerprint,'attempts',r.attempts);
  elsif p_action in ('dispatch','settle') then
    target_worker := (p_data->>'worker')::uuid;
    select * into r from private.docked_auth_mail_outbox where id=p_data->>'id' and mode=target_mode for update;
    if not found or target_worker is null or r.worker is distinct from target_worker or r.lease_until<=clock_timestamp() then raise exception 'Mail lease unavailable'; end if;
    if p_action='dispatch' then
      if r.state<>'authorizing' or r.expires_at<=clock_timestamp() then raise exception 'Mail cannot dispatch'; end if;
      update private.docked_auth_mail_outbox set state='dispatching',dispatched_at=clock_timestamp() where id=r.id;
      insert into private.docked_auth_mail_events(job_id,phase) values(r.id,'dispatching');
      return jsonb_build_object('dispatched',true);
    end if;
    next_state:=p_data->>'state'; code:=p_data->>'code';
    if next_state is null or code is null or code not in ('202','4xx','ambiguous','authorization','invalid_envelope') then raise exception 'Invalid mail outcome'; end if;
    if not ((r.state='dispatching' and ((next_state='accepted' and code='202') or (next_state='unknown' and code='ambiguous') or (next_state='failed' and code='4xx')))
      or (r.state='authorizing' and ((next_state='pending' and code='authorization') or (next_state='failed' and code='invalid_envelope')))) then raise exception 'Invalid mail transition'; end if;
    if next_state='pending' and (r.attempts>=3 or r.expires_at<=clock_timestamp()) then next_state:='failed'; end if;
    update private.docked_auth_mail_outbox set state=next_state,last_code=code,
      available_at=clock_timestamp()+interval '60 seconds',
      envelope=case when next_state='pending' then envelope else null end
      where id=r.id;
    insert into private.docked_auth_mail_events(job_id,phase,code) values(r.id,next_state,code);
    return jsonb_build_object('state',next_state);
  end if;
  raise exception 'Unsupported mail operation';
end $$;
revoke all on function public.docked_mail_queue(text,jsonb) from public,anon,authenticated;
grant execute on function public.docked_mail_queue(text,jsonb) to service_role;
