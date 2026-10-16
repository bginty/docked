-- Proposal/review records only. No execution function, wallet mutation, grant,
-- campaign creation, payment value or second ledger is introduced.
create table beta_private.credit_requests(
 id uuid primary key default gen_random_uuid(), recipient uuid not null references auth.users,
 amount bigint not null check(amount between 1 and 1000000000), reason text not null check(length(btrim(reason)) between 12 and 600),
 status text not null default 'requested' check(status in('requested','approved','declined','cancelled')),
 revision integer not null default 1 check(revision>0), requested_by uuid not null references auth.users,
 policy_context text not null check(length(policy_context) between 1 and 120),
 created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp()
);
create table beta_private.credit_request_events(
 id uuid primary key default gen_random_uuid(), credit_request_id uuid not null references beta_private.credit_requests,
 actor uuid not null references auth.users, request_id uuid not null, action text not null check(action in('request','approve','decline','cancel')),
 reason text not null check(length(btrim(reason)) between 12 and 600), command jsonb not null,
 created_at timestamptz not null default clock_timestamp(),unique(actor,request_id)
);
create index credit_requests_recent on beta_private.credit_requests(created_at desc,id);
create index credit_request_history on beta_private.credit_request_events(credit_request_id,created_at,id);
alter table beta_private.credit_requests enable row level security;
alter table beta_private.credit_request_events enable row level security;
revoke all on beta_private.credit_requests,beta_private.credit_request_events from public,anon,authenticated,service_role,docked_app,docked_beta_app,docked_nfl_worker;
create trigger immutable before update or delete on beta_private.credit_request_events for each row execute function beta_private.immutable();
create function beta_private.credit_request_guard() returns trigger language plpgsql set search_path='' as $$begin
 if tg_op='DELETE' then raise exception 'Credit request history is permanent';end if;
 if (to_jsonb(new)-array['status','revision','updated_at']) is distinct from (to_jsonb(old)-array['status','revision','updated_at'])
 or new.revision<>old.revision+1 or not ((old.status='requested' and new.status in('approved','declined','cancelled')) or (old.status='approved' and new.status='cancelled')) then
 raise exception 'Credit request transition denied';end if;
 return new;
end $$;
create trigger guard before update or delete on beta_private.credit_requests for each row execute function beta_private.credit_request_guard();
create function beta_private.credit_request_owner() returns uuid language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid();begin
 if actor is null or not coalesce(beta_private.active_member_session(),false) or coalesce(auth.jwt()->>'aal','')<>'aal2'
 or not exists(select 1 from beta_private.roles where user_id=actor and role='owner') then raise exception 'Owner MFA required';end if;
 return actor;
end $$;
create function beta_private.credit_request_view(p_id uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',r.id,'recipient',r.recipient,'recipientName',coalesce(nullif(s.display_name,''),'Member'),
 'amount',r.amount,'reason',r.reason,'status',r.status,'revision',r.revision,'requested_by',r.requested_by,'policy_context',r.policy_context,
 'created_at',r.created_at,'updated_at',r.updated_at,'history',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'actor',e.actor,'action',e.action,'reason',e.reason,'created_at',e.created_at) order by e.created_at,e.id)
 from beta_private.credit_request_events e where e.credit_request_id=r.id),'[]'::jsonb))
 from beta_private.credit_requests r left join beta_private.social_profiles s on s.user_id=r.recipient where r.id=p_id
$$;
create function beta_private.credit_request_list(p_query text default '',p_page integer default 1) returns jsonb language plpgsql stable security definer set search_path='' set statement_timeout='4s' as $$
declare requests jsonb; recipients jsonb; more boolean;begin
 perform beta_private.credit_request_owner();
 p_query:=btrim(coalesce(p_query,''));
 if length(p_query)>120 or p_page is null or p_page<1 or p_page>100 then raise exception 'Invalid credit request query';end if;
 select coalesce(jsonb_agg(beta_private.credit_request_view(r.id) order by r.created_at desc,r.id),'[]') into requests
 from (select id,created_at from beta_private.credit_requests order by created_at desc,id limit 26 offset (p_page-1)*25) r;
 more:=jsonb_array_length(requests)>25;
 select coalesce(jsonb_agg(r.value order by r.n),'[]') into requests from jsonb_array_elements(requests) with ordinality r(value,n) where r.n<=25;
 select coalesce(jsonb_agg(to_jsonb(r) order by r.name,r.id),'[]') into recipients from (
  select p.id,coalesce(nullif(s.display_name,''),'Member') name,s.handle
  from beta_public.profiles p left join beta_private.social_profiles s on s.user_id=p.id
  where length(p_query)>=2 and p.disabled_at is null and beta_private.admitted(p.id)
  and strpos(lower(concat_ws(' ',p.id,s.display_name,s.handle)),lower(p_query))>0 order by name,p.id limit 25
 ) r;
 return jsonb_build_object('requests',requests,'recipients',recipients,'page',p_page,'hasMore',more,'executionEnabled',false);
