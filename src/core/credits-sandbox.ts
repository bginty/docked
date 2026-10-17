import {
  allocateNine,
  validateCardEconomy,
  type CardEconomy,
} from "./card-economy";
import { z } from "zod";
import { nflCardEligibility } from "./nfl-card-eligibility";
import { digest } from "./scoring-engine";
import {
  executeCommerce,
  initialCommerce,
  type Operator,
  type State as Commerce,
} from "./commerce-sandbox";
import {
  creditsPolicy,
  sellerQuote,
  combinedOfferQuote,
} from "./credits-policy";
import { generatePrizes, type PrizeRegister } from "./prize-register";
import {
  creditsFromAudCents,
  newCreditOnly,
  swapFeeQuote,
  type CreditOnly,
} from "./credit-only";
import {
  redemptionCommand,
  applyRedemption,
  authorizeRedemption,
  validateRedemption,
  type RedemptionProgram,
  type ManualRedemption,
  type RedemptionStatus,
} from "./redemption";

// Operator-only domain. No public route accepts an actor, provider claim or balance.
// Admitted friends may use the restricted member adapter; never real money.
type Category = "purchased" | "sale" | "promotional" | "competition";
type Bucket = "available" | "pending" | "reserved";
type Lot = {
  id: string;
  member: string;
  category: Category;
  redeemable: boolean;
  provenance: string;
  created: number;
  parentLot?: string;
  // Only explicitly seeded isolated QA lots can exercise redemption. Legacy
  // test lots, including those with redeemable=true, never acquire cash value.
  cashEligibility?: { scope: "local-redemption-fixture"; policy: string };
};
type Line = { account: string; credits: number };
type Journal = {
  id: string;
  at: number;
  actor: string;
  reason: string;
  policy: string;
  lines: Line[];
  previousHash: string;
  hash: string;
};
type Card = {
  version: number;
  restricted: boolean;
  locked: boolean;
  history: { from: string | null; to: string; reference: string; at: number }[];
};
type Withdrawal = {
  manual?: ManualRedemption;
  member: string;
  amount: number;
  beneficiary: string;
  status:
    | "REQUESTED"
    | "REVIEWED"
    | "SUBMITTED"
    | "UNCERTAIN"
    | "PAID"
    | "FAILED"
    | "CANCELLED"
    | RedemptionStatus;
  parts: { lot: string; amount: number }[];
  provider?: string;
};
export type CreditsState = {
  privateCardOffers?: Record<
    string,
    import("./private-card-offers").PrivateCardOffer
  >;
  redemption?: RedemptionProgram;
  mode: "financial-sandbox-only";
  creditOnly?: CreditOnly;
  economy?: CardEconomy;
  policy: Omit<
    typeof creditsPolicy,
    "version" | "campaignLimit" | "purchasedWithdrawable"
  > & {
    version: string;
    campaignLimit: number;
    purchasedWithdrawable: boolean;
  };
  commerce: Commerce;
  lots: Record<string, Lot>;
  journal: Journal[];
  requests: Record<string, { fingerprint: string; result: unknown }>;
  events: {
    id: string;
    actor: string;
    kind: string;
    at: number;
    command: unknown;
  }[];
  deposits: Record<
    string,
    {
      member: string;
      product: string;
      amount: number;
      order: string;
      lot?: string;
      provider?: string;
      capture?: string;
      clearAt?: number;
      status: "AWAITING" | "PENDING" | "FULFILLED" | "REVIEW" | "CANCELLED";
      refunded: number;
      creditOnly?: boolean;
      merchant?: string;
      settlement?: { reference: string; net: number; fees: number; at: number };
    }
  >;
  entitlements: Record<
    string,
    {
      member: string;
      order: string;
      source: string;
      status: "SEALED" | "OPENED" | "REVIEW";
      restricted: boolean;
    }
  >;
  cards: Record<string, Card>;
  listings: Record<
    string,
    {
      member: string;
      card: string;
      version: number;
      price: number;
      preference?: "sell" | "swap" | "both";
      privateOffer?: string;
      status: "OPEN" | "SOLD" | "CANCELLED";
      buyer?: string;
      createdAt?: number;
      cancelledAt?: number;
      receipt?: {
        reference: string;
        at: number;
        price: number;
        fee: number;
        net: number;
      };
    }
  >;
  swaps: Record<
    string,
    {
      member: string;
      other: string;
      give: string[];
      take: string[];
      versions: number[];
      expires: number;
      status: "OPEN" | "ACCEPTED" | "REJECTED" | "CANCELLED" | "EXPIRED";
      feeEach: number;
      creditTopUp?: number;
      creditFeeMinimum?: number;
      completedFeeEach?: number;
    }
  >;
  providerEvents: Record<string, string>;
  withdrawals: Record<string, Withdrawal>;
  campaigns: Record<string, number>;
  awards: Record<
    string,
    {
      journal: string;
      member: string;
      amount: number;
      revision: number;
      fingerprint: string;
      status: "ISSUED" | "REVIEW";
    }
  >;
  funding: Record<string, { remaining: number; approval: string }>;
  prizes: PrizeRegister;
  cases: Record<
    string,
    {
      reason: string;
      member: string;
      status: "OPEN" | "RESOLVED";
      reference: string;
    }
  >;
  reconciliation: {
    balance: number;
    fees: number;
    reserves: number;
    reference: string;
    at: number;
  } | null;
};
const id = z
  .string()
  .regex(/^[a-zA-Z0-9_-]{1,90}$/)
  .refine((v) => !(v in {}) && v !== "prototype", "Reserved identifier");
