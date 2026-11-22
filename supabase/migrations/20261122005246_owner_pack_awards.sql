-- Manual Owner promotions/prizes allocate normal sealed commercial packs.
-- No credits, cash, Google products, competition-prize scope or feature flag is
-- enabled by this migration. Existing lifetime/card/pack guards remain intact.
create table commercial_billing.pack_awards (
 id uuid primary key default gen_random_uuid(),
 actor uuid not null,
 request uuid not null,
 member_id uuid not null references commercial_billing.accounts(member_id),
 recipient_name text not null,
 reason text not null check(reason in ('PROMOTION','PRIZE')),
 reference text not null check(reference=btrim(reference) and length(reference) between 3 and 200 and reference!~'[[:cntrl:]]'),
 command jsonb not null check(jsonb_typeof(command)='object'),
 command_hash text not null check(command_hash~'^[a-f0-9]{64}$'),
 products jsonb not null check(jsonb_typeof(products)='array' and jsonb_array_length(products) between 1 and 20),
 issuance_txid bigint not null default txid_current(),
 created_at timestamptz not null default clock_timestamp(),
 unique(actor,request)
);
alter table commercial_billing.pack_awards enable row level security;
revoke all on commercial_billing.pack_awards from public,anon,authenticated,service_role,docked_app,docked_beta_app,docked_commercial_app;
grant select on commercial_billing.pack_awards to docked_commercial_app;
create policy commercial_pack_award_read on commercial_billing.pack_awards for select to docked_commercial_app using(true);
create index commercial_pack_award_history on commercial_billing.pack_awards(created_at desc,id desc);
create index commercial_pack_award_member on commercial_billing.pack_awards(member_id,created_at desc);
create trigger commercial_pack_award_immutable before update or delete on commercial_billing.pack_awards
 for each row execute function commercial_billing.immutable();
create trigger commercial_pack_award_no_truncate before truncate on commercial_billing.pack_awards
 for each statement execute function commercial_billing.immutable();

alter table commercial_billing.packs add column award_id uuid references commercial_billing.pack_awards(id);
alter table commercial_billing.packs add column award_index integer;
alter table commercial_billing.packs drop constraint packs_price_check;
alter table commercial_billing.packs add constraint commercial_pack_price_origin check(
 (award_id is null and award_index is null and price>0)
 or (award_id is not null and award_index is not null and award_index between 0 and 19 and price=0 and funding='[]'::jsonb)
);
create unique index commercial_pack_award_slot on commercial_billing.packs(award_id,award_index) where award_id is not null;

