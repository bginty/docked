-- Additive compatibility only; this migration does not publish a policy,
-- approve a withdrawal schedule, update control rows, enable a feature, grant
-- runtime authority, mint a card, or change an existing card/pack/competition.
-- The original closed-loop branch is preserved. The new explicit cash scope
-- mirrors assertCommercialApproval in src/core/commercial-billing.ts, including
-- current decision references and an honest recorded assessment basis. Owner-
-- reviewed advice is allowed; a written Google response is not mandatory.
-- Cash payout eligibility and its approved numerical schedule are separately
-- enforced by the withdrawal ledger. All existing pack, supply, ownership,
-- session, competition, recovery and feature-switch guards remain unchanged.

create or replace function commercial_billing.card_guard() returns trigger language plpgsql set search_path='' as $$
declare d commercial_billing.definitions; p commercial_billing.packs; c commercial_billing.control;
begin
 if tg_op='UPDATE' then
  if (to_jsonb(new)-array['owner_id','locked'])<>(to_jsonb(old)-array['owner_id','locked']) then raise exception 'Permanent card identity immutable'; end if;
 else
  select * into strict c from commercial_billing.lock_control();
  if not c.issuance_enabled then raise exception 'Permanent issuance disabled'; end if;
  if coalesce((c.approvals->>'validUntil')::timestamptz,'-infinity')<=clock_timestamp()
   or exists(select 1 from unnest(array['owner','legal','googlePlay','privacy','retention','refundRecovery','playerRights','supplyReconciliation']) k where coalesce(length(c.approvals->>k),0)<8)
   or exists(select 1 from unnest(array['prizes','paidEntry','nba']) k where c.approvals->k is distinct from 'false'::jsonb)
   or (case c.policy_version
    when 'commercial-closed-loop-2026-11-01-v1' then c.approvals->'withdrawals' is distinct from 'false'::jsonb
    when 'commercial-cash-withdrawals-2026-11-21-v1' then
     c.approvals->'withdrawals' is distinct from 'true'::jsonb
     or not isfinite((c.approvals->>'validUntil')::timestamptz)
     or exists(select 1 from unnest(array['owner','legal','googlePlay','privacy','retention','refundRecovery','playerRights','supplyReconciliation']) k where jsonb_typeof(c.approvals->k) is distinct from 'string')
     or exists(select 1 from unnest(array['withdrawalPolicyVersion','ownerDecision','legalAssessment','playAssessment']) k
      where jsonb_typeof(c.approvals->k) is distinct from 'string'
       or coalesce(length(btrim(c.approvals->>k,E' \t\n\r\f\013' || U&'\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')),0)<8)
     or coalesce(c.approvals->>'withdrawalAssessmentBasis','') not in('owner-reviewed-advice','google-written-determination')
    else true
   end)
  then raise exception 'Commercial approvals required'; end if;
  select * into strict p from commercial_billing.packs where id=new.pack for update;
  select * into strict d from commercial_billing.definitions where id=new.definition for update;
  if p.issuance_txid<>txid_current() or p.opened_at is not null or p.member_id<>new.owner_id
   or p.product->>'sport' is distinct from d.sport or new.slot>=(p.product->>'cards')::int
   or p.draw_evidence->new.slot->>'rarity' is distinct from d.rarity
   then raise exception 'Card must match the current purchased pack and committed draw'; end if;
  if exists(select 1 from commercial_billing.cards x join commercial_billing.definitions y on y.id=x.definition where x.pack=p.id and y.player_id=d.player_id)
   then raise exception 'Duplicate pack player'; end if;
  if not d.approved or new.serial<>d.issued+1 or new.serial>d.lifetime_cap then raise exception 'Supply exhausted or definition not approved'; end if;
  update commercial_billing.definitions set issued=new.serial where id=d.id;
 end if; return new;
end$$;

create or replace function commercial_billing.lineup_inventory(u uuid,cid uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 with eligible as materialized (
  select v from jsonb_array_elements(sports_feed.free_core_inventory(u,cid)) v
 ), owned as (
  select e.v || jsonb_build_object('id',i.id,'card_id',i.id,'edition_id',d.id,
   'tier',d.rarity,'serial',i.serial,'max_supply',d.lifetime_cap,'collectible_owned',true,
   'inventory_source','commercial-owned-v1','tradeable',false,
   'listed',exists(select 1 from commercial_billing.listings l where l.card=i.id and l.state='OPEN'),
   'multiplierTenths',(r.document->'rarities'->d.rarity->>'multiplierTenths')::int,
   'multiplier',(r.document->'rarities'->d.rarity->>'multiplierTenths')::numeric/10,
   'rarityVersion',r.version) card
  from commercial_billing.cards i join commercial_billing.definitions d on d.id=i.definition
  join commercial_billing.packs p on p.id=i.pack
  join eligible e on e.v->>'player_id'=d.player_id::text and e.v->>'sport'=d.sport
  join credits_sandbox.rarity_configuration r on r.version='docked-lifetime-rarity-v1'
  where i.owner_id=u and p.opened_at is not null and not i.locked
   and not exists(select 1 from commercial_billing.recovery_cases where member_id=u and state='OPEN')
 )
 select case when u=auth.uid() and beta_private.active_member_session()
  and sports_feed.lineup_scope_allowed(cid) and exists(
   select 1 from beta_fantasy.competitions c,commercial_billing.control g where c.id=cid and g.id and g.gameplay_enabled
    and c.rules->>'commercial_inventory_policy'='commercial-owned-v1'
    and c.rules->>'free_core_policy'='public-free-core-v1'
    and c.sport in('nfl','afl','nrl') and c.scored_at is null and c.locks_at>clock_timestamp()
    and (
     -- Preserve the existing closed-loop eligibility branch exactly.
     (g.policy_version='commercial-closed-loop-2026-11-01-v1'
      and (g.approvals->>'validUntil')::timestamptz>clock_timestamp())
     or (
      g.policy_version='commercial-cash-withdrawals-2026-11-21-v1'
      and coalesce((g.approvals->>'validUntil')::timestamptz,'-infinity')>clock_timestamp()
      and isfinite((g.approvals->>'validUntil')::timestamptz)
      and not exists(select 1 from unnest(array['owner','legal','googlePlay','privacy','retention','refundRecovery','playerRights','supplyReconciliation']) k
       where jsonb_typeof(g.approvals->k) is distinct from 'string' or coalesce(length(g.approvals->>k),0)<8)
      and not exists(select 1 from unnest(array['prizes','paidEntry','nba']) k where g.approvals->k is distinct from 'false'::jsonb)
      and g.approvals->'withdrawals'='true'::jsonb
      and not exists(select 1 from unnest(array['withdrawalPolicyVersion','ownerDecision','legalAssessment','playAssessment']) k
       where jsonb_typeof(g.approvals->k) is distinct from 'string'
        or coalesce(length(btrim(g.approvals->>k,E' \t\n\r\f\013' || U&'\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')),0)<8)
      and g.approvals->>'withdrawalAssessmentBasis' in('owner-reviewed-advice','google-written-determination')
     )
    )
  )
 then coalesce((select jsonb_agg(v) from eligible),'[]') || coalesce((select jsonb_agg(card) from owned),'[]') else '[]' end
$$;
revoke all on function commercial_billing.lineup_inventory(uuid,uuid) from public,anon,authenticated,service_role,docked_app,docked_beta_app,docked_commercial_app;
