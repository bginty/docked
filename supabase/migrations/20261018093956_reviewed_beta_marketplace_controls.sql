-- Additive, initially paused and unapproved. No credits, cards or memberships change.
create table credits_sandbox.trading_control (
  id boolean primary key default true check(id),
  policy text not null default 'private-beta-trading-v1',
  approval_reference text,
  approved_at timestamptz,
  paused boolean not null default true,
  sale boolean not null default false,
  swap boolean not null default false,
  combined boolean not null default false,
  revision bigint not null default 0,
  check ((approval_reference is null) = (approved_at is null)),
  check (paused or (approval_reference is not null and length(approval_reference)>10))
);
insert into credits_sandbox.trading_control(id) values(true);
create table credits_sandbox.trading_members (
  user_id uuid primary key references auth.users(id),
  enabled boolean not null default false,
  approval_reference text not null check(length(approval_reference)>10)
);
create table credits_sandbox.trading_audit (
  id bigint generated always as identity primary key,
  request uuid not null unique,
  actor uuid not null,
  action text not null check(action in ('pause','resume','failure','dispute','suspicious','case_closed')),
  detail text not null check(length(detail) between 1 and 500),
  created_at timestamptz not null default clock_timestamp()
);
alter table credits_sandbox.trading_control enable row level security;
alter table credits_sandbox.trading_members enable row level security;
alter table credits_sandbox.trading_audit enable row level security;
revoke all on credits_sandbox.trading_control,credits_sandbox.trading_members,credits_sandbox.trading_audit from public,anon,authenticated,service_role,docked_beta_app;

create function credits_sandbox.trading_access(member uuid, expected_policy text)
returns jsonb language sql security definer set search_path='' as $$
  with access as (
    select c.*, (not c.paused and c.approval_reference is not null and c.approved_at is not null
      and c.policy=expected_policy
      and beta_private.active_member_session()
      and exists(select 1 from credits_sandbox.trading_members m join credits_sandbox.access a on a.user_id=m.user_id
        join beta_public.profiles p on p.id=m.user_id
        where m.user_id=auth.uid() and m.enabled and a.enabled and p.disabled_at is null and beta_private.admitted(m.user_id))
      and exists(select 1 from credits_sandbox.trading_members m join credits_sandbox.access a on a.user_id=m.user_id
        join beta_public.profiles p on p.id=m.user_id
        where m.user_id=member and m.enabled and a.enabled and p.disabled_at is null and beta_private.admitted(m.user_id))) allowed
    from credits_sandbox.trading_control c where c.id
  ) select jsonb_build_object('enabled',allowed and (sale or swap or combined),
    'offers',allowed and (sale or swap or combined),'sale',allowed and sale,
    'swap',allowed and swap,'combined',allowed and combined) from access;
$$;

create function credits_sandbox.trading_owner()
returns void language plpgsql security definer set search_path='' as $$
begin
  if not coalesce(beta_private.active_member_session(),false)
    or coalesce(auth.jwt()->>'aal','') <> 'aal2'
    or not exists(select 1 from beta_private.roles where user_id=auth.uid() and role='owner') then
    raise exception 'Owner MFA required';
  end if;
end $$;
create function credits_sandbox.trading_set_pause(wanted boolean, expected_revision bigint, request_id uuid, reason text)
returns void language plpgsql security definer set search_path='' as $$
declare c credits_sandbox.trading_control; prior credits_sandbox.trading_audit;
begin
  perform pg_advisory_xact_lock(71820342);
  perform credits_sandbox.trading_owner();
  if length(trim(reason)) not between 1 and 500 then raise exception 'Reason required'; end if;
  select * into prior from credits_sandbox.trading_audit where request=request_id;
  if found then
    if prior.actor<>auth.uid() or prior.action<>(case when wanted then 'pause' else 'resume' end) or prior.detail<>trim(reason) then raise exception 'Request already used'; end if;
    return;
  end if;
  select * into c from credits_sandbox.trading_control where id for update;
  -- Emergency pause must not be blocked by a stale dashboard. Resume must be reviewed against its current revision.
  if not wanted and (c.revision<>expected_revision or c.approved_at is null or c.approval_reference is null
      or c.policy<>'private-beta-trading-v1' or not(c.sale or c.swap or c.combined)
      or not exists(select 1 from credits_sandbox.trading_members where enabled)) then
    raise exception 'Reviewed trading approval and current controls required';
  end if;
  update credits_sandbox.trading_control set paused=wanted,revision=revision+1 where id;
  insert into credits_sandbox.trading_audit(request,actor,action,detail)
    values(request_id,auth.uid(),case when wanted then 'pause' else 'resume' end,trim(reason));
end $$;
create function credits_sandbox.trading_record(request_id uuid, category text, note text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if category='failure' then
    if not coalesce(beta_private.active_member_session(),false) then raise exception 'Admission required'; end if;
    if note not in ('Rejected trading request','Trading outcome unknown; reconcile request') then raise exception 'Invalid failure category'; end if;
  else
    perform credits_sandbox.trading_owner();
    if category not in ('dispute','suspicious','case_closed') then raise exception 'Invalid case category'; end if;
  end if;
  insert into credits_sandbox.trading_audit(request,actor,action,detail) values(request_id,auth.uid(),category,trim(note)) on conflict(request) do nothing;
end $$;
create function credits_sandbox.trading_report()
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform credits_sandbox.trading_owner();
  return jsonb_build_object('control',(select to_jsonb(c) from credits_sandbox.trading_control c where id),
    'members',(select coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'label',a.label,'enabled',m.enabled)),'[]') from credits_sandbox.trading_members m join credits_sandbox.access a using(user_id)),
    'audit',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (select * from credits_sandbox.trading_audit order by id desc limit 100) t));
end $$;
revoke all on function credits_sandbox.trading_access(uuid,text),credits_sandbox.trading_owner(),credits_sandbox.trading_set_pause(boolean,bigint,uuid,text),credits_sandbox.trading_record(uuid,text,text),credits_sandbox.trading_report() from public,anon,authenticated,service_role,docked_beta_app;
grant execute on function credits_sandbox.trading_access(uuid,text),credits_sandbox.trading_set_pause(boolean,bigint,uuid,text),credits_sandbox.trading_record(uuid,text,text),credits_sandbox.trading_report() to docked_beta_app;
-- Approval and roster edits require a separately reviewed operator migration.
-- The web role can pause/resume approved trading, never approve policy or admit members.
