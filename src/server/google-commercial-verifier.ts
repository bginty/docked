import { createHash } from "node:crypto";
import { z } from "zod";
import {
  commercialProducts,
  type BillingEnvironment,
  type CommercialReceipt,
} from "../core/commercial-billing";
const money = z.object({
  currencyCode: z.literal("AUD"),
  units: z
    .string()
    .regex(/^\d{1,12}$/)
    .default("0"),
  nanos: z.number().int().min(0).max(999999999).default(0),
});
export function googleAudCents(input: unknown) {
  const m = money.parse(input);
  if (m.nanos % 10000000) throw Error("Fractional cents need review");
  const n = BigInt(m.units) * 100n + BigInt(m.nanos / 10000000);
  if (n > BigInt(Number.MAX_SAFE_INTEGER)) throw Error("Amount out of range");
  return Number(n);
}
const purchaseSchema = z.object({
  orderId: z
    .string()
    .regex(/^GPA\.[0-9-]+$/)
    .optional(),
  purchaseStateContext: z.object({
    purchaseState: z.enum(["PENDING", "PURCHASED", "CANCELLED"]),
  }),
  testPurchaseContext: z.object({ fopType: z.literal("TEST") }).optional(),
  obfuscatedExternalAccountId: z.string().regex(/^[a-f0-9]{64}$/),
  regionCode: z.literal("AU"),
  productLineItem: z
    .array(
      z.object({
        productId: z.string(),
        productOfferDetails: z.object({
          quantity: z.literal(1),
          refundableQuantity: z.number().int().min(0).max(1),
          consumptionState: z
            .enum([
              "CONSUMPTION_STATE_YET_TO_BE_CONSUMED",
              "CONSUMPTION_STATE_CONSUMED",
            ])
            .optional(),
          purchaseOptionId: z.literal("buy-au"),
          offerId: z.string().optional(),
          rentOfferDetails: z.never().optional(),
          preorderOfferDetails: z.never().optional(),
        }),
      }),
    )
    .length(1),
});
const refund = z.object({ total: money });
const orderSchema = z.object({
  orderId: z.string(),
  purchaseToken: z.string(),
  state: z.enum([
    "PENDING",
    "PROCESSED",
    "CANCELED",
    "PENDING_REFUND",
    "PARTIALLY_REFUNDED",
    "REFUNDED",
  ]),
  lastEventTime: z.string().datetime({ offset: true }),
  total: money,
  tax: money.optional(),
  lineItems: z
    .array(
      z.object({
        productId: z.string(),
        oneTimePurchaseDetails: z.object({
          quantity: z.literal(1),
          purchaseOptionId: z.literal("buy-au"),
          offerId: z.string().optional(),
        }),
      }),
    )
    .length(1),
  orderHistory: z
    .object({
      refundEvent: z.object({ refundDetails: refund }).optional(),
      partialRefundEvents: z
        .array(
          z.object({
            state: z.enum(["PENDING", "PROCESSED_SUCCESSFULLY"]),
            refundDetails: refund,
          }),
        )
        .optional(),
    })
    .optional(),
});
/** Separate commercial trust boundary. TEST receipts can only enter an isolated
 * acceptance ledger; this class never calls the legacy test-wallet engine. */
