import { z } from "zod";
// Trusted service domain only. No public endpoint accepts these actors or commands.
// All balances and inventory in this module are synthetic, never production money.
export type Operator = {
  id: string;
  role: "member" | "reviewer" | "payment-provider" | "identity-provider";
  aal?: "aal1" | "aal2";
};
export type Order = {
  id: string;
  member: string;
  product: string;
  price: number;
  currency: "AUD";
  method: "paypal" | "bank";
  reference: string;
  expires: number;
  status:
    | "AWAITING_PAYMENT"
    | "PAID"
    | "FULFILLED"
    | "EXPIRED"
    | "CANCELLED"
    | "REVIEW";
  card: string;
  providerOrder?: string;
  receipt?: string;
};
export type State = {
  mode: "synthetic-only";
  products: Record<
    string,
    {
      tier: string;
      cents: number;
      pool: string[];
      method: "named";
      sport: "epl" | "nfl" | "afl";
    }
  >;
  cards: Record<
    string,
    {
      tier: string;
      sport: string;
      owner: string | null;
      reserved: string | null;
    }
  >;
  orders: Record<string, Order>;
  events: {
    id: string;
    actor: string;
    kind: string;
    at: number;
    details: object;
  }[];
  requests: Record<string, { digest: string; result: unknown }>;
  providerEvents: Record<string, string>;
  kyc: Record<
    string,
    {
      state:
        "UNVERIFIED" | "PENDING" | "VERIFIED" | "REVIEW_REQUIRED" | "EXPIRED";
      session: string;
      revision: number;
      expires: number;
    }
  >;
  beneficiaries: Record<string, { member: string; verified: boolean }>;
  funds: Record<string, { eligible: number; reserved: number }>;
  withdrawals: Record<
    string,
    {
      id: string;
      member: string;
      cents: number;
      beneficiary: string;
      status: "REQUESTED" | "APPROVED" | "CANCELLED" | "FAILED";
    }
  >;
};
const identifier = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
export const commerceCommand = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("order"),
      product: identifier,
      card: identifier,
      method: z.enum(["paypal", "bank"]),
    })
    .strict(),
  z.object({ kind: z.literal("cancel"), order: identifier }).strict(),
  z.object({ kind: z.literal("expire") }).strict(),
  z
    .object({
      kind: z.literal("bind-paypal"),
      order: identifier,
      providerOrder: identifier,
    })
    .strict(),
  z
    .object({
      kind: z.literal("payment"),
      order: identifier,
      event: identifier,
      providerOrder: identifier.optional(),
      capture: identifier.optional(),
      cents: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
      currency: z.literal("AUD"),
      confirmed: z.literal(true),
    })
    .strict(),
  z.object({ kind: z.literal("fulfil"), order: identifier }).strict(),
  z
    .object({
      kind: z.literal("payment-review"),
      order: identifier,
      event: identifier,
      reason: z.enum(["refund", "dispute", "unmatched", "excess", "partial"]),
    })
    .strict(),
  z.object({ kind: z.literal("kyc-start"), session: identifier }).strict(),
  z
    .object({
      kind: z.literal("kyc-event"),
      member: identifier,
      event: identifier,
      session: identifier,
      revision: z.number().int().positive(),
      state: z.enum(["PENDING", "VERIFIED", "REVIEW_REQUIRED", "EXPIRED"]),
      expires: z.number().int().nonnegative(),
      reason: z.string().min(12).optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("withdraw"),
      cents: z.number().int().positive(),
      beneficiary: identifier,
    })
    .strict(),
  z
    .object({
      kind: z.literal("withdraw-review"),
      withdrawal: identifier,
      status: z.enum(["APPROVED", "CANCELLED", "FAILED"]),
      reason: z.string().min(10),
    })
    .strict(),
  z.object({ kind: z.literal("payout"), withdrawal: identifier }).strict(),
]);
export function initialCommerce(): State {
  return {
    mode: "synthetic-only",
    products: {},
    cards: {},
    orders: {},
    events: [],
    requests: {},
    providerEvents: {},
    kyc: {},
    beneficiaries: {},
    funds: {},
    withdrawals: {},
  };
}
export function executeCommerce(
  original: State,
  actor: Operator,
  request: string,
  input: unknown,
  now: number,
) {
  const c = commerceCommand.parse(input);
  identifier.parse(request);
  identifier.parse(actor.id);
  if (original.mode !== "synthetic-only" || !Number.isSafeInteger(now))
    throw Error("Synthetic commerce only");
  const s = structuredClone(original),
    key = `${actor.id}:${request}`,
    fingerprint = JSON.stringify(c);
  const prior = s.requests[key];
  if (prior) {
    if (prior.digest !== fingerprint) throw Error("Idempotency conflict");
    return { state: s, result: prior.result };
  }
  const reviewer = () => {
    if (actor.role !== "reviewer" || actor.aal !== "aal2")
      throw Error("Reviewer MFA required");
  };
  const service = () => {
    if (actor.role !== "payment-provider") reviewer();
  };
  const owner = (member: string) => {
    if (actor.id !== member) throw Error("Account isolation");
  };
  const order = (id: string) => {
    const o = s.orders[id];
    if (!o) throw Error("Unknown order");
    return o;
  };
  const eligible = (member: string) => {
    const k = s.kyc[member];
    if (!k || k.state !== "VERIFIED" || k.expires <= now)
      throw Error("Verified current identity required");
  };
  let result: unknown = { ok: true };
  if (c.kind === "order") {
    if (actor.role !== "member") throw Error("Member purchase required");
    const p = s.products[c.product],
      card = s.cards[c.card];
    if (
      !p ||
      p.method !== "named" ||
      !p.pool.includes(c.card) ||
      !card ||
      card.owner ||
      card.reserved ||
      card.tier !== p.tier ||
      card.sport !== p.sport
    )
      throw Error("Eligible supply unavailable");
    if (!Number.isSafeInteger(p.cents) || p.cents <= 0)
      throw Error("Server price required");
    const id = request;
    if (s.orders[id]) throw Error("Order reference collision");
    const o: Order = {
      id,
      member: actor.id,
      product: c.product,
      price: p.cents,
      currency: "AUD",
      method: c.method,
      reference: `DK-${id}`,
      expires: now + 30 * 60000,
      status: "AWAITING_PAYMENT",
      card: c.card,
    };
    s.orders[id] = o;
    card.reserved = id;
    result = o;
  } else if (c.kind === "cancel") {
    const o = order(c.order);
    owner(o.member);
    if (o.status !== "AWAITING_PAYMENT")
      throw Error("Paid orders require reviewed refund");
    o.status = "CANCELLED";
    s.cards[o.card].reserved = null;
  } else if (c.kind === "expire") {
    service();
    for (const o of Object.values(s.orders))
      if (o.status === "AWAITING_PAYMENT" && o.expires <= now) {
        o.status = "EXPIRED";
        s.cards[o.card].reserved = null;
      }
  } else if (c.kind === "bind-paypal") {
    service();
    const o = order(c.order);
    if (
      o.method !== "paypal" ||
      o.status !== "AWAITING_PAYMENT" ||
      o.expires <= now ||
      Object.values(s.orders).some(
        (x) => x.id !== o.id && x.providerOrder === c.providerOrder,
      ) ||
      (o.providerOrder && o.providerOrder !== c.providerOrder)
    )
      throw Error("Invalid provider order binding");
    o.providerOrder = c.providerOrder;
  } else if (c.kind === "payment") {
    service();
    const o = order(c.order);
    const eventKey = `${o.method}:${c.event}`,
      seen = s.providerEvents[eventKey];
    if (seen && seen !== fingerprint) throw Error("Provider event collision");
    if (!seen) {
      if (
        o.method === "paypal" &&
        (actor.role !== "payment-provider" ||
          !c.capture ||
          !o.providerOrder ||
          c.providerOrder !== o.providerOrder)
      )
        throw Error("Verified bound PayPal capture required");
      if (o.method === "bank") reviewer();
      s.providerEvents[eventKey] = fingerprint;
      const captureKey = `capture:${c.capture}`,
        captureValue = JSON.stringify([
          o.id,
          c.providerOrder,
          c.cents,
          c.currency,
        ]),
        priorCapture = c.capture ? s.providerEvents[captureKey] : undefined;
      if (priorCapture && priorCapture !== captureValue)
        throw Error("Capture collision");
      if (priorCapture) {
        result = o;
      } else if (
        o.status !== "AWAITING_PAYMENT" ||
        o.expires <= now ||
        o.price !== c.cents ||
        s.cards[o.card].reserved !== o.id
      ) {
        o.status = "REVIEW";
        result = {
          status: "REVIEW",
          reason: "Payment requires reconciliation; no automatic allocation",
        };
      } else {
        o.status = "PAID";
        o.receipt = c.event;
        result = o;
      }
      if (c.capture) s.providerEvents[captureKey] = captureValue;
    }
  } else if (c.kind === "fulfil") {
    service();
    const o = order(c.order);
    if (o.status !== "FULFILLED") {
      const card = s.cards[o.card];
      if (
        o.status !== "PAID" ||
        !o.receipt ||
        card.owner ||
        card.reserved !== o.id
      )
        throw Error("Confirmed funds and original reservation required");
      card.owner = o.member;
      card.reserved = null;
      o.status = "FULFILLED";
    }
    result = o;
  } else if (c.kind === "payment-review") {
    service();
    const o = order(c.order);
    o.status = "REVIEW"; // preserve issued card and audit; never silently revoke ownership
  } else if (c.kind === "kyc-start") {
    if (actor.role !== "member") throw Error("Own verification only");
    if (Object.values(s.kyc).some((k) => k.session === c.session))
      throw Error("Verification session already bound");
    s.kyc[actor.id] = {
      state: "PENDING",
      session: c.session,
      revision: 0,
      expires: 0,
    };
  } else if (c.kind === "kyc-event") {
    if (actor.role !== "identity-provider") {
      reviewer();
      if (!c.reason) throw Error("Audited identity review reason required");
    }
    const k = s.kyc[c.member];
    if (!k || k.session !== c.session)
      throw Error("Bound identity session required");
    const eventKey = `kyc:${c.event}`,
      seen = s.providerEvents[eventKey];
    if (seen && seen !== fingerprint) throw Error("Identity event collision");
    if (!seen) {
      s.providerEvents[eventKey] = fingerprint;
      if (c.revision > k.revision) {
        if (c.state === "VERIFIED" && c.expires <= now)
          throw Error("Verification expiry required");
        Object.assign(k, {
          state: c.state,
          revision: c.revision,
          expires: c.expires,
        });
      }
    }
  } else if (c.kind === "withdraw") {
    if (actor.role !== "member") throw Error("Own withdrawal only");
    eligible(actor.id);
    const b = s.beneficiaries[c.beneficiary],
      f = s.funds[actor.id];
    if (!b?.verified || b.member !== actor.id)
      throw Error("Verified owned beneficiary required");
    if (!f || f.eligible - f.reserved < c.cents)
      throw Error("Insufficient eligible funds");
    if (s.withdrawals[request]) throw Error("Withdrawal reference collision");
    f.reserved += c.cents;
    s.withdrawals[request] = {
      id: request,
      member: actor.id,
      cents: c.cents,
      beneficiary: c.beneficiary,
      status: "REQUESTED",
    };
    result = s.withdrawals[request];
  } else if (c.kind === "withdraw-review") {
    const w = s.withdrawals[c.withdrawal];
    if (!w) throw Error("Unknown withdrawal");
    if (c.status === "CANCELLED" && actor.role === "member") owner(w.member);
    else reviewer();
    if (
      w.status !== "REQUESTED" &&
      !(
        actor.role === "reviewer" &&
        w.status === "APPROVED" &&
        c.status === "FAILED"
      )
    )
      throw Error("Invalid withdrawal transition");
    if (c.status === "APPROVED") {
      eligible(w.member);
      if (!s.beneficiaries[w.beneficiary]?.verified)
        throw Error("Beneficiary verification revoked");
    } else s.funds[w.member].reserved -= w.cents;
    w.status = c.status;
    result = w;
  } else {
    throw Error(
      "Real payouts disabled; no payout rail or eligible earning mechanism activated",
    );
  }
  s.events.push({
    id: key,
    actor: actor.id,
    kind: c.kind,
    at: now,
    details: c,
  });
  s.requests[key] = { digest: fingerprint, result: structuredClone(result) };
  return { state: s, result };
}
