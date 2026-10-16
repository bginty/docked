import { z } from "zod";
import {
  executeCredits,
  validateCredits,
  wallet,
  type CreditsState,
} from "./credits-sandbox";
import type { Operator } from "./commerce-sandbox";
import { sellerQuote, combinedOfferQuote } from "./credits-policy";
import { swapFeeQuote } from "./credit-only";

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
  requestedListing?: string;
  offeredCards?: { id: string; version: number }[];
  feeEach?: number;
  creditFeeMinimum?: number;
  combinedPolicy?: "credit-commission-floor-v1";
};
export const privateOfferCommand = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("private-offer"),
      card: z.string().min(1).max(150),
      price: z.number().int().min(0).max(1000000000),
      offeredCards: z.array(z.string().min(1).max(150)).max(1).optional(),
      listing: z.string().max(150).optional(),
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
export type OfferPermission = {
  allowed: boolean;
  minimum: number | null;
  swaps?: boolean;
  combinedPolicy?: "credit-commission-floor-v1";
};
export function privateOfferQuote(
  price: number,
  feeEach = 0,
  creditFeeMinimum?: number,
) {
  return {
    ...(price
      ? creditFeeMinimum === undefined
        ? sellerQuote(price)
        : combinedOfferQuote(price, creditFeeMinimum)
      : { price: 0, fee: 0, net: 0 }),
    feeEach,
  };
}
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
    const offered = c.offeredCards ?? [];
    if ((!offered.length && c.price === 0) || offered.includes(c.card))
      throw Error("Offer credits, one owned card, or both");
    if (offered.length && !permission.swaps)
      throw Error("Swaps are disabled for this card");
    if (offered.length && c.price > 0 && !permission.combinedPolicy)
      throw Error("Combined settlement awaits fee-policy approval");
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
    const activeListing = Object.entries(state.listings).find(
      ([, l]) => l.card === c.card && l.status === "OPEN" && !l.privateOffer,
    );
    if (c.listing && activeListing?.[0] !== c.listing)
      throw Error("Listing changed or closed");
    if (activeListing) {
      const mode = activeListing[1].preference ?? "sell";
      if (
        (mode === "sell" && offered.length) ||
        (mode === "swap" && !offered.length)
      )
        throw Error("Offer does not match the listing preference");
    }
    // Validate on a clone; no listing, card or credit reservation is made by a proposal.
    let checked = structuredClone(state);
    if (activeListing)
      checked = executeCredits(
        checked,
        { id: seller, role: "member" },
        `${request}-check-cancel`,
        { kind: "cancel-listing", listing: activeListing[0] },
        now,
      ).state;
    executeCredits(
      checked,
      { id: seller, role: "member" },
      `${request}-check`,
      {
        kind: "list",
        card: c.card,
        price: c.price || 0,
        ...(c.price ? {} : { preference: "swap" }),
      },
      now,
    );
    const creditFeeMinimum =
      offered.length && c.price
        ? swapFeeQuote(state.creditOnly, state.policy.swapFeeEach, now).feeEach
        : undefined;
    const feeEach =
      offered.length && !c.price
        ? swapFeeQuote(state.creditOnly, state.policy.swapFeeEach, now).feeEach
        : 0;
    if (offered.length)
      executeCredits(
        state,
        actor,
        `${request}-check-swap`,
        {
          kind: "offer",
          other: seller,
          give: offered,
          take: [c.card],
          feeEach,
          ...(c.price ? { creditTopUp: c.price, creditFeeMinimum } : {}),
        },
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
      ...(activeListing ? { requestedListing: activeListing[0] } : {}),
      ...(offered.length
        ? {
            offeredCards: offered.map((id) => ({
              id,
              version: state.cards[id].version,
            })),
            feeEach,
            ...(c.price
              ? { combinedPolicy: permission.combinedPolicy, creditFeeMinimum }
              : {}),
          }
        : {}),
    };
    result = {
      offer: request,
      status: "OPEN",
      ...privateOfferQuote(c.price, feeEach, creditFeeMinimum),
    };
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
      if (
        offer.requestedListing &&
        (state.listings[offer.requestedListing]?.status !== "OPEN" ||
          state.listings[offer.requestedListing]?.member !== offer.seller)
      )
        throw Error("Listing changed or closed; request a new offer");
      const offered = offer.offeredCards ?? [];
      if (offered.length) {
        if (
          !permission.swaps ||
          (offer.price > 0 &&
            (!offer.combinedPolicy ||
              permission.combinedPolicy !== offer.combinedPolicy))
        )
          throw Error("Swap or combined fee permission changed");
        for (const card of offered)
          if (
            state.commerce.cards[card.id]?.owner !== offer.buyer ||
            state.cards[card.id]?.version !== card.version
          )
            throw Error("Offered card ownership changed");
        const swap = `${request}-private-swap`;
        state = executeCredits(
          state,
          { id: offer.buyer, role: "member" },
          swap,
          {
            kind: "offer",
            other: offer.seller,
            give: offered.map((c) => c.id),
            take: [offer.card],
            feeEach: offer.feeEach ?? 0,
            ...(offer.price
              ? {
                  creditTopUp: offer.price,
                  creditFeeMinimum: offer.creditFeeMinimum,
                }
              : {}),
          },
          now,
        ).state;
        // Database competition guards inspect this OPEN state in the same transaction.
        // Cancel affected public listings first: they cannot coexist with a reserved swap.
        for (const listing of Object.values(state.listings))
          if (
            listing.status === "OPEN" &&
            [offer.card, ...offered.map((c) => c.id)].includes(listing.card)
          ) {
            listing.status = "CANCELLED";
            listing.cancelledAt = now;
          }
        steps.push(structuredClone(state));
        state = executeCredits(
          state,
          actor,
          `${request}-private-settle`,
          { kind: "accept", swap, feeEach: offer.feeEach ?? 0 },
          now,
        ).state;
        const accepted = state.privateCardOffers![c.offer];
        accepted.status = "ACCEPTED";
        accepted.closed = now;
        accepted.receipt = swap;
        result = {
          offer: c.offer,
          status: "ACCEPTED",
          receipt: swap,
          ...privateOfferQuote(
            offer.price,
            offer.feeEach,
            offer.creditFeeMinimum,
          ),
        };
      } else {
        const listing = `${request}-private-list`,
          review = `${request}-private-review`,
          buy = `${request}-private-buy`;
        if (offer.requestedListing)
          state = executeCredits(
            state,
            actor,
            `${request}-close-public`,
            { kind: "cancel-listing", listing: offer.requestedListing },
            now,
          ).state;
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
      }
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