export class GoogleCommercialVerifier {
  private readonly base =
    "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/docked.fantasy/";
  constructor(
    readonly environment: BillingEnvironment,
    private oauth: () => Promise<string>,
    private transport: typeof fetch = fetch,
  ) {}
  private async request(path: string, method = "GET") {
    try {
      const auth = await this.oauth();
      if (!auth || /[\s\x00-\x1f]/.test(auth)) throw Error();
      const r = await this.transport(this.base + path, {
        method,
        headers: { Authorization: `Bearer ${auth}` },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) throw Error();
      return r;
    } catch {
      throw Error("Google verification unavailable; reconciliation required");
    }
  }
  async verify(token: string, account: string): Promise<CommercialReceipt> {
    if (!token || token.length > 4096 || /[\s\x00-\x1f]/.test(token))
      throw Error("Invalid purchase reference");
    try {
      const p = purchaseSchema.parse(
        await (
          await this.request(
            `purchases/productsv2/tokens/${encodeURIComponent(token)}`,
          )
        ).json(),
      );
      if (
        (this.environment === "acceptance") !==
          Boolean(p.testPurchaseContext) ||
        p.obfuscatedExternalAccountId !== account
      )
        throw Error();
      const item = p.productLineItem[0],
        product = commercialProducts.find((x) => x.id === item.productId);
      if (!product || item.productOfferDetails.offerId) throw Error();
      const r: CommercialReceipt = {
        key: createHash("sha256")
          .update("docked.fantasy\0" + token)
          .digest("hex"),
        account,
        environment: this.environment,
        product,
        state: p.purchaseStateContext.purchaseState,
        consumed:
          item.productOfferDetails.consumptionState ===
          "CONSUMPTION_STATE_CONSUMED",
        paid: false,
        orderId: p.orderId ?? null,
        grossCents: null,
        taxCents: null,
        refundedCents: 0,
        providerAt: null,
      };
      if (!p.orderId) {
        if (r.state === "PURCHASED") throw Error();
        return r;
      }
      const o = orderSchema.parse(
        await (
          await this.request(`orders/${encodeURIComponent(p.orderId)}`)
        ).json(),
      );
      if (
        o.orderId !== p.orderId ||
        o.purchaseToken !== token ||
        o.lineItems[0].productId !== product.id ||
        o.lineItems[0].oneTimePurchaseDetails.offerId
      )
        throw Error();
      r.paid = [
        "PROCESSED",
        "PENDING_REFUND",
        "PARTIALLY_REFUNDED",
        "REFUNDED",
      ].includes(o.state);
      r.grossCents = googleAudCents(o.total);
      r.taxCents = o.tax ? googleAudCents(o.tax) : null;
      r.providerAt = o.lastEventTime;
      if (r.taxCents !== null && r.taxCents > r.grossCents) throw Error();
      const partial = (o.orderHistory?.partialRefundEvents ?? [])
        .filter((x) => x.state === "PROCESSED_SUCCESSFULLY")
        .reduce((s, x) => s + googleAudCents(x.refundDetails.total), 0);
      // Full refund is cumulative total; do not add prior partial refunds again.
      r.refundedCents = o.orderHistory?.refundEvent
        ? googleAudCents(o.orderHistory.refundEvent.refundDetails.total)
        : partial;
      if (
        !Number.isSafeInteger(r.refundedCents) ||
        r.refundedCents > r.grossCents
      )
        throw Error();
      if (o.state === "REFUNDED") {
        if (r.refundedCents !== r.grossCents) throw Error();
        r.state = "REVOKED";
      } else if (
        o.state === "PARTIALLY_REFUNDED" ||
        o.state === "PENDING_REFUND" ||
        partial > 0
      )
        r.state = "REVIEW";
      else if (o.state === "CANCELED") r.state = "CANCELLED";
      else if (o.state === "PENDING") r.state = "PENDING";
      else if (r.state !== "PURCHASED") throw Error();
      if (
        p.purchaseStateContext.purchaseState === "PURCHASED" &&
        item.productOfferDetails.refundableQuantity === 0
      ) {
        // Revoked entitlement with an incomplete money readback is held, never given a fabricated cash refund.
        r.state = r.refundedCents === r.grossCents ? "REVOKED" : "REVIEW";
      }
      if (r.grossCents !== product.audCents && r.state === "PURCHASED")
        r.state = "REVIEW";
      return r;
    } catch {
      throw Error(
        "Purchase identity, environment or provider evidence not verified",
      );
    }
  }
  /** Consume is Google's acknowledgement for consumables. Only after credit commit. */
  async consume(token: string, account: string) {
    const r = await this.verify(token, account);
    if (r.state !== "PURCHASED")
      throw Error("Only fulfilled purchases may be consumed");
    if (r.consumed) return;
    try {
      await this.request(
        `purchases/products/${encodeURIComponent(r.product.id)}/tokens/${encodeURIComponent(token)}:consume`,
        "POST",
      );
    } catch {
      const latest = await this.verify(token, account);
      if (!latest.consumed || latest.state !== "PURCHASED")
        throw Error("Consumption retry required");
    }
  }
}