const amount = z.number().int().positive().max(1_000_000_000);
const reason = z.string().trim().min(12).max(600);
const base = <T extends z.ZodRawShape>(shape: T) => z.object(shape).strict();
export const creditsCommand = z.discriminatedUnion("kind", [
  redemptionCommand,
  base({ kind: z.literal("credit-only-policy"), reason }),
  base({
    kind: z.literal("swap-window"),
    start: z.number().int().nonnegative(),
    end: z.number().int().nonnegative(),
    reason,
  }),
  base({ kind: z.literal("credit-deposit"), cents: amount }),
  base({
    kind: z.literal("settlement"),
    deposit: id,
    reference: id,
    net: z.number().int().nonnegative(),
    fees: z.number().int().nonnegative(),
    verified: z.literal(true),
  }),
  base({ kind: z.literal("deposit"), product: id }),
  base({ kind: z.literal("bind"), deposit: id, providerOrder: id }),
  base({
    kind: z.literal("capture"),
    deposit: id,
    event: id,
    providerOrder: id,
    capture: id,
    amount,
    currency: z.literal("AUD"),
    verified: z.literal(true),
    merchant: id.optional(),
  }),
  base({ kind: z.literal("clear"), deposit: id }),
  base({ kind: z.literal("cancel-deposit"), deposit: id }),
  base({ kind: z.literal("expire-deposits") }),
  base({
    kind: z.literal("buy-pack"),
    product: id,
    configuration: id.optional(),
    expectedPrice: z.number().int().min(0).max(1000000000).optional(),
    confirmed: z.literal(true),
    policy: id,
  }),
  base({ kind: z.literal("open-pack"), entitlement: id }),
  base({
    kind: z.literal("list"),
    card: id,
    price: z.number().int().min(0).max(1000000000),
    preference: z.enum(["sell", "swap", "both"]).optional(),
  }),
  base({
    kind: z.literal("replace-listing"),
    listing: id,
    card: id,
    price: z.number().int().min(0).max(1000000000),
    preference: z.enum(["sell", "swap", "both"]),
  }),
  base({ kind: z.literal("cancel-listing"), listing: id }),
  base({ kind: z.literal("review-buy"), listing: id }),
  base({
    kind: z.literal("buy"),
    review: id.optional(),
    listing: id,
    expectedPrice: amount,
    policy: id,
    confirmed: z.literal(true),
  }),
  base({
    kind: z.literal("offer"),
    other: id,
    give: z.array(id).min(1).max(10),
    take: z.array(id).min(1).max(10),
    feeEach: z.union([z.literal(0), z.literal(50)]),
    creditTopUp: z.number().int().min(1).max(1000000000).optional(),
    creditFeeMinimum: z.union([z.literal(0), z.literal(50)]).optional(),
  }),
  base({
    kind: z.enum(["accept", "reject", "cancel-swap", "expire-swap"]),
    swap: id,
    feeEach: z.union([z.literal(0), z.literal(50)]).optional(),
  }),
  base({
    kind: z.literal("promotion"),
    member: id,
    amount,
    campaign: id,
    reason,
    confirmed: z.literal(true),
    redeemable: z.boolean(),
    funding: id.optional(),
  }),
  base({
    kind: z.literal("fund"),
    source: id,
    amount,
    approval: reason,
    bankReference: id,
  }),
  base({
    kind: z.literal("award"),
    competition: id,
    round: id,
    sport: z.enum(["epl", "nfl", "afl"]),
    member: id,
    amount,
    revision: amount,
    final: z.literal(true),
    eligible: z.literal(true),
    tied: z.boolean(),
    tiePolicy: z.enum(["hold", "all"]),
    schedule: id,
    approved: z.literal(true),
    redeemable: z.boolean(),
    funding: id.optional(),
    reason,
  }),
  base({
    kind: z.literal("award-correction"),
    award: id,
    revision: amount,
    reason,
  }),
  base({ kind: z.literal("reverse"), journal: id, reason }),
  base({ kind: z.literal("kyc-start"), session: id }),
  base({
    kind: z.literal("kyc-event"),
    member: id,
    session: id,
    event: id,
    revision: amount,
    state: z.enum(["PENDING", "VERIFIED", "REVIEW_REQUIRED", "EXPIRED"]),
    expires: z.number().int().nonnegative(),
    reason: reason.optional(),
  }),
  base({
    kind: z.literal("beneficiary"),
    member: id,
    beneficiary: id,
    verified: z.boolean(),
    reason,
  }),
  base({
    kind: z.literal("withdraw"),
    amount,
    beneficiary: id,
    confirmed: z.literal(true),
    policy: id,
  }),
  base({
    kind: z.literal("withdraw-review"),
    withdrawal: id,
    action: z.enum(["approve", "cancel"]),
    reason,
  }),
  base({ kind: z.literal("payout-submit"), withdrawal: id, provider: id }),
  base({
    kind: z.literal("payout-result"),
    withdrawal: id,
    provider: id,
    event: id,
    status: z.enum(["PAID", "FAILED", "UNCERTAIN"]),
    verified: z.literal(true),
  }),
  base({
    kind: z.literal("refund-event"),
    deposit: id,
    event: id,
    cumulativeRefund: z.number().int().nonnegative().max(1_000_000_000),
    dispute: z.boolean(),
    reason,
  }),
  base({
    kind: z.literal("reconcile"),
    balance: z.number().int().nonnegative(),
    fees: z.number().int().nonnegative(),
    reserves: z.number().int().nonnegative(),
    reference: id,
  }),
]);
export function initialCredits(): CreditsState {
  return {
    mode: "financial-sandbox-only",
    creditOnly: newCreditOnly(),
    policy: structuredClone(creditsPolicy),
    commerce: initialCommerce(),
    lots: {},
    journal: [],
    requests: {},
    events: [],
    deposits: {},
    entitlements: {},
    cards: {},
    listings: {},
    swaps: {},
    providerEvents: {},
    withdrawals: {},
    campaigns: {},
    awards: {},
    funding: {},
    prizes: { scope: "synthetic-only", obligations: [], audit: [] },
    cases: {},
    reconciliation: null,
  };
}
const account = (lot: string, bucket: Bucket) => `lot:${lot}:${bucket}`;
const held = (s: CreditsState, lot: Lot) =>
  Object.values(s.cases).some(
    (c) =>
      c.member === lot.member &&
      c.status === "OPEN" &&
      !s.deposits[c.reference],
  ) ||
  Object.values(s.deposits).some(
    (d) =>
      d.capture &&
      lot.provenance === `payment:${d.capture}` &&
      d.status === "REVIEW",
  );