-- This wrapper deliberately stays in the private commercial schema. The public
-- and general application roles receive no new table access or award authority.
create function commercial_billing.pack_award_actor(expected_actor uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.public_owner_actor();begin
 if expected_actor is null or actor is distinct from expected_actor then raise exception 'Current Owner identity required';end if;
 perform 1 from private.roles where user_id=actor and role='owner' for share;
 if not found then raise exception 'Current Owner role required';end if;
 perform 1 from auth.sessions where user_id=actor and id::text=auth.jwt()->>'session_id'
  and(not_after is null or not_after>clock_timestamp()) for share;
 if not found then raise exception 'Current Owner session required';end if;
 perform 1 from auth.users u join public.profiles p on p.id=u.id
  where u.id=actor and u.deleted_at is null and u.email_confirmed_at is not null
   and not coalesce(u.is_anonymous,false) and(u.banned_until is null or u.banned_until<=clock_timestamp())
   and p.disabled_at is null for share of u,p;
 if not found or not launch_transition.identity_allowed(actor) then raise exception 'Current Owner account required';end if;
 return actor;
end$$;

-- Recipient need not be online. Reuse current commercial admission requirements,
-- while the actor remains the authenticated Owner throughout this transaction.
create function commercial_billing.pack_award_recipient(expected_actor uuid,target uuid,terms_version text,privacy_version text)
returns text language plpgsql security definer set search_path='' as $$
declare label text;begin
 perform commercial_billing.pack_award_actor(expected_actor);
 if target is null or nullif(terms_version,'') is null or nullif(privacy_version,'') is null
  or not launch_transition.identity_allowed(target) then raise exception 'Eligible commercial customer required';end if;
 perform 1 from public.profiles p join auth.users u on u.id=p.id
  where p.id=target and p.disabled_at is null and p.country='AU' and p.age_attested
   and p.accepted_version=terms_version and u.deleted_at is null and u.email_confirmed_at is not null
   and not coalesce(u.is_anonymous,false) and(u.banned_until is null or u.banned_until<=clock_timestamp())
   and private.public_phone_verified(p.id)
   and exists(select 1 from private.consent_events c where c.user_id=p.id and c.purpose='privacy'
    and c.granted and c.version=privacy_version and c.id=(select id from private.consent_events
      where user_id=p.id and purpose='privacy' order by created_at desc,id desc limit 1))
   and exists(select 1 from lateral(select * from private.region_policies r
    where r.country=p.country and r.state=p.state and r.effective_from<=clock_timestamp()
     and r.effective_to>clock_timestamp() order by r.effective_from desc,r.id desc limit 1)r
    where not r.preview_community_only and r.approved and r.minimum_age=18 and r.review_at>clock_timestamp())
  for share of p,u;
 if not found or exists(select 1 from commercial_billing.recovery_cases where member_id=target and state='OPEN')
  then raise exception 'Eligible commercial customer without a financial hold required';end if;
 select coalesce(nullif(btrim(display_name),''),'Customer') into label from private.social_profiles where user_id=target;
 return coalesce(label,'Customer');
end$$;

create function commercial_billing.create_pack_award(expected_actor uuid,p_command jsonb,p_hash text,p_products jsonb,terms_version text,privacy_version text)
returns commercial_billing.pack_awards language plpgsql security definer set search_path='' as $$
declare answer commercial_billing.pack_awards; item jsonb; product jsonb; target uuid; requested uuid;
 label text; total integer:=0; index integer:=0; copies integer; seen text[]:='{}'; identity text;
begin
 perform commercial_billing.pack_award_actor(expected_actor);
 if p_command is null or jsonb_typeof(p_command)<>'object' or octet_length(p_command::text)>16384
  or exists(select 1 from jsonb_object_keys(p_command) k where k not in('request','member','reason','reference','lines','confirmed'))
  or p_command->'confirmed' is distinct from 'true'::jsonb or coalesce(p_command->>'reason','') not in('PROMOTION','PRIZE')
  or p_command->>'reference' is null or length(btrim(p_command->>'reference')) not between 3 and 200
  or p_command->>'reference'<>btrim(p_command->>'reference') or p_command->>'reference'~'[[:cntrl:]]'
  or p_hash is null or p_hash!~'^[a-f0-9]{64}$' or jsonb_typeof(p_command->'lines') is distinct from 'array'
  or jsonb_array_length(p_command->'lines') not between 1 and 20 or jsonb_typeof(p_products) is distinct from 'array'
  or jsonb_array_length(p_products) not between 1 and 20 then raise exception 'Invalid pack award';end if;
 target:=(p_command->>'member')::uuid; requested:=(p_command->>'request')::uuid;
 if target is null or requested is null then raise exception 'Award member and request required';end if;
 perform pg_advisory_xact_lock(hashtextextended('owner-pack-award:'||expected_actor::text||':'||requested::text,0));
 select * into answer from commercial_billing.pack_awards where actor=expected_actor and request=requested;
 if found then
  if answer.command<>p_command or answer.command_hash<>p_hash then raise exception 'Award request conflicts with original award';end if;
  return answer;
 end if;
 label:=commercial_billing.pack_award_recipient(expected_actor,target,terms_version,privacy_version);
 for item in select value from jsonb_array_elements(p_command->'lines') loop
  if jsonb_typeof(item)<>'object' or exists(select 1 from jsonb_object_keys(item) k where k not in('sport','family','size','quantity','configurationHash'))
   or coalesce(item->>'sport','') not in('nfl','afl','nrl') or coalesce(item->>'family','') not in('STANDARD','PREMIUM')
   or coalesce(item->>'size','') not in('1','3','9') or coalesce(item->>'quantity','')!~'^[1-9][0-9]?$'
   or coalesce(item->>'configurationHash','')!~'^[a-f0-9]{64}$' then raise exception 'Invalid pack award line';end if;
  copies:=(item->>'quantity')::integer;total:=total+copies;
  if total>20 then raise exception 'At most twenty packs may be awarded';end if;
  identity:=concat_ws(':',item->>'sport',item->>'family',item->>'size');
  if identity=any(seen) then raise exception 'Duplicate pack award line';end if;seen:=array_append(seen,identity);
  for copy in 1..copies loop
   product:=p_products->index;
   if product is null or product->>'sport' is distinct from item->>'sport'
    or product->>'type' is distinct from item->>'family' or product->>'cards' is distinct from item->>'size'
    or product->>'configurationHash' is distinct from item->>'configurationHash'
    then raise exception 'Award must use exact reviewed products';end if;
   index:=index+1;
  end loop;
 end loop;
 if total<>jsonb_array_length(p_products) then raise exception 'Award product count mismatch';end if;
 insert into commercial_billing.pack_awards(actor,request,member_id,recipient_name,reason,reference,command,command_hash,products)
 values(expected_actor,requested,target,label,p_command->>'reason',p_command->>'reference',p_command,p_hash,p_products) returning * into answer;
 return answer;
end$$;

-- A zero-price pack must be an exact position in the batch being issued NOW.
-- Owner authorization is also enforced for direct commercial SQL inserts.
create function commercial_billing.pack_award_pack_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare award commercial_billing.pack_awards;begin
 if new.award_id is null then return new;end if;
 select * into strict award from commercial_billing.pack_awards where id=new.award_id;
 perform commercial_billing.pack_award_actor(award.actor);
 if award.issuance_txid<>txid_current() or new.issuance_txid<>txid_current()
  or new.member_id<>award.member_id or new.opened_at is not null
  or new.price<>0 or new.funding<>'[]'::jsonb or new.award_index is null
  or new.award_index<0 or new.award_index>=jsonb_array_length(award.products)
  or new.product is distinct from award.products->new.award_index
  then raise exception 'Exact current Owner pack award required';end if;
 return new;
end$$;
create trigger commercial_pack_award_origin before insert on commercial_billing.packs
 for each row execute function commercial_billing.pack_award_pack_guard();
create function commercial_billing.pack_award_complete() returns trigger
language plpgsql security definer set search_path='' as $$begin
 if(select count(*) from commercial_billing.packs where award_id=new.id)<>jsonb_array_length(new.products)
  then raise exception 'Every awarded pack must be allocated atomically';end if;
 return null;
end$$;
create constraint trigger commercial_pack_award_complete after insert on commercial_billing.pack_awards
 deferrable initially deferred for each row execute function commercial_billing.pack_award_complete();

revoke all on function commercial_billing.pack_award_actor(uuid),commercial_billing.pack_award_recipient(uuid,uuid,text,text),
 commercial_billing.create_pack_award(uuid,jsonb,text,jsonb,text,text),commercial_billing.pack_award_pack_guard(),commercial_billing.pack_award_complete()
 from public,anon,authenticated,service_role,docked_app,docked_beta_app,docked_commercial_app;
grant execute on function commercial_billing.pack_award_actor(uuid),commercial_billing.pack_award_recipient(uuid,uuid,text,text),
 commercial_billing.create_pack_award(uuid,jsonb,text,jsonb,text,text) to docked_commercial_app;

-- Reporting preserves paid-sale meanings and labels awards explicitly.
create or replace function private.public_admin_records()
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
 select p.id::text,'packs',coalesce(p.product->>'name','Commercial pack'),case when p.award_id is null then 'Paid credits · permanent allocation' else 'Free pack award · permanent allocation' end,
  jsonb_build_object('Record ID',p.id,'Member reference',p.member_id,'Request',p.request,'Price credits',p.price,
   'Card count',(select count(*) from commercial_billing.cards c where c.pack=p.id),'Product card count',p.product->'cards',
   'Created at',p.created_at,'Opened at',p.opened_at,'Policy version',p.policy_version,
   'Award reference',p.award_id,'Award reason',(select a.reason from commercial_billing.pack_awards a where a.id=p.award_id))
 from commercial_billing.packs p
 union all
 select r.key,'transactions','Google credit purchase',concat_ws(' · ',r.state,r.order_id),
  jsonb_build_object('Record ID',r.key,'Member reference',r.member_id,'Order reference',r.order_id,'State',r.state,
   'Environment',r.environment,'Gross AUD cents',r.gross_cents,'GST cents',r.tax_cents,
   'Refunded AUD cents',r.refunded_cents,'Credited',r.credited,'Created at',r.created_at,
   'Recovery hold',(select state from commercial_billing.recovery_cases c where c.receipt=r.key))
 from commercial_billing.receipts r;
end$$;

create or replace function private.owner_command_centre(p_start timestamptz,p_end timestamptz,p_sport text default null,p_include_staff boolean default false)
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
   'paidPacks',(select count(*) from commercial_billing.packs where created_at>=p_start and created_at<p_end and award_id is null),
   'awardedPacks',(select count(*) from commercial_billing.packs where created_at>=p_start and created_at<p_end and award_id is not null),
   'commercialCards',(select count(*) from commercial_billing.cards),
   'lifetimeIssued',(select sum(issued) from commercial_billing.definitions),
   'openSales',(select sales_enabled::int from commercial_billing.control where id),
   'openIssuance',(select issuance_enabled::int from commercial_billing.control where id)),
  'limitations',jsonb_build_array('Historical beta assets are excluded from commercial customer records. Lifetime counts include their permanent supply consumption.',
   'Marketplace and real scored competitions remain disabled. Use billing review for provider reconciliation and incident review for delivery evidence.'));
