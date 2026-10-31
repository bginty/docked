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
  sport: "nfl" | "afl" | "nrl";
  credits: number;
  version: string;
};
export type StoreReceipt = {
  provider: "google" | "apple";
  key: string;
  product: StoreProduct;
  account: string;
  state: "PENDING" | "PURCHASED" | "CANCELLED" | "REVOKED";
  environment: "test";
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
  assertCustomerSport(product.sport);
  return product;
}
const googlePurchase = z.object({
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
    const response = await this.transport(
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${this.packageName}/purchases/productsv2/tokens/${encodeURIComponent(token)}`,
      {
        headers: { Authorization: `Bearer ${await this.accessToken()}` },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      },
    );
    // Never log tokens, raw provider bodies, OAuth responses or receipt-bearing URLs.
    if (!response.ok)
      throw Error("Purchase verification unavailable; retry reconciliation");
    const purchase = googlePurchase.parse(await response.json());
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
      state:
        item.productOfferDetails.refundableQuantity === 0
          ? "REVOKED"
          : purchase.purchaseStateContext.purchaseState,
    };
  }
  /** Worker calls this only after the existing-wallet transaction commits.
   * Retry failures through a durable outbox; a client callback cannot consume. */
  async consume(token: string, productId: string) {
    productFor(this.products, productId);
    const response = await this.transport(
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${this.packageName}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(token)}:consume`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await this.accessToken()}` },
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok)
      throw Error("Purchase consumption requires reconciliation");
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
