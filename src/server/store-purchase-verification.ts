import { createHmac, createHash } from "node:crypto";
import { z } from "zod";
import {
  Environment,
  SignedDataVerifier,
} from "@apple/app-store-server-library";
import { assertCustomerSport } from "../core/customer-sports";
import storeRelease from "../../config/mobile-store-release.json";

export type StoreProduct = {
  id: string;
  credits: number;
  version: string;
} & (
  | { scope: "account"; sport?: never }
  | { scope?: "sport"; sport: "nfl" | "afl" | "nrl" }
);
/** Credit bundles fund the existing account wallet, not a separate sport wallet.
 * Legacy sport-labelled test products remain valid. Neither form activates a
 * product: the verifier still requires the server's explicit allowlist. */
export function assertStoreProduct(product: StoreProduct) {
  if (
    !product.id ||
    !Number.isSafeInteger(product.credits) ||
    product.credits <= 0 ||
    !product.version
  )
    throw Error("Approved integer product allocation required");
  if (product.scope === "account") {
    if (product.sport !== undefined)
      throw Error("Account credit products cannot carry a sport override");
  } else {
    if (product.scope !== undefined && product.scope !== "sport")
      throw Error("Unsupported store product scope");
    assertCustomerSport(product.sport);
  }
}
export type StoreReceipt = {
  provider: "google" | "apple";
  key: string;
  product: StoreProduct;
  account: string;
  state: "PENDING" | "PURCHASED" | "CANCELLED" | "REVOKED";
  environment: "test";
  consumed?: boolean;
  /** Server readback only; never accept an order ID supplied by a client. */
  orderId?: string;
};
export function storeAccountId(member: string, secret: string) {
  if (secret.length < 32 || !member)
    throw Error("Store account binding is not configured");
  return createHmac("sha256", secret).update(member).digest("hex");
}
function productFor(products: readonly StoreProduct[], id: string) {
  const product = products.find((p) => p.id === id);
  if (
    !product ||
    !Number.isSafeInteger(product.credits) ||
    product.credits <= 0 ||
    !product.version
  )
    throw Error("Store product is not approved");
  assertStoreProduct(product);
  return product;
}
const googlePurchase = z.object({
  orderId: z
    .string()
    .regex(/^GPA\.[0-9-]+$/)
    .optional(),
  purchaseStateContext: z.object({
    purchaseState: z.enum(["PENDING", "PURCHASED", "CANCELLED"]),
  }),
  testPurchaseContext: z.object({ fopType: z.literal("TEST") }),
  obfuscatedExternalAccountId: z.string().min(1),
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
              "CONSUMPTION_STATE_UNSPECIFIED",
              "CONSUMPTION_STATE_YET_TO_BE_CONSUMED",
              "CONSUMPTION_STATE_CONSUMED",
            ])
            .optional(),
        }),
      }),
    )
    .length(1),
});

/** Readback always uses Google's fixed API origin and server OAuth credentials.
 * Test purchases only. There is deliberately no production-payment switch.
 * Caller must derive expectedAccount from its authenticated member, never request JSON. */