end$$;

create or replace function private.owner_commercial_summary(p_start timestamptz, p_end timestamptz)
returns jsonb language plpgsql stable security definer set search_path='' set statement_timeout='5s' as $$
declare result jsonb;
begin
  perform private.public_owner_actor();
  if p_start is null or p_end is null or p_start >= p_end or p_end-p_start > interval '367 days' then
    raise exception 'Invalid reporting period';
  end if;
  if not exists(select 1 from commercial_billing.control where id and environment='commercial') then
    raise exception 'Commercial reporting environment required';
  end if;
  with customers as (
    select p.id, p.created_at from public.profiles p
    where launch_transition.identity_allowed(p.id)
      and not exists (select 1 from private.roles r where r.user_id=p.id)
  ), cash as (
    select j.created_at, l.amount, r.tax_cents, r.gross_cents
    from commercial_billing.journals j
    join commercial_billing.lines l on l.journal=j.id and l.account='provider:google:receivable'
    join commercial_billing.receipts r on r.key=j.receipt and r.environment='commercial' and r.money_recorded
    where j.unit='AUD_CENTS' and j.created_at>=p_start and j.created_at<p_end
  ), days as (
    select d::date as business_day from generate_series((p_start at time zone 'Australia/Sydney')::date::timestamp,
      ((p_end - interval '1 microsecond') at time zone 'Australia/Sydney')::date::timestamp, interval '1 day') d
  ), growth as (
    select (created_at at time zone 'Australia/Sydney')::date as business_day,count(*) n from customers
    where created_at>=p_start and created_at<p_end group by 1
  ), sales as (
    select (created_at at time zone 'Australia/Sydney')::date as business_day,
      sum(greatest(amount,0)) gross, sum(greatest(-amount,0)) refunds from cash group by 1
  )
  select jsonb_build_object(
    'days',(select jsonb_agg(jsonb_build_object('day',d.business_day,'customers',coalesce(g.n,0),
      'sales',coalesce(s.gross,0),'refunds',coalesce(s.refunds,0)) order by d.business_day)
      from days d left join growth g using(business_day) left join sales s using(business_day)),
    'verified',(select count(*) from customers c where private.public_phone_verified(c.id)),
    'outstanding',(select coalesce(sum(l.remaining),0) from commercial_billing.lots l
      join commercial_billing.receipts r on r.key=l.receipt where r.environment='commercial' and r.money_recorded),
    'chargeTax',(select case when count(*)=count(tax_cents) then coalesce(sum(tax_cents),0) end from cash where amount>0),
    'pending',(select count(*) from commercial_billing.receipts where environment='commercial' and state='PENDING'),
    'packs',(select coalesce(jsonb_agg(to_jsonb(x) order by x.sport,x.type),'[]'::jsonb) from
      (select product->>'sport' sport,product->>'type' type,count(*) total from commercial_billing.packs
       where created_at>=p_start and created_at<p_end and award_id is null group by 1,2) x),
    'awardedPacks',(select count(*) from commercial_billing.packs where created_at>=p_start and created_at<p_end and award_id is not null),
    'support',(select count(*) from private.owner_support_events where created_at>=p_start and created_at<p_end),
    'moderation',(select count(*) from private.social_reports where created_at>=p_start and created_at<p_end),
    'sms',(select jsonb_build_object('budget',budget_aud_cents,'reserved',reserved_aud_cents,'expires',expires_at)
      from sms_delivery.windows where enabled and allowlist is null and starts_at<=statement_timestamp()
      and expires_at>statement_timestamp() order by starts_at desc limit 1)
  ) into result;
  return result;