export function creditBalances(s: CreditsState) {
  const balances: Record<string, number> = {};
  for (const j of s.journal)
    for (const l of j.lines)
      balances[l.account] = (balances[l.account] ?? 0) + l.credits;
  return balances;
}
export function wallet(s: CreditsState, member: string) {
  const b = creditBalances(s),
    total = {
      available: 0,
      pending: 0,
      reserved: 0,
      withdrawable: 0,
      total: 0,
      heldAvailable: 0,
    };
  for (const lot of Object.values(s.lots).filter((l) => l.member === member)) {
    for (const bucket of ["available", "pending", "reserved"] as const)
      total[bucket] += b[account(lot.id, bucket)] ?? 0;
    if (held(s, lot))
      total.heldAvailable += b[account(lot.id, "available")] ?? 0;
    else if (lot.redeemable && (!s.creditOnly || lot.category !== "purchased"))
      total.withdrawable += b[account(lot.id, "available")] ?? 0;
  }
  total.total = total.available + total.pending + total.reserved;
  return {
    ...total,
    spendable: total.available - total.heldAvailable,
    label: "Docked Credits · financial sandbox · no cash value",
    withdrawableIsSubset: true,
    restricted: total.available - total.withdrawable,
  };
}
export function validateCredits(s: CreditsState) {
  if (s.economy) validateCardEconomy(s.economy);
  if (
    s.mode !== "financial-sandbox-only" ||
    s.policy.liveEnabled !== false ||
    s.policy.approval !== "PROPOSED_SANDBOX_ONLY"
  )
    throw Error("Sandbox boundary");
  if (s.creditOnly) {
    if (
      s.creditOnly.version !== newCreditOnly().version ||
      s.creditOnly.spending !== "FIFO" ||
      s.creditOnly.unusedPurchasedWithdrawable !== false
    )
      throw Error("Credit-only policy invariant");
    for (const w of s.creditOnly.windows)
      if (
        w.scope !== s.mode ||
        !Number.isSafeInteger(w.start) ||
        !Number.isSafeInteger(w.end) ||
        w.end <= w.start ||
        w.recordedAt > w.start
      )
        throw Error("Swap window invariant");
  }
  for (const l of Object.values(s.lots)) {
    if (
      l.parentLot &&
      (!s.lots[l.parentLot] ||
        s.lots[l.parentLot].provenance !== l.provenance ||
        s.lots[l.parentLot].created > l.created ||
        l.parentLot === l.id)
    )
      throw Error("Funding provenance invariant");
  }
  let prior = "GENESIS";
  for (const j of s.journal) {
    for (const line of j.lines) {
      if (!line.account.startsWith("lot:")) continue;
      const [, lotId, bucket, extra] = line.account.split(":");
      if (
        !s.lots[lotId] ||
        extra ||
        !["available", "pending", "reserved"].includes(bucket)
      )
        throw Error("Missing or invalid funding lot posting");
    }
    const { hash, ...body } = j;
    if (
      j.previousHash !== prior ||
      hash !== digest(body) ||
      j.lines.reduce((n, l) => n + l.credits, 0) !== 0 ||
      j.lines.some((l) => !Number.isSafeInteger(l.credits))
    )
      throw Error("Ledger integrity");
    prior = hash;
  }
  for (const [key, n] of Object.entries(creditBalances(s)))
    if (!Number.isSafeInteger(n) || (key.startsWith("lot:") && n < 0))
      throw Error("Negative or invalid member balance");
}
export function executeCredits(
  original: CreditsState,
  actor: Operator,
  request: string,
  input: unknown,
  now: number,
) {
  validateCredits(original);
  validateRedemption(original);
  id.parse(request);
  id.parse(actor.id);
  if (!Number.isSafeInteger(now)) throw Error("Server timestamp required");
  const c = creditsCommand.parse(input),
    s = structuredClone(original),
    key = `${actor.id}:${request}`;
  const fingerprint = JSON.stringify({ role: actor.role, c });
  const admin = () => {
    if (actor.role !== "reviewer" || actor.aal !== "aal2")
      throw Error("Owner MFA required");
  };
  // Reauthorize even idempotent replays; cached admin results never skip MFA.
  if (actor.role === "reviewer") admin();
  if (c.kind === "redemption") authorizeRedemption(s, actor, c, now);
  if ("withdrawal" in c && s.withdrawals[c.withdrawal]?.manual)
    throw Error("Manual EFT requests require the redemption workflow");
  if (s.requests[key]) {
    if (s.requests[key].fingerprint !== fingerprint)
      throw Error("Idempotency conflict");
    return { state: s, result: s.requests[key].result };
  }
  // Expiry is effective at server time even if no cleanup worker has run.
  // No ledger funds or physical card reservation is created by these offers.
  for (const offer of Object.values(s.swaps))
    if (offer.status === "OPEN" && offer.expires <= now)
      offer.status = "EXPIRED";
  const member = () => {
    if (actor.role !== "member") throw Error("Member action required");
  };
  const provider = () => {
    if (actor.role !== "payment-provider")
      throw Error("Verified payment service required");
  };
  const own = (owner: string) => {
    member();
    if (owner !== actor.id) throw Error("Account isolation");
  };
  const policy = (v: string) => {
    if (v !== s.policy.version) throw Error("Policy changed; review quote");
  };
  const internal: Operator = {
    id: "sandbox-service",
    role: "reviewer",
    aal: "aal2",
  };
  const commerce = (a: Operator, ref: string, cmd: unknown) => {
    const next = executeCommerce(s.commerce, a, ref, cmd, now);
    s.commerce = next.state;
    return next.result;
  };
  const post = (suffix: string, lines: Line[], why: string) => {
    const body = {
      id: `${request}_${suffix}`,
      at: now,
      actor: actor.id,
      reason: why,
      policy: s.policy.version,
      lines: lines.filter((l) => l.credits !== 0),
      previousHash: s.journal.at(-1)?.hash ?? "GENESIS",
    };
    if (s.journal.some((j) => j.id === body.id))
      throw Error("Journal reference collision");
    const entry = {
      ...body,
      hash: digest(body),
    };
    s.journal.push(entry);
    validateCredits(s);
    return entry.id;
  };
  const lot = (
    memberId: string,
    category: Category,
    redeemable: boolean,
    provenance: string,
  ) => {
    const lid = `L${s.events.length}_${Object.keys(s.lots).length}`;
    s.lots[lid] = {
      id: lid,
      member: memberId,
      category,
      redeemable,
      provenance,
      created: now,
    };
    return lid;
  };
  const select = (who: string, n: number, redeemableOnly = false) => {
    if (!n) return [];
    // Proposed sandbox review hold only: no automatic debt or seizure of cards.
    if (
      Object.values(s.cases).some(
        (c) =>
          c.member === who && c.status === "OPEN" && !s.deposits[c.reference],
      )
    )
      throw Error("Open recovery review; funds eligibility unresolved");
    const b = creditBalances(s),
      parts: { lot: string; amount: number }[] = [];
    for (const l of Object.values(s.lots)
      .filter(
        (l) =>
          l.member === who &&
          !held(s, l) &&
          (!redeemableOnly ||
            (l.redeemable && (!s.creditOnly || l.category !== "purchased"))),
      )
      .sort(
        (a, b) =>
          (s.creditOnly
            ? 0
            : s.policy.spendingOrder.indexOf(a.category) -
              s.policy.spendingOrder.indexOf(b.category)) ||
          a.created - b.created ||
          a.id.localeCompare(b.id),
      )) {
      const take = Math.min(n, b[account(l.id, "available")] ?? 0);
      if (take) {
        parts.push({ lot: l.id, amount: take });
        n -= take;
      }
      if (!n) break;
    }
    if (n)
      throw Error(
        `Insufficient eligible Docked Credits. You need ${n.toLocaleString("en-AU")} more Docked Credits for this transaction.`,
      );
    return parts;
  };
  const debit = (
    parts: { lot: string; amount: number }[],
    bucket: Bucket = "available",
  ) =>
    parts.map((p) => ({ account: account(p.lot, bucket), credits: -p.amount }));
  const canTrade = (
    cardId: string,
    owner: string,
    version?: number,
    offerId?: string,
  ) => {
    if (
      Object.entries(s.swaps).some(
        ([ref, x]) =>
          ref !== offerId &&
          x.status === "OPEN" &&
          x.expires > now &&
          [...x.give, ...x.take].includes(cardId),
      )
    )
      throw Error(
        "Card reserved by an active swap. Cancel or wait for expiry.",
      );
    const card = s.commerce.cards[cardId],
      meta = s.cards[cardId];
    if (
      !card ||
      card.tier === "CORE" ||
      card.owner !== owner ||
      card.reserved ||
      !meta ||
      (s.economy?.instances[cardId] &&
        !s.economy.packs[s.economy.instances[cardId].source]?.openedAt) ||
      meta.locked ||
      (version !== undefined && meta.version !== version)
    )
      throw Error("Ownership, saved/locked lineup or stale offer");
    return meta;
  };
  const transfer = (cardId: string, to: string, reference: string) => {
    const card = s.commerce.cards[cardId],
      m = s.cards[cardId];
    m.history.push({ from: card.owner, to, reference, at: now });
    m.version++;
    card.owner = to;
    // Swapping a listed card supersedes the sale offer in the same transaction.
    // A successful buy sets its own listing to SOLD immediately afterwards.
    for (const listing of Object.values(s.listings))
      if (listing.card === cardId && listing.status === "OPEN") {
        listing.status = "CANCELLED";
        listing.cancelledAt ??= now;
      }
  };
  const event = (namespace: string, eid: string, data: unknown) => {
    const k = `${namespace}:${eid}`,
      f = JSON.stringify(data);
    if (s.providerEvents[k]) {
      if (s.providerEvents[k] !== f) throw Error("Provider event collision");
      return false;
    }
    s.providerEvents[k] = f;
    return true;
  };
  const deposit = (ref: string) => {
    const d = s.deposits[ref];
    if (!d) throw Error("Unknown deposit");
    return d;
  };
  const withdraw = (ref: string) => {
    const w = s.withdrawals[ref];
    if (!w) throw Error("Unknown withdrawal");
    return w;
  };
  const kyc = (who: string) => {
    const k = s.commerce.kyc[who];
    if (!k || k.state !== "VERIFIED" || k.expires <= now)
      throw Error("Verified current KYC required");
  };
  let result: unknown = { ok: true };
  if (c.kind === "redemption") {
    result = applyRedemption(s, actor, request, c, now, post);
  } else if (c.kind === "credit-only-policy") {
    admin();
    s.creditOnly ??= newCreditOnly();
  } else if (c.kind === "swap-window") {
    admin();
    if (!s.creditOnly || c.start < now || c.end <= c.start)
      throw Error("Future, bounded swap window required");
    if (s.creditOnly.windows.some((w) => c.start < w.end && c.end > w.start))
      throw Error("Overlapping swap window");
    s.creditOnly.windows.push({
      id: request,
      start: c.start,
      end: c.end,
      scope: s.mode,
      actor: actor.id,
      reason: c.reason,
      recordedAt: now,
    });
  } else if (c.kind === "credit-deposit") {
    member();
    if (!s.creditOnly) throw Error("Credit-only policy required");
    if (s.deposits[request] || s.commerce.orders[request])
      throw Error("Deposit reference already in use");
    s.deposits[request] = {
      member: actor.id,
      product: "credits-only",
      amount: creditsFromAudCents(c.cents),
      order: request,
      status: "AWAITING",
      refunded: 0,
      creditOnly: true,
      merchant: s.creditOnly.merchant,
    };
    result = {
      id: request,
      amount: c.cents,
      currency: "AUD",
      status: "AWAITING",
      bonus: null,
    };
  } else if (c.kind === "settlement") {
    provider();
    const d = deposit(c.deposit);
    if (
      !d.creditOnly ||
      !d.capture ||
      d.status === "REVIEW" ||
      c.net + c.fees !== d.amount ||
      !Number.isSafeInteger(c.net + c.fees)
    )
      throw Error("Verified settlement must match confirmed payment");
    const data = { reference: c.reference, net: c.net, fees: c.fees };
    if (d.settlement) {
      if (
        d.settlement.reference !== c.reference ||
        d.settlement.net !== c.net ||
        d.settlement.fees !== c.fees
      )
        throw Error("Settlement conflict");
    } else {
      if (!event("settlement-reference", c.reference, c.deposit))
        throw Error("Settlement already applied");
      post(
        "settlement",
        [
          { account: "system:provider-receivable", credits: d.amount },
          { account: "system:provider-cash", credits: -c.net },
          { account: "system:processing-fees", credits: -c.fees },
        ],
        "Simulated provider settlement; fees do not reduce customer allocation",
      );
      d.settlement = { ...data, at: now };
    }
  } else if (c.kind === "buy-pack" && s.economy) {
    if (!s.economy.enabled) throw Error("Pack purchasing is paused");
    member();
    policy(c.policy);
    const product = s.economy.products[c.product];
    if (!product)
      throw Error(
        "Previous single-card products are retired for new purchases",
      );
    if (c.configuration !== product.version)
      throw Error(
        "Pack configuration changed. Refresh and review before confirming.",
      );
    if (
      c.expectedPrice !== undefined &&
      c.expectedPrice !== product.priceCredits
    )
      throw Error("Pack price changed. Refresh and review before confirming.");
    const parts = select(actor.id, product.priceCredits);
    const pack = allocateNine(s.economy, c.product, actor.id, request, now);
    for (const cardId of pack.cards) {
      const card = s.economy.instances[cardId];
      s.commerce.cards[cardId] = {
        tier: card.rarity,
        sport: product.sport,
        owner: actor.id,
        reserved: null,
      };
      s.cards[cardId] = {
        version: 1,
        restricted: true,
        locked: false,
        history: [{ from: null, to: actor.id, reference: request, at: now }],
      };
    }
    const journal = post(
      "pack",
      [
        ...debit(parts),
        { account: "system:pack-revenue", credits: product.priceCredits },
      ],
      "Nine-card TEST pack purchase; no deposit bonus",
    );
    s.entitlements[request] = {
      member: actor.id,
      order: request,
      source: journal,
      status: "SEALED",
      restricted: true,
    };
    result = {
      entitlement: request,
      journal,
      price: product.priceCredits,
      cards: 9,
      configuration: pack.configurationHash,
    };
  } else if (c.kind === "open-pack" && s.economy?.packs[c.entitlement]) {
    const pack = s.economy.packs[c.entitlement];
    own(pack.member);
    const e = s.entitlements[c.entitlement];
    if (!e || e.status === "REVIEW") throw Error("Entitlement held for review");
    if (
      !pack.openedAt &&
      s.economy.rosterPolicy &&
      pack.cards.some((id) => {
        const instance = s.economy!.instances[id];
        return (
          instance &&
          s.economy!.players[instance.playerId].sport === "nfl" &&
          !nflCardEligibility(s.economy!.players[instance.playerId], now)
            .eligible
        );
      })
    )
      throw Error(
        "Pack contains a player awaiting roster review. Your entitlement is preserved.",
      );
    pack.openedAt ??= now;
    e.status = "OPENED";
    result = {
      receipt: pack.id,
      cards: pack.cards.filter((id) => !s.economy?.retiredTestInstances?.[id]),
    };
  } else if (c.kind === "deposit" || c.kind === "buy-pack") {
    member();
    const p = s.policy.products.find((p) => p.id === c.product);
    if (!p) throw Error("Unknown product");
    if (s.commerce.orders[request]) throw Error("Order reference collision");
    let parts: ReturnType<typeof select> = [];
    if (c.kind === "deposit") {
      if (s.creditOnly)
        throw Error(
          "Legacy deposit bonus offer retired; use credit-only funding",
        );
      const used = Object.values(s.deposits).filter(
        (d) =>
          d.member === actor.id &&
          d.product === p.id &&
          d.status !== "CANCELLED",
      ).length;
      if (used >= s.policy.bonus.maxPerMemberProduct)
        throw Error("Sandbox promotion limit; live frequency undecided");
    } else {
      policy(c.policy);
      if (c.expectedPrice !== undefined && c.expectedPrice !== p.priceCredits)
        throw Error(
          "Pack price changed. Refresh and review before confirming.",
        );
      parts = select(actor.id, p.priceCredits);
    }
    const o = commerce(actor, request, {
      kind: "random-order",
      product: p.id,
      method: c.kind === "deposit" ? "paypal" : "bank",
    }) as { id: string };
    if (c.kind === "deposit") {
      s.deposits[request] = {
        member: actor.id,
        product: p.id,
        amount: p.priceCredits,
        order: o.id,
        status: "AWAITING",
        refunded: 0,
      };
      result = {
        id: request,
        amount: p.priceCredits,
        currency: "AUD",
        bonus: p.name,
        status: "AWAITING",
        policy: s.policy.version,
      };
    } else {
      const journal = post(
        "pack",
        [
          ...debit(parts),
          { account: "system:pack-revenue", credits: p.priceCredits },
        ],
        "Pack purchase; no deposit bonus",
      );
      commerce(internal, `pay_${request}`, {
        kind: "payment",
        order: request,
        event: `credits_${request}`,
        cents: p.priceCredits,
        currency: "AUD",
        confirmed: true,
      });
      s.entitlements[request] = {
        member: actor.id,
        order: request,
        source: journal,
        status: "SEALED",
        restricted: parts.some((p) => !s.lots[p.lot].redeemable),
      };
      result = { entitlement: request, journal, price: p.priceCredits };
    }
  } else if (c.kind === "bind") {
    provider();
    const d = deposit(c.deposit);
    if (d.status !== "AWAITING") throw Error("Deposit not awaiting payment");
    if (!d.creditOnly)
      commerce(actor, request, {
        kind: "bind-paypal",
        order: d.order,
        providerOrder: c.providerOrder,
      });
    if (d.provider && d.provider !== c.providerOrder)
      throw Error("Provider binding immutable");
    if (
      Object.values(s.deposits).some(
        (x) => x !== d && x.provider === c.providerOrder,
      )
    )
      throw Error("Provider order already bound");
    d.provider = c.providerOrder;
  } else if (c.kind === "cancel-deposit") {
    const d = deposit(c.deposit);
    own(d.member);
    if (d.status !== "AWAITING")
      throw Error("Confirmed payment requires refund review");
    if (!d.creditOnly)
      commerce(actor, request, { kind: "cancel", order: d.order });
    d.status = "CANCELLED";
  } else if (c.kind === "expire-deposits") {
    admin();
    commerce(internal, request, { kind: "expire" });
    for (const d of Object.values(s.deposits))
      if (
        d.status === "AWAITING" &&
        !d.creditOnly &&
        s.commerce.orders[d.order].status === "EXPIRED"
      )
        d.status = "CANCELLED";
  } else if (c.kind === "capture") {
    provider();
    const d = deposit(c.deposit);
    if (d.creditOnly && c.merchant !== d.merchant)
      throw Error("Verified merchant mismatch");
    if (event("capture-event", c.event, c)) {
      const signature = [c.deposit, c.providerOrder, c.amount, c.currency];
      const first = event("capture-id", c.capture, signature);
      if (first) {
        if (
          d.status !== "AWAITING" ||
          d.provider !== c.providerOrder ||
          d.amount !== c.amount
        ) {
          d.status = "REVIEW";
          s.cases[request] = {
            reason: "Late/unmatched/duplicate payment: reconciliation required",
            member: d.member,
            status: "OPEN",
            reference: c.capture,
          };
        } else {
          if (!d.creditOnly)
            commerce(actor, request, {
              kind: "payment",
              order: d.order,
              event: c.event,
              providerOrder: c.providerOrder,
              capture: c.capture,
              cents: c.amount,
              currency: "AUD",
              confirmed: true,
            });
          if (!d.creditOnly && s.commerce.orders[d.order].status !== "PAID") {
            d.status = "REVIEW";
            s.cases[request] = {
              reason:
                "Expired reservation; refund/remedy review, no silent substitution",
              member: d.member,
              status: "OPEN",
              reference: c.capture,
            };
          } else {
            d.lot = lot(
              d.member,
              "purchased",
              d.creditOnly ? true : s.policy.purchasedWithdrawable,
              `payment:${c.capture}`,
            );
            d.capture = c.capture;
            d.clearAt = now + s.policy.clearingMs;
            d.status = "PENDING";
            post(
              "deposit",
              [
                { account: account(d.lot, "pending"), credits: d.amount },
                {
                  account: d.creditOnly
                    ? "system:provider-receivable"
                    : "system:provider-cash",
                  credits: -d.amount,
                },
              ],
              "Verified sandbox payment; member liability, not revenue",
            );
            if (!d.creditOnly)
              s.entitlements[d.order] = {
                member: d.member,
                order: d.order,
                source: c.capture,
                status: "SEALED",
                restricted: true,
              };
          }
        }
      }
    }
    result = { status: d.status };
  } else if (c.kind === "clear") {
    provider();
    const d = deposit(c.deposit);
    if (d.status !== "FULFILLED") {
      if (d.status !== "PENDING" || !d.lot || now < d.clearAt!)
        throw Error("Cleared funds required");
      post(
        "clear",
        [
          { account: account(d.lot, "pending"), credits: -d.amount },
          { account: account(d.lot, "available"), credits: d.amount },
        ],
        "Cleared purchased credits",
      );
      d.status = "FULFILLED";
    }
    result = {
      entitlement: d.creditOnly ? null : d.order,
      wallet: wallet(s, d.member),
    };
  } else if (c.kind === "open-pack") {
    const e = s.entitlements[c.entitlement];
    if (!e) throw Error("Unknown entitlement");
    own(e.member);
    if (e.status === "REVIEW") throw Error("Entitlement held for review");
    if (e.status === "SEALED") {
      commerce(internal, `open_${e.order}`, { kind: "fulfil", order: e.order });
      e.status = "OPENED";
      const card = s.commerce.orders[e.order].card;
      s.cards[card] = {
        version: 1,
        restricted: e.restricted,
        locked: false,
        history: [{ from: null, to: e.member, reference: e.order, at: now }],
      };
    }
    result = {
      receipt: e.order,
      card: s.commerce.orders[e.order].card,
      source: e.source,
    };
  } else if (c.kind === "list" || c.kind === "replace-listing") {
    member();
    if (c.kind === "replace-listing") {
      const old = s.listings[c.listing];
      if (
        !old ||
        old.member !== actor.id ||
        old.card !== c.card ||
        old.status !== "OPEN"
      )
        throw Error("Listing changed or closed");
      old.status = "CANCELLED";
      old.cancelledAt = now;
    }
    if ((c.preference === "swap") !== (c.price === 0))
      throw Error(
        "Swap listings have no asking price; credit sales require a positive price",
      );
    canTrade(c.card, actor.id);
    if (
      Object.values(s.listings).some(
        (l) => l.card === c.card && l.status === "OPEN",
      )
    )
      throw Error("Already listed");
    if (s.listings[request]) throw Error("Listing collision");
    s.listings[request] = {
      member: actor.id,
      card: c.card,
      version: s.cards[c.card].version,
      price: c.price,
      ...(c.preference ? { preference: c.preference } : {}),
      status: "OPEN",
      createdAt: now,
    };
    result = {
      listing: request,
      status: "OPEN",
      ...(c.price ? sellerQuote(c.price) : { price: 0, fee: 0, net: 0 }),
    };
  } else if (c.kind === "cancel-listing") {
    const l = s.listings[c.listing];
    if (!l) throw Error("Unknown listing");
    own(l.member);
    if (l.status === "SOLD")
      throw Error("Listing already sold; view the receipt");
    if (l.status === "OPEN") l.cancelledAt = now;
    l.status = "CANCELLED";
    result = { listing: c.listing, status: l.status };
  } else if (c.kind === "review-buy") {
    member();
    const l = s.listings[c.listing];
    if (!l || l.member === actor.id) throw Error("Listing unavailable");
    if (l.preference === "swap")
      throw Error("This card is open to swap offers only");
    if (l.status !== "OPEN")
      throw Error(`Listing ${l.status.toLowerCase()}; review updated details.`);
    canTrade(l.card, l.member, l.version);
    result = {
      review: request,
      listing: c.listing,
      card: l.card,
      version: l.version,
      seller: l.member,
      ...sellerQuote(l.price),
      policy: s.policy.version,
      expires: now + 300000,
    };
  } else if (c.kind === "buy") {
    member();
    policy(c.policy);
    const l = s.listings[c.listing];
    if (l && l.status !== "OPEN")
      throw Error(
        `Listing ${l.status.toLowerCase()} (stale review); view updated details.`,
      );
    if (
      !l ||
      l.status !== "OPEN" ||
      l.member === actor.id ||
      l.preference === "swap" ||
      c.expectedPrice !== l.price
    )
      throw Error("Invalid or stale listing");
    if (c.review) {
      const q = s.requests[`${actor.id}:${c.review}`]?.result as
        | {
            listing?: string;
            card?: string;
            version?: number;
            price?: number;
            policy?: string;
            expires?: number;
          }
        | undefined;
      if (
        !q ||
        q.listing !== c.listing ||
        q.card !== l.card ||
        q.version !== l.version ||
        q.price !== l.price ||
        q.policy !== s.policy.version ||
        !q.expires ||
        q.expires <= now
      )
        throw Error(
          "Purchase review expired or changed. Review this listing again.",
        );
    }
    const meta = canTrade(l.card, l.member, l.version),
      parts = select(actor.id, l.price),
      quote = sellerQuote(l.price);
    let feeLeft = quote.fee;
    const lines = debit(parts);
    for (const part of parts) {
      const fee = Math.min(part.amount, feeLeft);
      feeLeft -= fee;
      const net = part.amount - fee;
      if (net) {
        const dest = lot(
          l.member,
          "sale",
          s.lots[part.lot].redeemable && !meta.restricted,
          s.lots[part.lot].provenance,
        );
        s.lots[dest].parentLot = part.lot;
        lines.push({ account: account(dest, "available"), credits: net });
      }
    }
    lines.push({ account: "system:commission", credits: quote.fee });
    post("sale", lines, `Sale ${c.listing}: 7.5% seller commission`);
    meta.restricted ||= parts.some((p) => !s.lots[p.lot].redeemable);
    transfer(l.card, actor.id, c.listing);
    l.status = "SOLD";
    delete l.cancelledAt;
    l.buyer = actor.id;
    l.receipt = {
      reference: `${request}_sale`,
      at: now,
      price: l.price,
      fee: quote.fee,
      net: quote.net,
    };
    result = { ...quote, receipt: l.receipt, listing: c.listing, card: l.card };
  } else if (c.kind === "offer") {
    member();
    if (
      c.other === actor.id ||
      new Set([...c.give, ...c.take]).size !== c.give.length + c.take.length ||
      s.swaps[request]
    )
      throw Error("Invalid swap");
    c.give.forEach((v) => canTrade(v, actor.id));
    c.take.forEach((v) => canTrade(v, c.other));
    const fee = c.creditTopUp
      ? 0
      : swapFeeQuote(s.creditOnly, s.policy.swapFeeEach, now).feeEach;
    if (c.creditTopUp) {
      if (
        c.creditFeeMinimum !==
        swapFeeQuote(s.creditOnly, s.policy.swapFeeEach, now).feeEach
      )
        throw Error("Combined fee changed; review a new offer");
      combinedOfferQuote(c.creditTopUp, c.creditFeeMinimum);
    }
    if (c.feeEach !== fee)
      throw Error("Swap fee changed; review a fresh quote");
    select(actor.id, fee + (c.creditTopUp ?? 0));
    select(c.other, fee);
    s.swaps[request] = {
      member: actor.id,
      other: c.other,
      give: c.give,
      take: c.take,
      versions: [...c.give, ...c.take].map((v) => s.cards[v].version),
      expires: now + 86400000,
      status: "OPEN",
      feeEach: fee,
      ...(c.creditTopUp
        ? { creditTopUp: c.creditTopUp, creditFeeMinimum: c.creditFeeMinimum }
        : {}),
    };
    result = { offer: request, feeEach: fee, total: fee * 2 };
  } else if (
    ["accept", "reject", "cancel-swap", "expire-swap"].includes(c.kind)
  ) {
    if (!("swap" in c)) throw Error("Swap required");
    const offer = s.swaps[c.swap];
    if (!offer) throw Error("Offer closed");
    if (c.kind === "expire-swap" && offer.status === "EXPIRED") {
      if (actor.id !== offer.member && actor.id !== offer.other) admin();
    } else if (offer.status !== "OPEN")
      throw Error(
        offer.status === "EXPIRED" ? "Offer expired" : "Offer closed",
      );
    if (c.kind === "expire-swap") {
      if (actor.id !== offer.member && actor.id !== offer.other) admin();
      if (now < offer.expires) throw Error("Not expired");
      offer.status = "EXPIRED";
    } else if (c.kind === "cancel-swap") {
      own(offer.member);
      offer.status = "CANCELLED";
    } else {
      own(offer.other);
      if (now >= offer.expires) throw Error("Offer expired");
      if (c.kind === "reject") offer.status = "REJECTED";
      else {
        [...offer.give, ...offer.take].forEach((v, i) =>
          canTrade(
            v,
            i < offer.give.length ? offer.member : offer.other,
            offer.versions[i],
            c.swap,
          ),
        );
        const fee = offer.creditTopUp
          ? 0
          : swapFeeQuote(s.creditOnly, s.policy.swapFeeEach, now).feeEach;
        if (fee > offer.feeEach)
          throw Error(
            "Swap fee increased; both participants must consent to a new offer",
          );
        if (s.creditOnly && c.feeEach !== fee)
          throw Error("Swap fee changed; review before accepting");
        if (offer.creditTopUp) {
          const quote = combinedOfferQuote(
            offer.creditTopUp,
            offer.creditFeeMinimum ?? s.policy.swapFeeEach,
          );
          const parts = select(offer.member, offer.creditTopUp);
          const lines = debit(parts);
          let remainingFee = quote.fee;
          const restricted = [...offer.give, ...offer.take].some(
            (v) => s.cards[v].restricted,
          );
          for (const part of parts) {
            const fee = Math.min(remainingFee, part.amount);
            remainingFee -= fee;
            if (part.amount > fee) {
              const dest = lot(
                offer.other,
                "sale",
                s.lots[part.lot].redeemable && !restricted,
                s.lots[part.lot].provenance,
              );
              s.lots[dest].parentLot = part.lot;
              lines.push({
                account: account(dest, "available"),
                credits: part.amount - fee,
              });
            }
          }
          lines.push({ account: "system:commission", credits: quote.fee });
          post(
            "exchange-credit",
            lines,
            `Card exchange ${c.swap}: credit component commission`,
          );
          if (parts.some((p) => !s.lots[p.lot].redeemable))
            for (const id of [...offer.give, ...offer.take])
              s.cards[id].restricted = true;
        }
        const a = select(offer.member, fee),
          b = select(offer.other, fee);
        post(
          "swap",
          [
            ...debit(a),
            ...debit(b),
            { account: "system:swap-fees", credits: fee * 2 },
          ],
          `Completed pure swap: ${fee} per participant`,
        );
        offer.give.forEach((v) => transfer(v, offer.other, c.swap));
        offer.take.forEach((v) => transfer(v, offer.member, c.swap));
        // Conservative proposed anti-conversion rule: restricted value cannot be
        // laundered by swapping into a previously unrestricted resale card.
        if ([...offer.give, ...offer.take].some((v) => s.cards[v].restricted))
          for (const v of [...offer.give, ...offer.take])
            s.cards[v].restricted = true;
        offer.status = "ACCEPTED";
        offer.completedFeeEach = fee;
      }
    }
  } else if (c.kind === "fund") {
    admin();
    if (s.funding[c.source]) throw Error("Funding reference already used");
    s.funding[c.source] = { remaining: c.amount, approval: c.approval };
    post(
      "fund",
      [
        { account: "system:provider-cash", credits: -c.amount },
        { account: `system:funding:${c.source}`, credits: c.amount },
      ],
      `Synthetic backing reference ${c.bankReference}`,
    );
  } else if (c.kind === "promotion" || c.kind === "award") {
    admin();
    let source: string = "system:promotion-expense";
    let awardKey = "";
    if (c.kind === "award") {
      awardKey = `${c.sport}_${c.competition}_${c.round}_${c.member}`;
      if (s.awards[awardKey]) {
        if (
          s.awards[awardKey].revision !== c.revision ||
          s.awards[awardKey].fingerprint !== digest(c)
        )
          throw Error("Award correction requires review");
        return { state: original, result: { award: awardKey } };
      }
      s.prizes = generatePrizes(
        s.prizes,
        {
          competition: `${c.sport}_${c.competition}_${c.round}_${c.member}`,
          sport: c.sport,
          round: c.round,
          final: c.final,
          complete: true,
          revision: c.revision,
          winners: [
            { member: c.member, name: "Synthetic award member", rank: 1 },
            ...(c.tied
              ? [
                  {
                    member: "tie-fixture",
                    name: "Synthetic tied member",
                    rank: 1,
                  },
                ]
              : []),
          ],
        },
        {
          version: c.schedule,
          approved: c.approved,
          tiePolicy: c.tiePolicy,
          prizes: [
            {
              position: 1,
              description: "Docked Credits sandbox award",
              kind: "other",
              quantity: c.amount,
              currency: null,
              cents: null,
              verificationRequired: false,
            },
          ],
        },
        { id: actor.id, owner: true, aal: actor.aal! },
        new Date(now).toISOString(),
        new Date(now).toISOString(),
      );
      if (c.tied && c.tiePolicy === "hold")
        throw Error("Tied award held for review");
      source = "system:competition-expense";
    } else {
      if ((s.campaigns[c.campaign] ?? 0) + c.amount > s.policy.campaignLimit)
        throw Error("Campaign issuance limit");
      s.campaigns[c.campaign] = (s.campaigns[c.campaign] ?? 0) + c.amount;
    }
    if (c.redeemable) {
      const f = c.funding && s.funding[c.funding];
      if (!f || f.remaining < c.amount || !f.approval)
        throw Error("Approved identified backing required");
      f.remaining -= c.amount;
      source = `system:funding:${c.funding}`;
    }
    const lid = lot(
      c.member,
      c.kind === "promotion" ? "promotional" : "competition",
      c.redeemable,
      `${c.kind}:${request}`,
    );
    const jid = post(
      "issue",
      [
        { account: source, credits: -c.amount },
        { account: account(lid, "available"), credits: c.amount },
      ],
      c.reason,
    );
    if (awardKey)
      s.awards[awardKey] = {
        journal: jid,
        member: c.member,
        amount: c.amount,
        revision: (c as Extract<typeof c, { kind: "award" }>).revision,
        fingerprint: digest(c),
        status: "ISSUED",
      };
    result = { journal: jid, lot: lid, award: awardKey || null };
  } else if (c.kind === "award-correction") {
    admin();
    const a = s.awards[c.award];
    if (!a || c.revision <= a.revision)
      throw Error("New result revision required");
    a.status = "REVIEW";
    s.cases[request] = {
      reason: c.reason,
      member: a.member,
      reference: a.journal,
      status: "OPEN",
    };
  } else if (c.kind === "reverse") {
    admin();
    const j = s.journal.find((j) => j.id === c.journal);
    if (!j || !j.id.endsWith("_issue"))
      throw Error(
        "Only award/promotion compensation; other reversals require their workflow",
      );
    if (
      s.events.some(
        (e) =>
          (e.command as { kind?: string; journal?: string }).kind ===
            "reverse" &&
          (e.command as { journal: string }).journal === c.journal,
      )
    )
      throw Error("Already reversed or under recovery review");
    const target = j.lines.find((l) => l.account.startsWith("lot:"))!,
      lid = target.account.split(":")[1],
      b = creditBalances(s);
    if ((b[target.account] ?? 0) < target.credits)
      s.cases[request] = {
        reason:
          "Spent award/promotion; compensating recovery needs review, no invented debt",
        member: s.lots[lid].member,
        reference: j.id,
        status: "OPEN",
      };
    else {
      post(
        "reversal",
        j.lines.map((l) => ({ ...l, credits: -l.credits })),
        c.reason,
      );
      const backing = j.lines.find((l) =>
        l.account.startsWith("system:funding:"),
      );
      if (backing)
        s.funding[backing.account.slice(15)].remaining += -backing.credits;
    }
  } else if (c.kind === "kyc-start" || c.kind === "kyc-event") {
    result = commerce(actor, request, c);
  } else if (c.kind === "beneficiary") {
    admin();
    const old = s.commerce.beneficiaries[c.beneficiary];
    if (old && old.member !== c.member)
      throw Error("Beneficiary already bound");
    s.commerce.beneficiaries[c.beneficiary] = {
      member: c.member,
      verified: c.verified,
    };
  } else if (c.kind === "withdraw") {
    member();
    policy(c.policy);
    kyc(actor.id);
    const b = s.commerce.beneficiaries[c.beneficiary];
    if (!b?.verified || b.member !== actor.id)
      throw Error("Verified beneficiary required");
    if (
      (!s.creditOnly && c.amount < s.policy.minimumWithdrawal) ||
      s.withdrawals[request]
    )
      throw Error("Minimum or duplicate withdrawal");
    const parts = select(actor.id, c.amount, true);
    post(
      "reserve",
      [
        ...debit(parts),
        ...parts.map((p) => ({
          account: account(p.lot, "reserved"),
          credits: p.amount,
        })),
      ],
      "Withdrawal requested and reserved atomically",
    );
    s.withdrawals[request] = {
      member: actor.id,
      amount: c.amount,
      beneficiary: c.beneficiary,
      parts,
      status: "REQUESTED",
    };
  } else if (c.kind === "withdraw-review") {
    const w = withdraw(c.withdrawal);
    if (c.action === "cancel" && actor.role === "member") own(w.member);
    else admin();
    if (w.status !== "REQUESTED" && w.status !== "REVIEWED")
      throw Error("Cannot cancel submitted/uncertain payout");
    if (c.action === "approve") {
      if (w.parts.some((p) => held(s, s.lots[p.lot])))
        throw Error("Funding review blocks approval");
      kyc(w.member);
      if (!s.commerce.beneficiaries[w.beneficiary]?.verified)
        throw Error("Beneficiary revoked");
      w.status = "REVIEWED";
    } else {
      post(
        "release",
        [
          ...debit(w.parts, "reserved"),
          ...w.parts.map((p) => ({
            account: account(p.lot, "available"),
            credits: p.amount,
          })),
        ],
        c.reason,
      );
      w.status = "CANCELLED";
    }
  } else if (c.kind === "payout-submit") {
    provider();
    const w = withdraw(c.withdrawal);
    if (
      w.status !== "REVIEWED" ||
      Object.values(s.withdrawals).some((x) => x.provider === c.provider)
    )
      throw Error(
        "Payout already submitted or not reviewed; reconcile, never retry",
      );
    kyc(w.member);
    if (!s.commerce.beneficiaries[w.beneficiary]?.verified)
      throw Error("Beneficiary revoked");
    if (w.parts.some((p) => held(s, s.lots[p.lot])))
      throw Error("Recovery review blocks submission");
    if (-(creditBalances(s)["system:provider-cash"] ?? 0) < w.amount)
      throw Error(
        "Insufficient reconciled sandbox backing; no payout submission",
      );
    w.provider = c.provider;
    w.status = "SUBMITTED";
  } else if (c.kind === "payout-result") {
    provider();
    const w = withdraw(c.withdrawal);
    if (event("payout", c.event, c)) {
      if (
        w.provider !== c.provider ||
        !["SUBMITTED", "UNCERTAIN"].includes(w.status)
      ) {
        if (w.provider !== c.provider || w.status !== c.status)
          throw Error("Out-of-order payout requires reconciliation");
      } else {
        if (c.status === "PAID")
          post(
            "paid",
            [
              ...debit(w.parts, "reserved"),
              { account: "system:provider-cash", credits: w.amount },
            ],
            "Verified sandbox payout paid",
          );
        else if (c.status === "FAILED")
          post(
            "failed",
            [
              ...debit(w.parts, "reserved"),
              ...w.parts.map((p) => ({
                account: account(p.lot, "available"),
                credits: p.amount,
              })),
            ],
            "Conclusive failed payout; reserve released",
          );
        w.status = c.status;
      }
    }
  } else if (c.kind === "refund-event") {
    provider();
    const d = deposit(c.deposit);
    if (c.cumulativeRefund > d.amount) throw Error("Excess refund");
    if (
      event("refund", c.event, c) &&
      (c.dispute || c.cumulativeRefund > d.refunded)
    ) {
      const delta = Math.max(0, c.cumulativeRefund - d.refunded),
        b = creditBalances(s),
        e = s.entitlements[d.order];
      const bucket: Bucket =
        d.lot && (b[account(d.lot, "pending")] ?? 0) > 0
          ? "pending"
          : "available";
      const enough = d.lot && (b[account(d.lot, bucket)] ?? 0) >= delta;
      if (
        !c.dispute &&
        enough &&
        (d.creditOnly || (e && e.status !== "OPENED"))
      ) {
        post(
          "refund",
          [
            { account: account(d.lot!, bucket), credits: -delta },
            {
              account:
                d.creditOnly && !d.settlement
                  ? "system:provider-receivable"
                  : "system:provider-cash",
              credits: delta,
            },
          ],
          "Verified cumulative refund; compensating entry",
        );
      } else {
        if (delta)
          post(
            "refund-review",
            [
              { account: "system:recovery-review", credits: -delta },
              {
                account:
                  d.creditOnly && !d.settlement
                    ? "system:provider-receivable"
                    : "system:provider-cash",
                credits: delta,
              },
            ],
            "Provider refund cash movement; liability unresolved, no confiscation",
          );
        s.cases[request] = {
          reason: c.reason,
          member: d.member,
          status: "OPEN",
          reference: c.deposit,
        };
      }
      d.refunded = Math.max(d.refunded, c.cumulativeRefund);
      d.status = "REVIEW";
      s.cases[request] = {
        reason:
          c.reason +
          "; bonus remedy and funds eligibility require recorded review",
        member: d.member,
        status: "OPEN",
        reference: c.deposit,
      };
      if (e?.status === "SEALED") e.status = "REVIEW";
    }
  } else if (c.kind === "reconcile") {
    admin();
    s.reconciliation = {
      balance: c.balance,
      fees: c.fees,
      reserves: c.reserves,
      reference: c.reference,
      at: now,
    };
  } else throw Error("Unsupported operation");
  s.events.push({
    id: key,
    actor: actor.id,
    kind: c.kind,
    command: c,
    at: now,
  });
  s.requests[key] = { fingerprint, result: structuredClone(result) };
  validateCredits(s);
  validateRedemption(s);
  return { state: s, result };
}

