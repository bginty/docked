import { z } from "zod";
import {
  executeCredits,
  validateCredits,
  wallet,
  type CreditsState,
} from "./credits-sandbox";
import type { Operator } from "./commerce-sandbox";
import { sellerQuote } from "./credits-policy";

export type PrivateCardOffer = {
  id: string;
  buyer: string;
  seller: string;
  card: string;
  version: number;
  price: number;
  policy: string;
  created: number;
  expires: number;
  status: "OPEN" | "DECLINED" | "CANCELLED" | "EXPIRED" | "ACCEPTED";
  closed?: number;
  receipt?: string;
  listing?: string;
};
export const privateOfferCommand = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("private-offer"),
      card: z.string().min(1).max(150),
      price: z.number().int().min(1).max(1000000000),
    })
    .strict(),
  z
    .object({
      kind: z.enum(["private-accept", "private-decline", "private-cancel"]),
      offer: z.string().uuid(),
    })
    .strict(),
]);
/** Server-derived preferences and relationship checks, never accepted from HTTP. */
export type OfferPermission = { allowed: boolean; minimum: number | null };
export const privateOfferPolicy = Object.freeze({
  version: "local-offer-policy-v1",
  newPerDay: 3,
  outstanding: 21,
  expiryDays: 7,
  declineCooldownHours: 24,
});
export function privateOfferEnabled(env: Record<string, string | undefined>) {
  // Explicitly local-only until a separate beta trading activation review.
  if (
    env.VERCEL ||
    env.NODE_ENV === "production" ||
    env.DOCKED_PRIVATE_OFFERS_LOCAL !== "true"
  )
    return false;
  try {
    return ["127.0.0.1", "localhost", "[::1]"].includes(
      new URL(env.DATABASE_URL ?? "").hostname,
    );
  } catch {
    return false;
  }
}
export function effectiveOfferStatus(offer: PrivateCardOffer, now: number) {
  return offer.status === "OPEN" && offer.expires <= now
    ? "EXPIRED"
    : offer.status;
}
export function executePrivateOffer(
  original: CreditsState,
  actor: Operator,
  request: string,
  input: unknown,
  now: number,
  permission: OfferPermission,
) {
  const c = privateOfferCommand.parse(input);
  z.string().uuid().parse(request);
  if (actor.role !== "member" || !Number.isSafeInteger(now))
    throw Error("Member and server timestamp required");
  validateCredits(original);
  let state = structuredClone(original);
  state.privateCardOffers ??= {};
  const key = `${actor.id}:${request}`,
    fingerprint = JSON.stringify({ role: actor.role, c });
  if (state.requests[key]) {
    if (state.requests[key].fingerprint !== fingerprint)
      throw Error("Idempotency conflict");
    return { state, result: state.requests[key].result };
  }
  for (const offer of Object.values(state.privateCardOffers))
    if (effectiveOfferStatus(offer, now) === "EXPIRED")
      offer.status = "EXPIRED";
  let result: unknown;
  const steps: CreditsState[] = [];
  if (c.kind === "private-offer") {
    const seller = state.commerce.cards[c.card]?.owner;
    if (!permission.allowed || !seller || seller === actor.id)
      throw Error("This card is not accepting offers from you");
    if (permission.minimum !== null && c.price < permission.minimum)
      throw Error("This offer does not meet the owner’s preferences");
    const offers = Object.values(state.privateCardOffers);
    if (
      offers.filter((o) => o.buyer === actor.id && o.created > now - 86400000)
        .length >= privateOfferPolicy.newPerDay
    )
      throw Error("Offer limit reached. Try again after 24 hours.");
    if (
      offers.filter((o) => o.buyer === actor.id && o.status === "OPEN")
        .length >= privateOfferPolicy.outstanding
    )
      throw Error("Maximum outstanding offers reached");
    if (
      offers.some(
        (o) => o.buyer === actor.id && o.card === c.card && o.status === "OPEN",
      )
    )
      throw Error("You already have an active offer for this card");
    if (
      offers.some(
        (o) =>
          o.buyer === actor.id &&
          o.card === c.card &&
          o.status === "DECLINED" &&
          (o.closed ?? 0) >
            now - privateOfferPolicy.declineCooldownHours * 3600000,
      )
    )
      throw Error("Wait 24 hours after a declined offer");
    // Validate the existing transfer policy without creating a sale or reservation.
    executeCredits(
      state,
      { id: seller, role: "member" },
      `${request}-check`,
      { kind: "list", card: c.card, price: c.price },
      now,
    );
    if (wallet(state, actor.id).spendable < c.price)
      throw Error(
        `Insufficient test credits: ${c.price - wallet(state, actor.id).spendable} more required`,
      );
    state.privateCardOffers[request] = {
      id: request,
      buyer: actor.id,
      seller,
      card: c.card,
      version: state.cards[c.card].version,
      price: c.price,
      policy: state.policy.version,
      created: now,
      expires: now + privateOfferPolicy.expiryDays * 86400000,
      status: "OPEN",
    };
    result = { offer: request, status: "OPEN", ...sellerQuote(c.price) };
  } else {
    const offer = state.privateCardOffers[c.offer];
    if (
      !offer ||
      (c.kind === "private-cancel" ? offer.buyer : offer.seller) !== actor.id
    )
      throw Error("Offer unavailable");
    if (offer.status !== "OPEN")
      throw Error(`Offer ${offer.status.toLowerCase()}`);
    if (c.kind === "private-accept") {
      if (
        !permission.allowed ||
        (permission.minimum !== null && offer.price < permission.minimum)
      )
        throw Error("Offer permissions changed");
      if (
        state.cards[offer.card]?.version !== offer.version ||
        state.commerce.cards[offer.card]?.owner !== offer.seller
      )
        throw Error("Card ownership changed");
      if (offer.policy !== state.policy.version)
        throw Error("Trading policy changed; request a new offer");
      const listing = `${request}-private-list`,
        review = `${request}-private-review`,
        buy = `${request}-private-buy`;
      state = executeCredits(
        state,
        { id: offer.seller, role: "member" },
        listing,
        { kind: "list", card: offer.card, price: offer.price },
        now,
      ).state;
      // The existing database guard requires OPEN → SOLD. Both writes occur
      // inside one locked transaction; the private listing is never public.
      state.listings[listing].privateOffer = c.offer;
      steps.push(structuredClone(state));
      state = executeCredits(
        state,
        { id: offer.buyer, role: "member" },
        review,
        { kind: "review-buy", listing },
        now,
      ).state;
      const settled = executeCredits(
        state,
        { id: offer.buyer, role: "member" },
        buy,
        {
          kind: "buy",
          listing,
          review,
          policy: offer.policy,
          expectedPrice: offer.price,
          confirmed: true,
        },
        now,
      );
      state = settled.state;
      const accepted = state.privateCardOffers![c.offer];
      accepted.status = "ACCEPTED";
      accepted.closed = now;
      accepted.listing = listing;
      accepted.receipt = state.listings[listing].receipt!.reference;
      result = {
        offer: c.offer,
        status: "ACCEPTED",
        receipt: accepted.receipt,
        listing,
        ...sellerQuote(offer.price),
      };
    } else {
      offer.status = c.kind === "private-decline" ? "DECLINED" : "CANCELLED";
      offer.closed = now;
      result = { offer: c.offer, status: offer.status };
    }
  }
  state.events.push({
    id: key,
    actor: actor.id,
    kind: c.kind,
    at: now,
    command: c,
  });
  state.requests[key] = { fingerprint, result };
  validateCredits(state);
  return { state, result, steps };
}