end$$;

-- Customer support history records awards without inventing wallet activity.
create or replace function private.admin_record_detail(p_category text,p_id text,p_page integer default 1)
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
   union all select 'pack-award:'||e.id,e.created_at,'Free packs issued',
    concat(jsonb_array_length(e.products),' pack(s) · ',e.reason,' · ',e.reference,' · Owner ',e.actor)
    from commercial_billing.pack_awards e where p_category='members' and e.member_id::text=p_id
   union all select 'receipt:'||e.id,e.observed_at,e.state,'Verified provider observation' from commercial_billing.receipt_events e where p_category='transactions' and e.receipt=p_id
   union all select 'custody:'||e.id,e.created_at,'Ownership recorded',e.reference from commercial_billing.ownership_events e where p_category='cards' and e.card::text=p_id
  )h order by at desc,id limit 21 offset(p_page-1)*20)e;
 return jsonb_build_object('id',item.id,'category',item.category,'title',item.title,'source','Public commercial records; historical beta assets excluded',
  'fields',item.fields,'history',(select coalesce(jsonb_agg(value),'[]') from jsonb_array_elements(events)with ordinality e(value,n) where n<=20),
  'page',p_page,'hasMore',jsonb_array_length(events)>20);
end$$;

-- CREATE OR REPLACE preserves existing ACLs; spell out the intended boundary
-- as well so installations cannot inherit default PUBLIC function execution.
revoke all on function private.public_admin_records(),private.owner_command_centre(timestamptz,timestamptz,text,boolean),
 private.owner_commercial_summary(timestamptz,timestamptz),private.admin_record_detail(text,text,integer)
 from public,anon,authenticated,service_role,docked_app,docked_beta_app,docked_commercial_app;
grant execute on function private.owner_command_centre(timestamptz,timestamptz,text,boolean),
 private.owner_commercial_summary(timestamptz,timestamptz),private.admin_record_detail(text,text,integer) to docked_app;
