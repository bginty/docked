-- Free beta only. Reading an entitlement does not mint cards or touch old grants.
create table sports_feed.nfl_starter_entitlements(
 user_id uuid primary key references auth.users,
 id uuid unique not null default gen_random_uuid(),
 created_at timestamptz not null default clock_timestamp(),
 opened_at timestamptz
);
alter table sports_feed.nfl_starter_entitlements enable row level security;
revoke all on sports_feed.nfl_starter_entitlements from public,anon,authenticated,docked_app,docked_beta_app;
create function sports_feed.starter_entitlement_guard() returns trigger language plpgsql set search_path='' as $$begin
 if tg_op='DELETE' then raise exception 'Starter entitlement history is permanent';end if;
 if (to_jsonb(new)-'opened_at') is distinct from (to_jsonb(old)-'opened_at') or old.opened_at is not null or new.opened_at is null then raise exception 'Starter entitlement may only be opened once';end if;
 return new;
end$$;
create trigger guard before update or delete on sports_feed.nfl_starter_entitlements for each row execute function sports_feed.starter_entitlement_guard();
alter function beta_fantasy.production_command(text,jsonb,uuid) rename to production_command_before_customer_pack;
-- PL/pgSQL's implicit parameter block is named after the function. Preserve
-- qualified parameter references when wrapping the existing NFL command.
do $$begin execute replace(pg_get_functiondef('beta_fantasy.production_command_before_customer_pack(text,jsonb,uuid)'::regprocedure),'production_command.request_id','production_command_before_customer_pack.request_id');end$$;
revoke all on function beta_fantasy.production_command_before_customer_pack(text,jsonb,uuid) from public,anon,authenticated,docked_app,docked_beta_app;
create function beta_fantasy.production_command(action text,p jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid; prior beta_fantasy.requests; entitlement sports_feed.nfl_starter_entitlements; answer jsonb;
begin
 if not exists(select 1 from sports_feed.nfl_control where enabled) or action not in('claim_starter','open_nfl_starter') then return beta_fantasy.production_command_before_customer_pack(action,p,request_id);end if;
 perform pg_advisory_xact_lock(71820342);
 u:=beta_fantasy.production_eligible();
 if not beta_private.active_member_session() then raise exception 'Active session required';end if;
 if request_id is null or p is distinct from '{}'::jsonb then raise exception 'Empty starter payload and request required';end if;
 insert into beta_fantasy.members(user_id,expires_at) values(u,'infinity') on conflict do nothing;
 select * into prior from beta_fantasy.requests q where q.user_id=u and q.request_id=production_command.request_id;
 if found then if prior.action<>action or prior.payload<>p then raise exception 'Request ID reused';end if;return prior.result;end if;
 insert into sports_feed.nfl_starter_entitlements(user_id) values(u) on conflict do nothing;
 select * into strict entitlement from sports_feed.nfl_starter_entitlements where user_id=u for update;
 if action='open_nfl_starter' then
  answer:=sports_feed.nfl_allocate(u);
  if entitlement.opened_at is null then update sports_feed.nfl_starter_entitlements set opened_at=clock_timestamp() where user_id=u;end if;
  answer:=answer||jsonb_build_object('pack_id',entitlement.id,'opened',true);
 else answer:=jsonb_build_object('pack_id',entitlement.id,'opened',entitlement.opened_at is not null or exists(select 1 from sports_feed.nfl_allocations where user_id=u));end if;
 insert into beta_fantasy.requests values(u,request_id,action,p,answer);
 return answer;
end$$;
alter function beta_fantasy.production_read_state() rename to production_read_state_before_customer_pack;
revoke all on function beta_fantasy.production_read_state_before_customer_pack() from public,anon,authenticated,docked_app,docked_beta_app;
create function beta_fantasy.production_read_state() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; u uuid; opened boolean;
begin
 result:=beta_fantasy.production_read_state_before_customer_pack();
 if result->>'nfl_beta' is distinct from 'true' then return result;end if;
 u:=beta_fantasy.production_eligible();
 if not beta_private.active_member_session() then raise exception 'Active session required';end if;
 insert into sports_feed.nfl_starter_entitlements(user_id) values(u) on conflict do nothing;
 opened:=exists(select 1 from sports_feed.nfl_allocations where user_id=u);
 return jsonb_set(result,'{rewards}',coalesce(result->'rewards','{}')||jsonb_build_object('starter_entitled',true,'starter_claimed',opened,'starter_opened',opened));
end$$;
revoke all on function sports_feed.starter_entitlement_guard(),beta_fantasy.production_command(text,jsonb,uuid),beta_fantasy.production_read_state() from public,anon,authenticated,docked_app;
grant execute on function beta_fantasy.production_command(text,jsonb,uuid),beta_fantasy.production_read_state() to docked_beta_app;