export function financialReport(s: CreditsState) {
  const b = creditBalances(s),
    categories = { purchased: 0, sale: 0, promotional: 0, competition: 0 };
  let redeemableLiability = 0;
  for (const l of Object.values(s.lots)) {
    const n = (["available", "pending", "reserved"] as Bucket[]).reduce(
      (n, bucket) => n + (b[account(l.id, bucket)] ?? 0),
      0,
    );
    categories[l.category] += n;
    if (l.redeemable) redeemableLiability += n;
  }
  const cash = -(b["system:provider-cash"] ?? 0) || 0;
  const members = [...new Set(Object.values(s.lots).map((l) => l.member))];
  const balances = members.map((member) => ({ member, ...wallet(s, member) }));
  let issued = 0,
    extinguished = 0;
  // Crossing the member-ledger boundary is issuance/extinguishment. Resale and
  // reservations have zero net member movement except the explicit seller fee.
  for (const j of s.journal) {
    const net = j.lines
      .filter((l) => l.account.startsWith("lot:"))
      .reduce((n, l) => n + l.credits, 0);
    if (net > 0) issued += net;
    else extinguished -= net;
  }
  const outstanding = balances.reduce((n, w) => n + w.total, 0);
  const receivable = -(b["system:provider-receivable"] ?? 0) || 0;
  const disputedBacking = Object.values(s.deposits)
    .filter((d) => d.status === "REVIEW" && d.capture)
    .reduce((n, d) => n + d.amount - d.refunded, 0);
  const processingFees = -(b["system:processing-fees"] ?? 0) || 0;
  return {
    mode: s.mode,
    currency: "AUD",
    categories,
    redeemableLiability,
    simulatedProviderCash: cash,
    actualProviderBalance: null,
    actualBankBalance: null,
    creditOnlyVersion: s.creditOnly?.version ?? "LEGACY",
    reportingScope: "TEST_ONLY_EXCLUDED_FROM_COMMERCIAL_TOTALS",
    commercialPayments: 0,
    confirmedGrossPayments: Object.values(s.deposits)
      .filter((d) => d.capture)
      .reduce((n, d) => n + d.amount, 0),
    providerReceivable: receivable,
    settledNetReceipts: Object.values(s.deposits).reduce(
      (n, d) => n + (d.settlement?.net ?? 0),
      0,
    ),
    processingFees,
    refunds: Object.values(s.deposits).reduce((n, d) => n + d.refunded, 0),
    disputedBacking,
    eligibleSimulatedBacking: Math.max(0, cash + receivable - disputedBacking),
    balances,
    circulation: {
      issued,
      extinguished,
      outstanding,
      difference: issued - extinguished - outstanding,
    },
    unbalancedTransactions: s.journal
      .filter((j) => j.lines.reduce((n, l) => n + l.credits, 0) !== 0)
      .map((j) => j.id),
    fundingLots: Object.values(s.lots).map((l) => ({
      ...l,
      held: held(s, l),
      available: b[account(l.id, "available")] ?? 0,
      reserved: b[account(l.id, "reserved")] ?? 0,
      pending: b[account(l.id, "pending")] ?? 0,
    })),
    transactions: s.journal.map((j) => {
      const event = s.events
        .filter(
          (e) =>
            e.actor === j.actor &&
            j.id.startsWith(e.id.slice(e.actor.length + 1) + "_"),
        )
        .sort((a, b) => b.id.length - a.id.length)[0];
      const command = event?.command as { deposit?: string } | undefined;
      return {
        ...j,
        environment: s.mode,
        type: event?.kind ?? "LEGACY_UNCLASSIFIED",
        depositReference: command?.deposit ?? null,
      };
    }),
    legacyReview: {
      bonusEntitlements: Object.entries(s.entitlements)
        .filter(([, e]) => !e.source.endsWith("_pack"))
        .map(([id]) => id),
      unbackedTestGrants: Object.values(s.lots)
        .filter((l) => ["promotional", "competition"].includes(l.category))
        .map((l) => l.id),
      policy: "Preserved; no conversion, regrant or fabricated payment",
    },
    suppliedReconciliation: s.reconciliation,
    reconciliationDifference: s.reconciliation
      ? s.reconciliation.balance + s.reconciliation.reserves - cash
      : null,
    backingShortfall: Math.max(
      0,
      redeemableLiability - Math.max(0, cash - disputedBacking),
    ),
    commission: b["system:commission"] ?? 0,
    swapFees: b["system:swap-fees"] ?? 0,
    packRevenue: b["system:pack-revenue"] ?? 0,
    marketplaceVolume: Object.values(s.listings)
      .filter((l) => l.status === "SOLD")
      .reduce((n, l) => n + l.price, 0),
    pendingWithdrawals: Object.values(s.withdrawals)
      .filter((w) =>
        w.manual
          ? [
              "REQUESTED",
              "UNDER_REVIEW",
              "APPROVED",
              "PAYMENT_IN_PROGRESS",
              "EXCEPTION",
            ].includes(w.manual.status)
          : ["REQUESTED", "REVIEWED", "SUBMITTED", "UNCERTAIN"].includes(
              w.status,
            ),
      )
      .reduce((n, w) => n + w.amount, 0),
    completedWithdrawals: Object.values(s.withdrawals)
      .filter((w) => w.status === "PAID" || w.manual?.status === "SENT")
      .reduce((n, w) => n + w.amount, 0),
    deposits: Object.entries(s.deposits).map(([id, d]) => ({ id, ...d })),
    bonusEntitlements: Object.values(s.entitlements).filter(
      (e) => !e.source.endsWith("_pack"),
    ).length,
    openExceptions: Object.values(s.cases).filter((c) => c.status === "OPEN")
      .length,
    exceptions: Object.entries(s.cases).map(([id, c]) => ({ id, ...c })),
    funding: s.funding,
    note: "Synthetic accounting only. Deposits are member liabilities, not revenue. Actual provider/bank balance, fees and reserves unknown until independently reconciled. Journal entries do not establish cash backing.",
  };
}
