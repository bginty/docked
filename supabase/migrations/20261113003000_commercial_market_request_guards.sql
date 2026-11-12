-- PREPARED ONLY. Separate founder approval is required before deployment.
-- No listing, balance, ownership, approval or control row is changed here.
create unique index if not exists commercial_market_request_identity
 on commercial_billing.audit(actor,reference) where action='market-request';
create index if not exists commercial_market_listing_activity
 on commercial_billing.audit((details->'result'->>'listing'),created_at,id) where action='market-request';

create or replace function commercial_billing.market_party_allowed(viewer uuid,target uuid,terms_version text,privacy_version text)
returns boolean language sql stable security definer set search_path='' as $$
 select viewer is not null and viewer=auth.uid() and private.active_member_session()
 and exists(select 1 from public.profiles p join auth.users u on u.id=p.id
  where p.id=target and p.disabled_at is null and p.country='AU' and p.age_attested
   and p.accepted_version=terms_version and u.email_confirmed_at is not null
   and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until<=clock_timestamp())
   and private.public_phone_verified(p.id)
   and exists(select 1 from private.consent_events c where c.user_id=p.id and c.purpose='privacy'
    and c.granted and c.version=privacy_version and c.id=(select id from private.consent_events
     where user_id=p.id and purpose='privacy' order by created_at desc,id desc limit 1))
   and exists(select 1 from lateral(select * from private.region_policies r
    where r.country=p.country and r.state=p.state and r.effective_from<=clock_timestamp()
     and r.effective_to>clock_timestamp() order by r.effective_from desc,r.id desc limit 1)r
    where not r.preview_community_only and r.approved and r.minimum_age=18 and r.review_at>clock_timestamp()))
 and not exists(select 1 from private.social_profiles where user_id=target and status not in('active','restricted'))
 and not exists(select 1 from private.social_blocks b join private.social_profiles a on a.id=b.actor_id
  join private.social_profiles z on z.id=b.target_id where
   (a.user_id=viewer and z.user_id=target) or (a.user_id=target and z.user_id=viewer))
$$;
revoke all on function commercial_billing.market_party_allowed(uuid,uuid,text,text)
 from public,anon,authenticated,service_role,docked_app,docked_beta_app,docked_commercial_app;
grant execute on function commercial_billing.market_party_allowed(uuid,uuid,text,text) to docked_commercial_app;

create or replace function commercial_billing.market_listing_guard() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
  if new.state<>'OPEN' or new.revision<>1 or new.buyer is not null or new.fee is not null
   or new.net is not null or new.sold_at is not null or new.funding is not null
  then raise exception 'New commercial listing must be open and unsettled';end if;
  if not exists(select 1 from commercial_billing.cards c join commercial_billing.packs p on p.id=c.pack
   join commercial_billing.definitions d on d.id=c.definition
   where c.id=new.card and c.owner_id=new.seller and not c.locked and p.opened_at is not null
    and d.sport in('nfl','afl','nrl')) then raise exception 'Owned opened commercial card required';end if;
 else
  if old.state<>'OPEN' then raise exception 'Closed commercial listing history immutable';end if;
  if (to_jsonb(new)-array['state','price','revision','buyer','fee','net','sold_at','funding'])
   is distinct from (to_jsonb(old)-array['state','price','revision','buyer','fee','net','sold_at','funding'])
  then raise exception 'Commercial listing identity immutable';end if;
  if new.state='OPEN' then
   if new.revision<>old.revision+1 or
    (to_jsonb(new)-array['price','revision']) is distinct from (to_jsonb(old)-array['price','revision'])
   then raise exception 'Exact next listing revision required';end if;
  else
   if new.price<>old.price or new.revision<>old.revision then raise exception 'Closing listing terms immutable';end if;
   if new.state='CANCELLED' and (to_jsonb(new)-'state') is distinct from (to_jsonb(old)-'state')
   then raise exception 'Cancellation cannot change settlement values';end if;
   if new.state='SOLD' then
    if new.buyer is null or new.buyer=new.seller or new.fee is distinct from least(2000,round(new.price::numeric*0.05))
     or new.net is distinct from new.price-new.fee or new.sold_at is null or jsonb_typeof(new.funding) is distinct from 'array'
     or not exists(select 1 from commercial_billing.cards where id=new.card and owner_id=new.buyer)
     or not exists(select 1 from commercial_billing.ownership_events where card=new.card and from_member=new.seller and to_member=new.buyer and reference='sale:'||new.id)
     or not exists(select 1 from commercial_billing.journals where id='sale:'||new.id and unit='CREDITS')
    then raise exception 'Exact commercial settlement evidence required';end if;
   end if;
  end if;
 end if;
 return new;
end $$;
revoke all on function commercial_billing.market_listing_guard()
 from public,anon,authenticated,service_role,docked_app,docked_beta_app,docked_commercial_app;
drop trigger if exists commercial_listing_terms on commercial_billing.listings;
create trigger commercial_listing_terms before insert or update on commercial_billing.listings
 for each row execute function commercial_billing.market_listing_guard();