end $$;
create function beta_private.credit_request_mutate(p_input jsonb,p_policy_context text) returns jsonb language plpgsql security definer set search_path='' set statement_timeout='4s' as $$
declare v_actor uuid; request_key uuid; previous beta_private.credit_request_events; record beta_private.credit_requests; action text; note text; recipient uuid; amount bigint;begin
 v_actor:=beta_private.credit_request_owner();
 action:=p_input->>'action';note:=btrim(p_input->>'reason');
 if action is null or action not in('request','approve','decline','cancel') or p_input->'confirmed' is distinct from 'true'::jsonb or jsonb_typeof(p_input->'reason') is distinct from 'string' or note is null or length(note)<12 or length(note)>600
 or p_policy_context is null or length(p_policy_context)<1 or length(p_policy_context)>120 then raise exception 'Invalid credit request';end if;
 request_key:=(p_input->>'requestId')::uuid;
 if request_key is null then raise exception 'Invalid credit request';end if;
 -- Serialize an actor's idempotency key, including retries in separate tabs.
 perform pg_advisory_xact_lock(hashtextextended(v_actor::text||':'||request_key::text,0));
 select e.* into previous from beta_private.credit_request_events e where e.actor=v_actor and e.request_id=request_key;
 if found then
  if previous.command<>p_input then raise exception 'Credit request idempotency conflict';end if;
  return beta_private.credit_request_view(previous.credit_request_id);
 end if;
 if action='request' then
  if p_input-array['action','requestId','recipient','amount','reason','confirmed']<>'{}'::jsonb then raise exception 'Invalid credit request';end if;
  if jsonb_typeof(p_input->'amount') is distinct from 'number' or (p_input->>'amount')!~'^[0-9]+$' then raise exception 'Invalid credit request';end if;
  amount:=(p_input->>'amount')::bigint;recipient:=(p_input->>'recipient')::uuid;
  if amount is null or amount<1 or amount>1000000000 or recipient is null then raise exception 'Invalid credit request';end if;
  if not exists(select 1 from beta_public.profiles p where p.id=recipient and p.disabled_at is null and beta_private.admitted(p.id)) then raise exception 'Recipient unavailable';end if;
  insert into beta_private.credit_requests(recipient,amount,reason,requested_by,policy_context) values(recipient,amount,note,v_actor,p_policy_context) returning * into record;
 else
  if p_input-array['action','requestId','id','revision','reason','confirmed']<>'{}'::jsonb then raise exception 'Invalid credit request';end if;
  if jsonb_typeof(p_input->'revision') is distinct from 'number' or (p_input->>'revision')!~'^[1-9][0-9]*$' then raise exception 'Invalid credit request';end if;
  select * into record from beta_private.credit_requests where id=(p_input->>'id')::uuid for update;
  if not found or record.revision is distinct from (p_input->>'revision')::integer then raise exception 'Credit request revision conflict';end if;
  if action='approve' and not exists(select 1 from beta_public.profiles p where p.id=record.recipient and p.disabled_at is null and beta_private.admitted(p.id)) then raise exception 'Recipient unavailable';end if;
  update beta_private.credit_requests set status=case action when 'approve' then 'approved' when 'decline' then 'declined' else 'cancelled' end,revision=revision+1,updated_at=clock_timestamp() where id=record.id returning * into record;
 end if;
 insert into beta_private.credit_request_events(credit_request_id,actor,request_id,action,reason,command) values(record.id,v_actor,request_key,action,note,p_input);
 return beta_private.credit_request_view(record.id);
end $$;
revoke all on function beta_private.credit_request_guard(),beta_private.credit_request_owner(),beta_private.credit_request_view(uuid),beta_private.credit_request_list(text,integer),beta_private.credit_request_mutate(jsonb,text) from public,anon,authenticated,service_role,docked_app,docked_beta_app,docked_nfl_worker;
grant execute on function beta_private.credit_request_list(text,integer),beta_private.credit_request_mutate(jsonb,text) to docked_beta_app;