export class GooglePlayTestVerifier {
  constructor(
    private packageName: string,
    private products: readonly StoreProduct[],
    private accessToken: () => Promise<string>,
    private transport: typeof fetch = fetch,
  ) {
    if (packageName !== storeRelease.applicationId)
      throw Error("Unapproved Android package");
  }
  async verify(token: string, expectedAccount: string): Promise<StoreReceipt> {
    if (!token || token.length > 4096 || /[\s\x00-\x1f]/.test(token))
      throw Error("Invalid purchase reference");
    const response = await this.request(
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${this.packageName}/purchases/productsv2/tokens/${encodeURIComponent(token)}`,
      {
        headers: { Authorization: `Bearer ${await this.authorizationToken()}` },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      },
    );
    // Never log tokens, raw provider bodies, OAuth responses or receipt-bearing URLs.
    if (!response.ok)
      throw Error("Purchase verification unavailable; retry reconciliation");
    // Provider validation errors can include raw input. Never propagate that
    // input to callers, logs or client responses (it may contain receipt data).
    let purchase: z.infer<typeof googlePurchase>;
    try {
      purchase = googlePurchase.parse(await response.json());
    } catch {
      throw Error("Unsupported or invalid test purchase response");
    }
    if (purchase.obfuscatedExternalAccountId !== expectedAccount)
      throw Error("Purchase belongs to a different account");
    const item = purchase.productLineItem[0];
    const product = productFor(this.products, item.productId);
    return {
      provider: "google",
      key: createHash("sha256")
        .update(this.packageName + "\0" + token)
        .digest("hex"),
      product,
      account: expectedAccount,
      environment: "test",
      orderId: purchase.orderId,
      consumed:
        item.productOfferDetails.consumptionState ===
        "CONSUMPTION_STATE_CONSUMED",
      state:
        item.productOfferDetails.refundableQuantity === 0
          ? "REVOKED"
          : purchase.purchaseStateContext.purchaseState,
    };
  }
  /** Worker calls this only after the existing-wallet transaction commits.
   * Retry failures through a durable outbox; a client callback cannot consume. */
  async consume(token: string, productId: string, expectedAccount: string) {
    productFor(this.products, productId);
    const verified = await this.verify(token, expectedAccount);
    if (verified.product.id !== productId || verified.state !== "PURCHASED")
      throw Error("Only a verified purchased test receipt can be consumed");
    if (verified.consumed) return;
    const response = await this.request(
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${this.packageName}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(token)}:consume`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await this.authorizationToken()}` },
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok) {
      // A prior delivery may have consumed successfully before the response was
      // lost. Only authoritative, account-bound readback resolves that retry.
      const latest = await this.verify(token, expectedAccount);
      if (
        latest.product.id === productId &&
        latest.state === "PURCHASED" &&
        latest.consumed
      )
        return;
      throw Error("Purchase consumption requires reconciliation");
    }
  }
  /** Explicit operator-only TEST refund. Verifies provenance immediately before
   * mutation; receipt tokens/account bindings select the order, never client IDs.
   * A successful refund request is not itself a ledger reversal: reconcile the
   * authoritative receipt afterwards. No production endpoint exposes this. */
  async refundTestPurchase(token: string, expectedAccount: string) {
    const receipt = await this.verify(token, expectedAccount);
    if (receipt.state === "REVOKED" || receipt.state === "CANCELLED")
      return { requested: false, alreadyReversed: true };
    if (receipt.state !== "PURCHASED" || !receipt.orderId)
      throw Error("Only a verified purchased test order can be refunded");
    const response = await this.request(
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${this.packageName}/orders/${encodeURIComponent(receipt.orderId)}:refund?revoke=true`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await this.authorizationToken()}` },
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok) {
      const latest = await this.verify(token, expectedAccount);
      if (latest.state === "REVOKED" || latest.state === "CANCELLED")
        return { requested: false, alreadyReversed: true };
      throw Error("Test refund not confirmed; reconcile before retrying");
    }
    return { requested: true, alreadyReversed: false };
  }
  private async authorizationToken() {
    try {
      const token = await this.accessToken();
      if (!token || /[\s\x00-\x1f]/.test(token)) throw Error();
      return token;
    } catch {
      throw Error(
        "Google purchase authorization unavailable; retry reconciliation",
      );
    }
  }
  private async request(url: string, options: RequestInit) {
    try {
      return await this.transport(url, options);
    } catch {
      throw Error("Google purchase service unavailable; retry reconciliation");
    }
  }
}

/** Uses Apple's maintained certificate/JWS verifier with online revocation checks.
 * Root certificates come from Apple PKI via secure server configuration, not a client. */
export class AppleStoreTestVerifier {
  private verifier: SignedDataVerifier;
  constructor(
    roots: Buffer[],
    private products: readonly StoreProduct[],
  ) {
    if (!roots.length) throw Error("Apple trust roots required");
    this.verifier = new SignedDataVerifier(
      roots,
      true,
      Environment.SANDBOX,
      storeRelease.appleBundleId,
    );
  }
  async verify(
    signedTransaction: string,
    expectedAccountToken: string,
  ): Promise<StoreReceipt> {
    const t = await this.verifier.verifyAndDecodeTransaction(signedTransaction);
    if (t.appAccountToken !== expectedAccountToken || !expectedAccountToken)
      throw Error("Purchase belongs to a different account");
    if (
      t.type !== "Consumable" ||
      t.quantity !== 1 ||
      !t.transactionId ||
      !t.productId ||
      t.storefront !== "AUS"
    )
      throw Error("Unsupported store purchase");
    return {
      provider: "apple",
      key: t.transactionId,
      product: productFor(this.products, t.productId),
      account: expectedAccountToken,
      environment: "test",
      state: t.revocationDate ? "REVOKED" : "PURCHASED",
    };
  }
  async verifyNotification(signedPayload: string) {
    return this.verifier.verifyAndDecodeNotification(signedPayload);
  }
}
