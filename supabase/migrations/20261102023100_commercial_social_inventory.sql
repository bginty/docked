-- Additive projection only; no inventory, balance, activation or historical snapshot mutation.
-- Public runtime never receives access to the legacy credits_sandbox.
create or replace function commercial_billing.social_inventory(target uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare viewer uuid; cards jsonb;
begin
 if auth.uid() is null or not private.active_member_session() then raise exception 'Authenticated member required';end if;
 viewer:=private.community_actor(auth.uid(),'public_profiles',false);
 if viewer is null then raise exception 'Profile access required';end if;
 -- Locks last through the caller's post transaction, including snapshot insert.
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',c.id,'definition',c.definition,'serial',c.serial,'sport',c.sport,
  'player_id',c.player_id,'rarity',c.rarity,'lifetime_cap',c.lifetime_cap,'snapshot',c.snapshot
 ) order by c.id),'[]') into cards from (
  select i.id,i.definition,i.serial,d.sport,d.player_id,d.rarity,d.lifetime_cap,d.snapshot
  from commercial_billing.cards i
  join commercial_billing.definitions d on d.id=i.definition
  join commercial_billing.packs p on p.id=i.pack
  where i.owner_id=target and p.opened_at is not null and d.sport in('nfl','afl','nrl')
  order by i.id for share of i
 ) c;
 return private.social_collection_cards(target,cards);
end$$;
revoke all on function commercial_billing.social_inventory(uuid) from public,anon,authenticated,service_role,docked_beta_app,docked_commercial_app;
grant usage on schema commercial_billing to docked_app;
grant execute on function commercial_billing.social_inventory(uuid) to docked_app;
