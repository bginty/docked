-- Public Owner support only. No beta-table grants, activation or asset mutation.
-- Requires the deployed clean transition and the inactive SMS budget schema.
create table private.owner_support_events (
 id bigint generated always as identity primary key,
 actor uuid not null, request_id uuid not null, action text not null,
 target uuid, reason text not null check(length(btrim(reason)) between 12 and 600),
 command jsonb not null, result jsonb not null, created_at timestamptz not null default clock_timestamp(),
 unique(actor,request_id)
);
alter table private.owner_support_events enable row level security;
revoke all on private.owner_support_events from public,anon,authenticated,service_role,docked_app,docked_beta_app;
create trigger owner_support_immutable before update or delete on private.owner_support_events
 for each row execute function operations.immutable();
create trigger owner_support_no_truncate before truncate on private.owner_support_events
 for each statement execute function operations.immutable();

-- Reversible support restriction must never invoke the legacy profile-disable
-- erasure triggers. Existing Auth identities and all customer assets stay intact.
create table private.owner_customer_restrictions (
 user_id uuid primary key, restricted_at timestamptz,
 updated_at timestamptz not null default clock_timestamp()
);
alter table private.owner_customer_restrictions enable row level security;
revoke all on private.owner_customer_restrictions from public,anon,authenticated,service_role,docked_app,docked_beta_app;
-- Preserve existing retirement semantics and ACL; sensitive paths already call
-- this common live-identity boundary (including SMS and commercial admission).
create or replace function launch_transition.identity_allowed(u uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select u is not null
 and not exists(select 1 from launch_transition.accounts where user_id=u and kind in('customer','system'))
 and not exists(select 1 from private.owner_customer_restrictions where user_id=u and restricted_at is not null)
$$;

-- Recheck current persisted role/session/transition at the database boundary.
create function private.public_owner_actor() returns uuid language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid();begin
 if u is null or not private.active_member_session() or auth.jwt()->>'aal' is distinct from 'aal2'
 or not exists(select 1 from private.roles where user_id=u and role='owner')
 then raise exception 'Active Owner MFA required';end if;
 return u;
end$$;
revoke all on function private.public_owner_actor() from public,anon,authenticated,service_role,docked_app,docked_beta_app;

-- Explicit safe fields only; no Auth contact values, payment tokens, encrypted
-- references, beta wallets/cards, hidden draws or unrestricted table read grants.
create function private.public_admin_records()
returns table(id text,category text,title text,detail text,fields jsonb)
language plpgsql stable security definer set search_path='' set statement_timeout='4s' as $$
begin
 perform private.public_owner_actor();
 return query
 select p.id::text,'members'::text,coalesce(nullif(s.display_name,''),'Customer'),
  case when coalesce(p.disabled_at,(select restricted_at from private.owner_customer_restrictions where user_id=p.id)) is null then 'Account enabled' else 'Account restricted' end,
  jsonb_build_object('Record ID',p.id,'Country',p.country,'State',p.state,'Created at',p.created_at,
   'Restricted at',coalesce(p.disabled_at,(select restricted_at from private.owner_customer_restrictions where user_id=p.id)),'Role',r.role,'Terms version',p.accepted_version,
   'Phone verified',private.public_phone_verified(p.id),
   'Commercial credits',coalesce((select sum(l.remaining) from commercial_billing.lots l where l.member_id=p.id),0),
   'Commercial cards',(select count(*) from commercial_billing.cards c where c.owner_id=p.id),
   'Open recovery holds',(select count(*) from commercial_billing.recovery_cases c where c.member_id=p.id and c.state='OPEN'))
 from public.profiles p left join private.social_profiles s on s.user_id=p.id left join private.roles r on r.user_id=p.id
 where not exists(select 1 from launch_transition.accounts a where a.user_id=p.id and a.kind in('customer','system'))
 union all
 select d.id::text,'cards',coalesce(d.snapshot->>'name','Player definition'),concat_ws(' · ',upper(d.sport),d.rarity,'Definition'),
  jsonb_build_object('Record ID',d.id,'Sport',d.sport,'Rarity',d.rarity,'Lifetime cap',d.lifetime_cap,
   'Lifetime issued',d.issued,'Historical issued',d.legacy_issued,'Approved',d.approved,'Record type','Definition')
 from commercial_billing.definitions d
 union all
 select c.id::text,'cards',coalesce(d.snapshot->>'name','Issued card'),concat_ws(' · ',upper(d.sport),d.rarity,'#'||c.serial),
  jsonb_build_object('Record ID',c.id,'Definition',c.definition,'Serial',c.serial,'Owner reference',c.owner_id,
   'Pack',c.pack,'Issued at',c.created_at,'Locked',c.locked,'Record type','Commercial issued card')
 from commercial_billing.cards c join commercial_billing.definitions d on d.id=c.definition
 union all
 select p.id::text,'packs',coalesce(p.product->>'name','Commercial pack'),'Paid credits · permanent allocation',
  jsonb_build_object('Record ID',p.id,'Member reference',p.member_id,'Request',p.request,'Price credits',p.price,
   'Card count',(select count(*) from commercial_billing.cards c where c.pack=p.id),'Product card count',p.product->'cards',
   'Created at',p.created_at,'Opened at',p.opened_at,'Policy version',p.policy_version)
 from commercial_billing.packs p
 union all
 select r.key,'transactions','Google credit purchase',concat_ws(' · ',r.state,r.order_id),
  jsonb_build_object('Record ID',r.key,'Member reference',r.member_id,'Order reference',r.order_id,'State',r.state,
   'Environment',r.environment,'Gross AUD cents',r.gross_cents,'GST cents',r.tax_cents,
   'Refunded AUD cents',r.refunded_cents,'Credited',r.credited,'Created at',r.created_at,
   'Recovery hold',(select state from commercial_billing.recovery_cases c where c.receipt=r.key))
 from commercial_billing.receipts r;
end$$;
revoke all on function private.public_admin_records() from public,anon,authenticated,service_role,docked_app,docked_beta_app;

create function private.admin_search(p_query text,p_category text default 'all',p_page integer default 1)
returns jsonb language plpgsql security definer set search_path='' set statement_timeout='4s' as $$
declare result jsonb;begin
 perform private.public_owner_actor();
 if p_category is null or p_category not in('all','members','cards','packs','transactions','competitions','moderation') then raise exception 'Category denied';end if;
 if p_query is null or length(p_query)>120 or p_page is null or p_page<1 or p_page>100 then raise exception 'Invalid search';end if;
 if length(btrim(p_query))<2 then return '[]'::jsonb;end if;
 select coalesce(jsonb_agg(to_jsonb(r)),'[]') into result from (
  select id,category,title,detail from private.public_admin_records()
  where(p_category='all' or category=p_category) and strpos(lower(concat_ws(' ',id,title,detail)),lower(btrim(p_query)))>0
  order by category,lower(title),id limit 21 offset (p_page-1)*20)r;
 return result;
end$$;

create function private.admin_record_detail(p_category text,p_id text,p_page integer default 1)
returns jsonb language plpgsql security definer set search_path='' set statement_timeout='4s' as $$
declare item record; events jsonb;begin
 perform private.public_owner_actor();
 if p_category is null or p_category not in('members','cards','packs','transactions','competitions','moderation') then raise exception 'Category denied';end if;
 if p_id is null or length(btrim(p_id))=0 or length(p_id)>160 or p_id~'[[:cntrl:]]' or p_page is null or p_page<1 or p_page>100 then raise exception 'Invalid record';end if;
 select * into item from private.public_admin_records() where category=p_category and id=p_id;
 if not found then return null;end if;
 select coalesce(jsonb_agg(to_jsonb(e)),'[]') into events from(
  select * from(
   select 'support:'||e.id id,e.created_at at,e.action event,e.reason detail from private.owner_support_events e where p_category='members' and e.target::text=p_id
   union all select 'receipt:'||e.id,e.observed_at,e.state,'Verified provider observation' from commercial_billing.receipt_events e where p_category='transactions' and e.receipt=p_id
   union all select 'custody:'||e.id,e.created_at,'Ownership recorded',e.reference from commercial_billing.ownership_events e where p_category='cards' and e.card::text=p_id
  )h order by at desc,id limit 21 offset(p_page-1)*20)e;
 return jsonb_build_object('id',item.id,'category',item.category,'title',item.title,'source','Public commercial records; historical beta assets excluded',
  'fields',item.fields,'history',(select coalesce(jsonb_agg(value),'[]') from jsonb_array_elements(events)with ordinality e(value,n) where n<=20),
  'page',p_page,'hasMore',jsonb_array_length(events)>20);
end$$;

create function private.owner_command_centre(p_start timestamptz,p_end timestamptz,p_sport text default null,p_include_staff boolean default false)
returns jsonb language plpgsql security definer set search_path='' set statement_timeout='5s' as $$
declare inventory jsonb;begin
 perform private.public_owner_actor();
 if p_start is null or p_end is null or p_end<=p_start or p_end-p_start>interval '366 days'
 or(p_sport is not null and p_sport not in('nfl','afl','nrl')) then raise exception 'Invalid report';end if;
 select coalesce(jsonb_agg(to_jsonb(d)),'[]') into inventory from(
  select id,coalesce(snapshot->>'name','Player definition') name,sport,rarity tier,''::text season,lifetime_cap max_supply,issued,
   lifetime_cap-issued available_lifetime_supply,(select count(*) from commercial_billing.cards c where c.definition=d.id) cards,
   (select count(distinct serial) from commercial_billing.cards c where c.definition=d.id) distinct_serials
  from commercial_billing.definitions d where p_sport is null or sport=p_sport order by sport,id)d;
 return jsonb_build_object('scope','live','generatedAt',clock_timestamp(),'inventory',inventory,'competitions','[]'::jsonb,'reports','[]'::jsonb,'emailFailures',null,
  'metrics',jsonb_build_object('customers',(select count(*) from public.profiles p where not exists(select 1 from launch_transition.accounts a where a.user_id=p.id and a.kind in('customer','system')) and(p_include_staff or not exists(select 1 from private.roles r where r.user_id=p.id))),
   'receiptsInReview',(select count(*) from commercial_billing.receipts where state='REVIEW'),
   'recoveryHolds',(select count(*) from commercial_billing.recovery_cases where state='OPEN'),
   'jobsNeedingAttention',(select count(*) from commercial_billing.jobs where state='attention'),
   'paidPacks',(select count(*) from commercial_billing.packs where created_at>=p_start and created_at<p_end),
   'commercialCards',(select count(*) from commercial_billing.cards),
   'lifetimeIssued',(select sum(issued) from commercial_billing.definitions),
   'openSales',(select sales_enabled::int from commercial_billing.control where id),
   'openIssuance',(select issuance_enabled::int from commercial_billing.control where id)),
  'limitations',jsonb_build_array('Historical beta assets are excluded from commercial customer records. Lifetime counts include their permanent supply consumption.',
   'Marketplace and real scored competitions remain disabled. Use billing review for provider reconciliation and incident review for delivery evidence.'));
end$$;

-- No path can enable commerce, clear recovery holds or change an Auth identity.
-- Session identity is never accepted from the caller's command.
create function private.owner_support_command(p jsonb) returns jsonb
language plpgsql security definer set search_path='' set statement_timeout='5s' as $$
declare v_actor uuid:=private.public_owner_actor(); request uuid; target uuid; action text; old private.owner_support_events; result jsonb; disabled timestamptz;
begin
 if p is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>4096
 or exists(select 1 from jsonb_object_keys(p) k where k not in('request','action','target','reason','expectedDisabledAt'))
 then raise exception 'Invalid support command';end if;
 request:=(p->>'request')::uuid; action:=p->>'action';target:=(p->>'target')::uuid;
 if request is null or action is null or action not in('note','restrict_customer','restore_customer','emergency_pause')
 or p->>'reason' is null or length(btrim(p->>'reason')) not between 12 and 600 then raise exception 'Invalid support command';end if;
 perform pg_advisory_xact_lock(hashtextextended(v_actor::text||':'||request::text,0));
 select * into old from private.owner_support_events e where e.actor=v_actor and request_id=request;
 if found then if old.command<>p then raise exception 'Request conflict';end if;return old.result;end if;
 if action='emergency_pause' then
  if target is not null then raise exception 'Invalid pause target';end if;
  update commercial_billing.control set sales_enabled=false,issuance_enabled=false,transfers_enabled=false,gameplay_enabled=false,updated_at=clock_timestamp() where id;
  update private.feature_flags set enabled=false where enabled;
  update sms_delivery.windows set enabled=false where enabled;
 else
  if target is null or exists(select 1 from auth.users where id=target and deleted_at is not null) or exists(select 1 from private.roles where user_id=target)
   or exists(select 1 from launch_transition.accounts where user_id=target) then raise exception 'Customer unavailable';end if;
  perform 1 from public.profiles where id=target and disabled_at is null for update;
  if not found then raise exception 'Customer unavailable';end if;
  select restricted_at into disabled from private.owner_customer_restrictions where user_id=target;
  if action<>'note' then
   if (p->>'expectedDisabledAt') is distinct from (to_jsonb(disabled)#>>'{}') then raise exception 'Customer state changed';end if;
   insert into private.owner_customer_restrictions(user_id,restricted_at)
    values(target,case when action='restrict_customer' then clock_timestamp() else null end)
    on conflict(user_id) do update set restricted_at=excluded.restricted_at,updated_at=clock_timestamp();
  end if;
 end if;
 result:=jsonb_build_object('recorded',true,'request',request,'action',action);
 insert into private.owner_support_events(actor,request_id,action,target,reason,command,result) values(v_actor,request,action,target,btrim(p->>'reason'),p,result);
 return result;
end$$;

revoke all on function private.admin_search(text,text,integer),private.admin_record_detail(text,text,integer),
 private.owner_command_centre(timestamptz,timestamptz,text,boolean),private.owner_support_command(jsonb)
 from public,anon,authenticated,service_role,docked_beta_app;
grant execute on function private.admin_search(text,text,integer),private.admin_record_detail(text,text,integer),
 private.owner_command_centre(timestamptz,timestamptz,text,boolean),private.owner_support_command(jsonb) to docked_app;
