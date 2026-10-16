-- LOCAL REVIEW ONLY. No assets or existing privacy preferences are rewritten.
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
  if prior is not null and ((prior-array['status','buyer','receipt','cancelledAt']) is distinct from (l-array['status','buyer','receipt','cancelledAt']) or (prior->>'status'<>'OPEN' and prior is distinct from l)) then raise exception 'Listing terms and closed history immutable';end if;
  if l->>'status'='OPEN' and (new.document#>>array['commerce','cards',l->>'card','owner'] is distinct from l->>'member' or new.document#>>array['cards',l->>'card','version'] is distinct from l->>'version') then raise exception 'Listing ownership/version required';end if;
  if prior is null then
   if l->>'status'<>'OPEN' or new.document#>>array['commerce','cards',l->>'card','tier']='CORE' then raise exception 'Eligible limited test card required';end if;
   if sports_feed.card_entry_reserved((l->>'card')::uuid) then raise exception 'Card used by an unlocked submitted team';end if;
   if exists(select 1 from jsonb_each(new.document->'swaps') x where x.value->>'status'='OPEN' and (x.value->>'expires')::numeric>extract(epoch from clock_timestamp())*1000 and ((x.value->'give')||(x.value->'take')) ? (l->>'card')) then raise exception 'Card reserved by active swap';end if;
  end if;
  if l->>'status'='SOLD' and prior->>'status'='OPEN' then
   if jsonb_typeof(l->'receipt') is distinct from 'object' or not (l->'receipt') ?& array['reference','at','price','fee','net'] or (l->'receipt'->>'price')::bigint<>(l->>'price')::bigint or (l->'receipt'->>'fee')::bigint<>round((l->>'price')::numeric*0.075) or (l->'receipt'->>'net')::bigint<>(l->>'price')::bigint-(l->'receipt'->>'fee')::bigint then raise exception 'Exact sale receipt required';end if;
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
 return new;
end$$;

-- Every collection projection uses the same admitted-viewer and per-card filter.
do $migration$
declare ns text; runtime_role text;
begin
foreach ns in array array['private','beta_private'] loop
 runtime_role:=case when ns='private' then 'docked_app' else 'docked_beta_app' end;
 execute format($sql$
 alter table %1$I.social_collection_settings add column mute_offers boolean not null default false,
   add column visibility_acknowledged_at timestamptz;
 create function %1$I.social_collection_cards(target uuid, cards jsonb) returns jsonb language plpgsql security definer set search_path='' as $fn$
 declare viewer uuid; owner_profile uuid; prefs %1$I.social_collection_settings;
 begin
   if auth.uid() is null then return '[]'; end if;
   if target=auth.uid() then return cards; end if;
   if not %1$I.community_feature_allowed(auth.uid(),'public_profiles') then return '[]'; end if;
   select id into viewer from %1$I.social_profiles where user_id=auth.uid() and status in ('active','restricted');
   if viewer is null then return '[]'; end if;
   select id into owner_profile from %1$I.social_profiles where user_id=target;
   select * into prefs from %1$I.social_collection_settings where profile_id=owner_profile;
   if not coalesce(%1$I.social_profile_visible(viewer,owner_profile,true) and
     (prefs.visibility='members' or (prefs.visibility='followers' and exists(select 1 from %1$I.social_follows where actor_id=viewer and target_id=owner_profile))),false) then return '[]'; end if;
   return coalesce((select jsonb_agg(c) from jsonb_array_elements(cards) c
     where coalesce(prefs.card_preferences->(c->>'id')->>'hidden','false')<>'true'),'[]');
 end $fn$;
 revoke all on function %1$I.social_collection_cards(uuid,jsonb) from public,anon,authenticated,service_role;
 grant execute on function %1$I.social_collection_cards(uuid,jsonb) to %2$I;
 alter function %1$I.social_legacy_cards(uuid) rename to social_legacy_cards_before_card_privacy;
 revoke all on function %1$I.social_legacy_cards_before_card_privacy(uuid) from public,anon,authenticated,service_role,%2$I;
 create function %1$I.social_legacy_cards(target uuid) returns jsonb language sql security definer set search_path='' as $fn$
   select %1$I.social_collection_cards(target,%1$I.social_legacy_cards_before_card_privacy(target))
 $fn$;
 revoke all on function %1$I.social_legacy_cards(uuid) from public,anon,authenticated,service_role;
 grant execute on function %1$I.social_legacy_cards(uuid) to %2$I;
 $sql$,ns,runtime_role);
end loop;
end $migration$;

-- Defense in depth: signed-off offer terms and completed outcomes are immutable.
create function credits_sandbox.private_offer_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare item record; prior jsonb; o jsonb; offered jsonb; receipt jsonb;
begin
 for item in select key,value from jsonb_each(coalesce(old.document->'privateCardOffers','{}')) loop
  o:=new.document->'privateCardOffers'->item.key; prior:=item.value;
  if o is null or (o-array['status','closed','receipt','listing']) is distinct from (prior-array['status','closed','receipt','listing']) then raise exception 'Private offer terms immutable'; end if;
  if prior->>'status'<>'OPEN' and o is distinct from prior then raise exception 'Completed private offer immutable'; end if;
 end loop;
 for item in select key,value from jsonb_each(coalesce(new.document->'privateCardOffers','{}')) loop
  o:=item.value; prior:=old.document->'privateCardOffers'->item.key;
  if o->>'id' is distinct from item.key or o->>'buyer'=o->>'seller' or o->>'status' not in ('OPEN','ACCEPTED','DECLINED','CANCELLED','EXPIRED') then raise exception 'Invalid private offer'; end if;
  if prior is null and o->>'status'<>'OPEN' then raise exception 'Private offer must start open'; end if;
  if jsonb_typeof(o->'price') is distinct from 'number' or (o->>'price')::numeric not between 0 and 1000000000 or trunc((o->>'price')::numeric)<>(o->>'price')::numeric then raise exception 'Invalid credit component'; end if;
  offered:=coalesce(o->'offeredCards','[]');
  if jsonb_typeof(offered)<>'array' or jsonb_array_length(offered)>1 or ((o->>'price')::numeric=0 and jsonb_array_length(offered)=0) then raise exception 'One offered card supported'; end if;
  if o->>'status'='ACCEPTED' and prior->>'status'='OPEN' then
   if jsonb_array_length(offered)>0 then
    receipt:=new.document->'swaps'->(o->>'receipt');
    if receipt->>'status' is distinct from 'ACCEPTED' or receipt->>'member' is distinct from o->>'buyer' or receipt->>'other' is distinct from o->>'seller' or receipt->'take' is distinct from jsonb_build_array(o->>'card') or receipt->'give' is distinct from jsonb_build_array(offered->0->>'id') or coalesce(receipt->>'creditTopUp','0')<>o->>'price' then raise exception 'Offer exchange receipt mismatch'; end if;
   else
    receipt:=new.document->'listings'->(o->>'listing');
    if receipt->>'status' is distinct from 'SOLD' or receipt->>'privateOffer' is distinct from item.key or receipt->>'buyer' is distinct from o->>'buyer' or receipt->>'member' is distinct from o->>'seller' or receipt->>'card' is distinct from o->>'card' or receipt->'price' is distinct from o->'price' then raise exception 'Offer sale receipt mismatch'; end if;
   end if;
  end if;
 end loop;
 return new;
end $$;
revoke all on function credits_sandbox.private_offer_guard() from public,anon,authenticated,service_role;
create trigger private_offer_integrity before update on credits_sandbox.state for each row execute function credits_sandbox.private_offer_guard();

-- No existing competition is opted in. Publication requires an explicit reviewed
-- competition policy and ALL saved rolling locks, as well as its entry deadline.
create table beta_fantasy.lineup_publication_policy (
 competition_id uuid primary key references beta_fantasy.competitions,
 enabled boolean not null default false,
 policy_version text not null check(length(trim(policy_version))>0),
 authority_note text not null check(length(trim(authority_note))>=10),
 approved_at timestamptz not null default clock_timestamp()
);
alter table beta_fantasy.lineup_publication_policy enable row level security;
revoke all on beta_fantasy.lineup_publication_policy from public,anon,authenticated,service_role,docked_app,docked_beta_app;
do $migration$
declare ns text; runtime_role text;
begin
foreach ns in array array['private','beta_private'] loop
 runtime_role:=case when ns='private' then 'docked_app' else 'docked_beta_app' end;
 execute format($sql$
 create function %1$I.social_locked_lineups(target uuid) returns jsonb language plpgsql security definer set search_path='' as $fn$
 declare viewer uuid; owner_user uuid;
 begin
  viewer:=%1$I.community_actor(auth.uid(),'public_profiles',false);
  if not %1$I.social_profile_visible(viewer,target,false) then return '[]';end if;
  select user_id into owner_user from %1$I.social_profiles where id=target;
  if not beta_private.admitted(auth.uid()) or not beta_private.admitted(owner_user) then return '[]';end if;
  return coalesce((select jsonb_agg(jsonb_build_object('competition',c.id,'name',c.name,'sport',c.sport,'season',c.season,'round',c.round,'mode',c.rules->>'mode','locksAt',c.locks_at,'players',locked.players) order by c.locks_at desc,c.id)
   from beta_fantasy.entries e
   join beta_fantasy.competitions c on c.id=e.competition_id
   join beta_fantasy.lineup_publication_policy policy on policy.competition_id=c.id and policy.enabled and policy.approved_at<=clock_timestamp()
   join beta_fantasy.lineup_configurations cfg on cfg.version=c.rules->>'lineup_version'
   cross join lateral (select count(*) n,jsonb_agg(jsonb_build_object('slot',l.slot,'name',l.snapshot->>'name','position',l.snapshot->>'position','tier',l.snapshot->>'tier','team',l.snapshot->>'team','multiplierTenths',l.snapshot->'multiplierTenths') order by l.slot) players
    from beta_fantasy.slot_locks l where l.competition_id=c.id and l.user_id=e.user_id and l.locked_at<=clock_timestamp()
    and (l.snapshot->>'kickoff')::timestamptz<=clock_timestamp()
    and exists(select 1 from jsonb_array_elements(cfg.configuration->'slots') slot where slot->>'id'=l.slot)) locked
   where e.user_id=owner_user and c.locks_at<=clock_timestamp() and c.sport='nfl'
   and locked.n=jsonb_array_length(cfg.configuration->'slots') and locked.n>0
   and not exists(select 1 from beta_fantasy.round_controls rc where rc.competition_id=c.id and not rc.standings_visible)), '[]');
 end $fn$;
 revoke all on function %1$I.social_locked_lineups(uuid) from public,anon,authenticated,service_role;
 grant execute on function %1$I.social_locked_lineups(uuid) to %2$I;
 $sql$,ns,runtime_role);
end loop;
end $migration$;
