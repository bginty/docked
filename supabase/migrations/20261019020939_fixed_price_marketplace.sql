-- Fixed-price release. No settled ledger, ownership, score or competition mutations.
-- Run the existing cancellation workflow for any pending offers before activation.
do $$ begin
 if exists(select 1 from credits_sandbox.state s,jsonb_each(s.document->'swaps') o where o.value->>'status'='OPEN')
 or exists(select 1 from credits_sandbox.state s,jsonb_each(coalesce(s.document->'privateCardOffers','{}')) o where o.value->>'status'='OPEN')
 or exists(select 1 from credits_sandbox.state s,jsonb_each(s.document->'listings') l where l.value->>'status'='OPEN' and coalesce(l.value->>'preference','sell')<>'sell')
 or exists(select 1 from beta_fantasy.swaps where state='pending') then
 raise exception 'Cancel pending offers and non-credit listings through existing cancellation before applying fixed-price migration';end if;
end $$;

create table if not exists credits_sandbox.listing_terms_audit(
 id bigint generated always as identity primary key,listing text not null,revision integer not null,
 actor text not null,previous_terms jsonb,new_terms jsonb not null,recorded_at timestamptz not null default clock_timestamp(),unique(listing,revision)
);
alter table credits_sandbox.listing_terms_audit enable row level security;
revoke all on credits_sandbox.listing_terms_audit from public,anon,authenticated,service_role,docked_beta_app;
drop trigger if exists immutable on credits_sandbox.listing_terms_audit;
create trigger immutable before update or delete on credits_sandbox.listing_terms_audit for each row execute function beta_private.immutable();
create or replace function credits_sandbox.marketplace_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare item record; prior jsonb; l jsonb; cid text;begin
 perform pg_advisory_xact_lock(71820342);
 if exists(select 1 from jsonb_each(new.document->'listings') x where x.value->>'status'='OPEN' group by x.value->>'card' having count(*)>1) then raise exception 'One active listing per card';end if;
 for item in select key,value from jsonb_each(old.document->'requests') loop
  if new.document->'requests'->item.key is distinct from item.value then raise exception 'Transaction identity and receipt immutable';end if;
 end loop;
 for item in select key,value from jsonb_each(new.document->'listings') loop
  l:=item.value;prior:=old.document->'listings'->item.key;
  if jsonb_typeof(l->'price') is distinct from 'number' or (l->>'price')::numeric not between 0 and 1000000000 or trunc((l->>'price')::numeric)<>(l->>'price')::numeric then raise exception 'Positive integer credit price required';end if;
  if coalesce(l->>'preference','sell') not in ('sell','swap','both') or ((coalesce(l->>'preference','sell')='swap') <> ((l->>'price')::numeric=0)) then raise exception 'Listing preference and price mismatch';end if;
  if l->>'status' is null or l->>'status' not in('OPEN','SOLD','CANCELLED') then raise exception 'Invalid listing status';end if;
  if prior is not null and ((prior-array['status','buyer','receipt','cancelledAt','price','revision','feePolicy']) is distinct from (l-array['status','buyer','receipt','cancelledAt','price','revision','feePolicy']) or (prior->>'status'<>'OPEN' and prior is distinct from l)) then raise exception 'Listing terms and closed history immutable';end if;
  if l->>'status'='OPEN' and (coalesce(l->>'preference','sell')<>'sell' or (l->>'price')::bigint<1) then raise exception 'Only fixed-price credit listings supported';end if;
  if prior is not null and prior->>'status'='OPEN' and l->>'status'<>'OPEN' and (prior->'price' is distinct from l->'price' or prior->'revision' is distinct from l->'revision' or prior->'feePolicy' is distinct from l->'feePolicy') then raise exception 'Closing listing terms immutable';end if;
  if prior is not null and prior->>'status'='OPEN' and l->>'status'='OPEN' and l is distinct from prior then
   if coalesce((l->>'revision')::int,0)<>coalesce((prior->>'revision')::int,0)+1 then raise exception 'Listing revision required';end if;
   if auth.uid() is not null and auth.uid()::text<>l->>'member' then raise exception 'Only the seller may edit this listing';end if;
   if l->>'feePolicy'<>'credit-sale-5pct-cap2000-v2' then raise exception 'Current fee policy required';end if;
  end if;
  if l->>'status'='OPEN' and (new.document#>>array['commerce','cards',l->>'card','owner'] is distinct from l->>'member' or new.document#>>array['cards',l->>'card','version'] is distinct from l->>'version') then raise exception 'Listing ownership/version required';end if;
  if prior is null then
   if l->>'feePolicy' is distinct from 'credit-sale-5pct-cap2000-v2' or l->>'revision' is distinct from '1' then raise exception 'Current fee policy and initial revision required';end if;
   if l->>'status'<>'OPEN' or new.document#>>array['commerce','cards',l->>'card','tier']='CORE' then raise exception 'Eligible limited test card required';end if;
   if sports_feed.card_entry_reserved((l->>'card')::uuid) then raise exception 'Card used by an unlocked submitted team';end if;
   if exists(select 1 from jsonb_each(new.document->'swaps') x where x.value->>'status'='OPEN' and (x.value->>'expires')::numeric>extract(epoch from clock_timestamp())*1000 and ((x.value->'give')||(x.value->'take')) ? (l->>'card')) then raise exception 'Card reserved by active swap';end if;
  end if;
  if l->>'status'='SOLD' and prior->>'status'='OPEN' then
   if l#>>'{receipt,feePolicy}' is distinct from 'credit-sale-5pct-cap2000-v2' then raise exception 'Recorded fee policy required';end if;
   if jsonb_typeof(l->'receipt') is distinct from 'object' or not (l->'receipt') ?& array['reference','at','price','fee','net'] or (l->'receipt'->>'price')::bigint<>(l->>'price')::bigint or (l->'receipt'->>'fee')::bigint<>least(2000,round((l->>'price')::numeric*0.05)) or (l->'receipt'->>'net')::bigint<>(l->>'price')::bigint-(l->'receipt'->>'fee')::bigint then raise exception 'Exact sale receipt required';end if;
   if new.document#>>array['commerce','cards',l->>'card','owner'] is distinct from l->>'buyer' or l->>'buyer'=l->>'member' then raise exception 'Sale ownership required';end if;
   if not exists(select 1 from credits_sandbox.journal j where j.id=l->'receipt'->>'reference') then raise exception 'Sale journal required';end if;
  end if;
 end loop;
 if exists(select 1 from jsonb_object_keys(old.document->'listings') k where not (new.document->'listings') ? k) then raise exception 'Listing history cannot be removed';end if;
 for item in select key,value from jsonb_each(new.document->'swaps') where value->>'status'='OPEN' and (value->>'expires')::numeric>extract(epoch from clock_timestamp())*1000 loop
  if old.document->'swaps'->item.key is null then
   for cid in select jsonb_array_elements_text((item.value->'give')||(item.value->'take')) loop
    if sports_feed.card_entry_reserved(cid::uuid) then raise exception 'Card used by an unlocked submitted team';end if;
   end loop;
  end if;
 end loop;
 for item in select key,value from jsonb_each(coalesce(new.document->'swaps','{}')) loop
  prior:=old.document->'swaps'->item.key;
  if (prior is null and item.value->>'status'='OPEN') or (prior->>'status'='OPEN' and item.value->>'status'='ACCEPTED') then raise exception 'New swaps and swap acceptance disabled';end if;
 end loop;
 for item in select key,value from jsonb_each(coalesce(new.document->'privateCardOffers','{}')) loop
  prior:=old.document->'privateCardOffers'->item.key;
  if (prior is null and item.value->>'status'='OPEN') or (prior->>'status'='OPEN' and item.value->>'status'='ACCEPTED') then raise exception 'Private offers disabled';end if;
 end loop;
 return new;
end$$;


create or replace function credits_sandbox.audit_listing_terms() returns trigger language plpgsql security definer set search_path='' as $$
declare x record;p jsonb;begin
 for x in select key,value from jsonb_each(new.document->'listings') loop
  p:=old.document->'listings'->x.key;
  if x.value->>'status'='OPEN' and (p is null or (p->'price',p->'revision',p->'feePolicy') is distinct from (x.value->'price',x.value->'revision',x.value->'feePolicy')) then
   insert into credits_sandbox.listing_terms_audit(listing,revision,actor,previous_terms,new_terms) values(x.key,coalesce((x.value->>'revision')::int,0),coalesce(auth.uid()::text,'fixed-price-release-migration'),p,x.value);
  end if;
 end loop;return new;end $$;
revoke all on function credits_sandbox.audit_listing_terms() from public,anon,authenticated,service_role,docked_beta_app;
drop trigger if exists audit_listing_terms on credits_sandbox.state;
create trigger audit_listing_terms after update on credits_sandbox.state for each row execute function credits_sandbox.audit_listing_terms();

-- Audit and refresh unsettled terms only; old completed receipts remain byte-identical.
do $$ declare d jsonb;x record;begin
 perform pg_advisory_xact_lock(71820342);
 select document into d from credits_sandbox.state where id for update;
 if d is not null then
  for x in select key,value from jsonb_each(d->'listings') where value->>'status'='OPEN' and value->>'feePolicy' is distinct from 'credit-sale-5pct-cap2000-v2' loop
   d:=jsonb_set(d,array['listings',x.key],x.value||jsonb_build_object('revision',coalesce((x.value->>'revision')::int,0)+1,'feePolicy','credit-sale-5pct-cap2000-v2'));
  end loop;
  d:=jsonb_set(d,'{policy,commissionBps}','500');
  update credits_sandbox.state set document=d,revision=revision+1 where id and document is distinct from d;
 end if;
end $$;
update credits_sandbox.trading_control set swap=false,combined=false,revision=revision+1 where id and (swap or combined);

-- Listing publication is independent of collection privacy. Only the listed card is public.
-- Admission, disabled accounts, moderation and bilateral blocking remain enforced.
create or replace function credits_sandbox.market_card_visible(seller uuid,card_id text)
returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(beta_private.active_member_session(),false)
 and beta_private.admitted(auth.uid()) and beta_private.admitted(seller)
 and exists(select 1 from credits_sandbox.access where user_id=seller and enabled)
 and exists(select 1 from beta_public.profiles where id=seller and disabled_at is null)
 and not exists(select 1 from beta_private.social_profiles where user_id=seller and status not in('active','restricted'))
 and not exists(select 1 from beta_private.social_blocks b join beta_private.social_profiles a on a.id=b.actor_id join beta_private.social_profiles z on z.id=b.target_id where (a.user_id=auth.uid() and z.user_id=seller) or (a.user_id=seller and z.user_id=auth.uid()))
 and exists(select 1 from credits_sandbox.state s,jsonb_each(s.document->'listings') l where l.value->>'card'=card_id and l.value->>'member'=seller::text and l.value->>'status'='OPEN' and (l.value->>'price')::numeric>0 and l.value->>'privateOffer' is null);
$$;
revoke all on function credits_sandbox.market_card_visible(uuid,text) from public,anon,authenticated,service_role;
grant execute on function credits_sandbox.market_card_visible(uuid,text) to docked_beta_app;

do $$begin
 if to_regprocedure('credits_sandbox.market_context_before_fixed_price(uuid)') is null then
  alter function credits_sandbox.market_context(uuid) rename to market_context_before_fixed_price;
 end if;end $$;
create or replace function credits_sandbox.market_context(u uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare answer jsonb;begin
 if u is distinct from auth.uid() or not coalesce(beta_private.active_member_session(),false) then raise exception 'Active authenticated session required';end if;
 answer:=credits_sandbox.market_context_before_fixed_price(u);
 return answer||jsonb_build_object('labels',coalesce((select jsonb_agg(jsonb_build_object('id',a.user_id,'label',coalesce(n.name,'Docked member'))) from credits_sandbox.access a left join beta_fantasy.team_names n on n.user_id=a.user_id where a.enabled),'[]'));
end $$;
revoke all on function credits_sandbox.market_context_before_fixed_price(uuid),credits_sandbox.market_context(uuid) from public,anon,authenticated,service_role,docked_beta_app;
grant execute on function credits_sandbox.market_context(uuid) to docked_beta_app;

-- Direct free-swap callers cannot bypass the retired HTTP interface.
create or replace function beta_fantasy.fixed_price_swap_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if (tg_op='INSERT' and new.state='pending') or (tg_op='UPDATE' and old.state='pending' and new.state='accepted') then raise exception 'New swaps and acceptance disabled';end if;
 return new;end $$;
revoke all on function beta_fantasy.fixed_price_swap_guard() from public,anon,authenticated,service_role,docked_beta_app;
drop trigger if exists fixed_price_swap_guard on beta_fantasy.swaps;
create trigger fixed_price_swap_guard before insert or update on beta_fantasy.swaps for each row execute function beta_fantasy.fixed_price_swap_guard();
