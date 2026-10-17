import { digest } from "./scoring-engine";
import { validateCredits, type CreditsState } from "./credits-sandbox";

export type RemovalApproval = {
  playerId: string;
  name: string;
  reason: "unsupported" | "released" | "retired";
  evidence: string[];
  cards: string[];
};
/** Pure local transition. There is deliberately no hosted command/API for it.
 * Original allocations survive as consumed scarcity, never reusable serials. */
export function cleanTestEconomy(
  original: CreditsState,
  approved: RemovalApproval[],
) {
  if (
    original.mode !== "financial-sandbox-only" ||
    original.policy.liveEnabled ||
    original.policy.purchasedWithdrawable
  )
    throw Error("Test economy required");
  validateCredits(original);
  const state = structuredClone(original),
    e = state.economy;
  if (!e) throw Error("Existing test economy required");
  const archive: Record<string, unknown> = {};
  const ids = new Set(approved.flatMap((p) => p.cards));
  for (const p of approved) {
    if (
      !p.evidence.length ||
      !["unsupported", "released", "retired"].includes(p.reason)
    )
      throw Error("Verified removal evidence required");
    for (const id of p.cards) {
      const c = e.instances[id];
      if (e.retiredTestInstances?.[id]) {
        if (e.retiredTestInstances[id].playerId !== p.playerId)
          throw Error("Removal manifest identity changed");
        continue;
      }
      if (!c || c.playerId !== p.playerId)
        throw Error("Removal manifest identity changed");
      archive[`card:${id}`] = {
        allocation: c,
        ownership: state.commerce.cards[id],
        history: state.cards[id],
        approval: p,
      };
      (e.retiredTestInstances ??= {})[id] = c;
      delete e.instances[id];
      delete state.commerce.cards[id];
      delete state.cards[id];
    }
  }
  const remove = (
    map: Record<string, unknown>,
    prefix: string,
    predicate: (value: any) => boolean,
  ) => {
    for (const [id, value] of Object.entries(map))
      if (predicate(value)) {
        archive[`${prefix}:${id}`] = value;
        delete map[id];
      }
  };
  remove(state.listings, "listing", (v) => ids.has(v.card));
  remove(state.swaps, "swap", (v) =>
    [...v.give, ...v.take].some((id) => ids.has(id)),
  );
  remove(
    state.privateCardOffers ?? {},
    "private-offer",
    (v) =>
      ids.has(v.card) || (v.offeredCards ?? []).some((c: any) => ids.has(c.id)),
  );
  // Never release reserved wallet funds by silently deleting a financial offer.
  // Those cases require an explicit reviewed cancellation in the same ledger.
  if (
    digest(state.journal) !== digest(original.journal) ||
    digest(state.lots) !== digest(original.lots)
  )
    throw Error("Wallet changed");
  validateCredits(state);
  for (const [id, c] of Object.entries(state.economy!.instances)) {
    if (
      !state.cards[id] ||
      !state.commerce.cards[id] ||
      !state.economy!.packs[c.source]?.cards.includes(id)
    )
      throw Error("Orphaned active card");
  }
  for (const l of Object.values(state.listings))
    if (!state.commerce.cards[l.card]) throw Error("Orphaned listing");
  for (const offer of Object.values(state.swaps))
    if ([...offer.give, ...offer.take].some((id) => !state.commerce.cards[id]))
      throw Error("Orphaned swap");
  for (const offer of Object.values(state.privateCardOffers ?? {}))
    if (
      [offer.card, ...(offer.offeredCards ?? []).map((c) => c.id)].some(
        (id) => !state.commerce.cards[id],
      )
    )
      throw Error("Orphaned private offer");
  return {
    state,
    archive,
    cardIds: [...ids].filter((id) => !!archive[`card:${id}`]),
  };
}
