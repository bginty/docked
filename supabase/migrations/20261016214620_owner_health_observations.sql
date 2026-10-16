-- Owner-triggered, bounded health evidence. No account, wallet or inventory writes.
create table beta_private.service_health_observations (
 request_id uuid not null,
 service text not null check (service in ('api','web')),
 actor uuid not null,
 status text not null check(status in ('passed','failed')),
 code text not null check(code in ('matched','unexpected_response','timeout_or_network','invalid_configuration')),
 status_code integer check(status_code between 100 and 599),
 duration_ms integer not null check(duration_ms between 0 and 15000),
 checked_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null default clock_timestamp()+interval '5 minutes',
 primary key(request_id,service)
);
create index service_health_latest on beta_private.service_health_observations(service,checked_at desc);
alter table beta_private.service_health_observations enable row level security;
revoke all on beta_private.service_health_observations from public,anon,authenticated,service_role,docked_app,docked_beta_app;
create function beta_private.owner_health_gate() returns void language plpgsql security definer set search_path='' as $$
begin
 if not coalesce(beta_private.active_member_session(),false) or auth.jwt()->>'aal' is distinct from 'aal2'
 or not exists(select 1 from beta_private.roles where user_id=auth.uid() and role='owner')
 or not coalesce(beta_private.owner_gameplay_identity(auth.uid()),false) then raise exception 'Owner MFA required';end if;
end $$;
revoke all on function beta_private.owner_health_gate() from public,anon,authenticated,service_role,docked_app,docked_beta_app;
create function beta_private.owner_health_record(p_request uuid,p_rows jsonb) returns void language plpgsql security definer set search_path='' as $$
declare row jsonb;
begin
 perform beta_private.owner_health_gate();
 if p_request is null or jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows)<>2 then raise exception 'Invalid health record';end if;
 if (select count(distinct x->>'service') from jsonb_array_elements(p_rows) x)<>2 then raise exception 'Invalid health services';end if;
 for row in select value from jsonb_array_elements(p_rows) loop
  insert into beta_private.service_health_observations(request_id,service,actor,status,code,status_code,duration_ms)
  values(p_request,row->>'service',auth.uid(),row->>'status',row->>'code',(row->>'statusCode')::int,(row->>'durationMs')::int)
  on conflict(request_id,service) do nothing;
 end loop;
end $$;
create function beta_private.owner_health_read() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform beta_private.owner_health_gate();
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into result from (
  select distinct on(service) service,status,code,status_code as "statusCode",duration_ms as "durationMs",checked_at as "checkedAt",expires_at as "expiresAt"
  from beta_private.service_health_observations order by service,checked_at desc,request_id desc
 ) x;
 return result;
end $$;
revoke all on function beta_private.owner_health_record(uuid,jsonb),beta_private.owner_health_read() from public,anon,authenticated,service_role,docked_app;
grant execute on function beta_private.owner_health_record(uuid,jsonb),beta_private.owner_health_read() to docked_beta_app;
