import type { TransactionSql } from "postgres";
import {
  initialCredits,
  creditsCommand,
  type CreditsState,
} from "../core/credits-sandbox";
import { memberTestView } from "../core/member-test-wallet";
import { CreditsRejected } from "./credits-sandbox-store";

/** A committed receipt needs its own allocations and financial projection, not
 * every player, product, listing and ownership record in the global aggregate.
 * Caller MUST authenticate, bind claims and recheck admission in this snapshot.
 * This is a read projection only; every mutation still runs the complete guards.
 */
export async function memberPackReceipt(
  tx: TransactionSql,
  member: string,
  request: string,
  command: ReturnType<typeof creditsCommand.parse>,
) {
  if (command.kind !== "buy-pack" && command.kind !== "open-pack")
    throw new CreditsRejected("A pack request is required.");
  const [saved] =
    await tx`select document #> array['requests',${`${member}:${request}`}] prior
    from credits_sandbox.state where id`;
  if (!saved?.prior) throw Error("Purchase confirmation is still pending.");
  if (
    saved.prior.fingerprint !== JSON.stringify({ role: "member", c: command })
  )
    throw new CreditsRejected(
      "Idempotency conflict. Check the original purchase request.",
    );
  const id =
    command.kind === "open-pack"
      ? command.entitlement
      : saved.prior.result?.entitlement;
  if (typeof id !== "string")
    throw Error("Saved purchase receipt is unavailable.");
  const [row] = await tx`
    with base as materialized (
      select x.* from credits_sandbox.state s,
      jsonb_to_record(s.document) x(policy jsonb,lots jsonb,journal jsonb,cases jsonb,
        deposits jsonb,withdrawals jsonb,"storeTestDeposits" jsonb,"creditOnly" jsonb,
        economy jsonb,commerce jsonb,cards jsonb,entitlements jsonb,listings jsonb,swaps jsonb)
      where s.id and x.entitlements->${id}::text->>'member'=${member}
    ), econ as materialized (
      select e.* from base b,jsonb_to_record(b.economy) e(players jsonb,instances jsonb,
        "retiredTestInstances" jsonb,packs jsonb)
    ), allocation as materialized (
      select value #>> '{}' id from econ e,jsonb_array_elements(e.packs->${id}::text->'cards')
      union select b.commerce->'orders'->(b.entitlements->${id}::text->>'order')->>'card'
        from base b where b.economy is null or not(b.economy->'packs' ? ${id})
    )
    select jsonb_build_object('policy',b.policy,'lots',b.lots,'journal',b.journal,
      'cases',b.cases,'deposits',b.deposits,'withdrawals',b.withdrawals,
      'storeTestDeposits',coalesce(b."storeTestDeposits",'{}'),'creditOnly',b."creditOnly",
      'entitlements',jsonb_build_object(${id}::text,b.entitlements->${id}::text),
      'cards',(select coalesce(jsonb_object_agg(a.id,b.cards->a.id),'{}') from allocation a where b.cards ? a.id),
      'commerce',jsonb_build_object('cards',(select coalesce(jsonb_object_agg(a.id,b.commerce->'cards'->a.id),'{}') from allocation a where b.commerce->'cards' ? a.id),
        'orders',coalesce(b.commerce->'orders','{}'),'products','{}'::jsonb),
      'economy',case when b.economy is null or not(b.economy->'packs' ? ${id}) then null else jsonb_build_object(
        'enabled',false,'products','{}'::jsonb,'definitions','{}'::jsonb,
        'packs',jsonb_build_object(${id}::text,e.packs->${id}::text),
        'instances',(select coalesce(jsonb_object_agg(a.id,e.instances->a.id),'{}') from allocation a where e.instances ? a.id),
        'retiredTestInstances',(select coalesce(jsonb_object_agg(a.id,e."retiredTestInstances"->a.id),'{}') from allocation a where e."retiredTestInstances" ? a.id),
        'players',(select coalesce(jsonb_object_agg(p.id,e.players->p.id),'{}') from
          (select distinct e.instances->a.id->>'playerId' id from allocation a) p where p.id is not null)) end
      ) value,(select coalesce(jsonb_agg(a.id),'[]') from allocation a where a.id is not null) allocation_ids
      ,(select coalesce(jsonb_object_agg(ref,kind),'{}') from (
        select distinct h->>'reference' ref,case
          when b.listings ? (h->>'reference') then 'Purchased / sold'
          when b.swaps ? (h->>'reference') then 'Swapped' else 'Ownership transfer' end kind
        from allocation a,jsonb_array_elements(b.cards->a.id->'history') h
        where h->>'from' is not null and h->>'reference' is not null
      ) kinds) history_reference_types
      from base b left join econ e on true`;
  if (!row?.value)
    throw Error("Pack receipt is not available for this account.");
  // Supply/products are intentionally absent from this projection. No price or
  // eligibility is inferred from it; a later purchase checks them under lock.
  const state = { ...initialCredits(), ...row.value } as CreditsState;
  const view = memberTestView(state, member, [], false, Date.now(), [], {
    catalogue: false,
  });
  const pack = view.packs[0];
  if (!pack || pack.id !== id) throw Error("Saved pack mismatch.");
  if (command.kind === "open-pack" && !pack.receipt)
    throw Error("Pack receipt is held for review.");
  const cards = view.cards.map((card) => ({
    ...card,
    history: card.history.map((entry, index) => ({
      ...entry,
      reference:
        row.history_reference_types[
          state.cards[card.id].history[index].reference
        ] ?? entry.reference,
    })),
  }));
  return {
    packUpdate: {
      member,
      wallet: view.wallet,
      pack,
      cards,
      // Also remove stale local copies that were subsequently transferred or
      // retired; a historical receipt does not imply current ownership.
      reconciledCardIds: row.allocation_ids as string[],
    },
    result: command.kind === "open-pack" ? pack.receipt : saved.prior.result,
  };
}
