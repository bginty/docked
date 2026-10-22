import type { CreditsState } from "./credits-sandbox";
import { isFixtureSport, type FixtureSport } from "./fixture-sports";
export function fixtureCardSport(
  state: CreditsState,
  id: string,
): FixtureSport | null {
  const instance = state.economy?.instances[id];
  const p = instance && state.economy?.players[instance.playerId];
  return p?.synthetic && isFixtureSport(p.sport) ? p.sport : null;
}
/** Scope is resolved from stored resources, never a browser-supplied sport. */
export function fixtureCommandScope(
  state: CreditsState,
  input: unknown,
): FixtureSport | null {
  if (!input || typeof input !== "object") return null;
  const c = input as Record<string, unknown>,
    cards: string[] = [];
  const scopes = new Set<FixtureSport>();
  if (typeof c.product === "string") {
    const p = state.economy?.products[c.product];
    if (p && isFixtureSport(p.sport)) scopes.add(p.sport);
  }
  if (typeof c.entitlement === "string") {
    const p = state.economy?.packs[c.entitlement];
    if (p && isFixtureSport(p.product.sport)) scopes.add(p.product.sport);
  }
  if (typeof c.card === "string") cards.push(c.card);
  if (typeof c.listing === "string" && state.listings[c.listing])
    cards.push(state.listings[c.listing].card);
  if (typeof c.swap === "string" && state.swaps[c.swap])
    cards.push(...state.swaps[c.swap].give, ...state.swaps[c.swap].take);
  if (typeof c.offer === "string" && state.privateCardOffers?.[c.offer])
    cards.push(
      state.privateCardOffers[c.offer].card,
      ...(state.privateCardOffers[c.offer].offeredCards ?? []).map((x) => x.id),
    );
  for (const key of ["give", "take", "offeredCards"])
    if (Array.isArray(c[key]))
      cards.push(...c[key].filter((x): x is string => typeof x === "string"));
  let otherInventory = false;
  for (const card of cards) {
    const sport = fixtureCardSport(state, card);
    if (sport) scopes.add(sport);
    else otherInventory = true;
  }
  if (scopes.size > 1 || (scopes.size && otherInventory))
    throw Error(
      "Isolated test cards cannot be exchanged for another sport or permanent inventory.",
    );
  return scopes.values().next().value ?? null;
}
export function fixtureCommandMembers(
  state: CreditsState,
  input: unknown,
): string[] {
  const c = (input ?? {}) as Record<string, unknown>,
    members = new Set<string>();
  const addCard = (id: string) => {
    const owner = state.commerce.cards[id]?.owner;
    if (owner) members.add(owner);
  };
  if (typeof c.card === "string") addCard(c.card);
  if (typeof c.listing === "string" && state.listings[c.listing])
    members.add(state.listings[c.listing].member);
  if (typeof c.other === "string") members.add(c.other);
  if (typeof c.swap === "string" && state.swaps[c.swap]) {
    members.add(state.swaps[c.swap].member);
    members.add(state.swaps[c.swap].other);
  }
  if (typeof c.offer === "string" && state.privateCardOffers?.[c.offer]) {
    members.add(state.privateCardOffers[c.offer].seller);
    members.add(state.privateCardOffers[c.offer].buyer);
  }
  for (const key of ["give", "take", "offeredCards"])
    if (Array.isArray(c[key]))
      for (const id of c[key]) if (typeof id === "string") addCard(id);
  return [...members];
}
