import { createHmac, createHash } from "node:crypto";
import {
  Environment,
  SignedDataVerifier,
  type JWSTransactionDecodedPayload,
  type ResponseBodyV2DecodedPayload,
} from "@apple/app-store-server-library";
import {
  assertStoreProduct,
  type StoreProduct,
  type StoreReceipt,
} from "./store-purchase-verification";
import release from "../../config/mobile-store-release.json";

const uuid =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const transactionId = /^\d{1,32}$/;
/** Stable, non-identifying UUID for StoreKit's appAccountToken. Secret rotation
 * requires a binding migration; do not change it while receipts remain active. */
export function appleAccountToken(member: string, secret: string) {
  if (!member || secret.length < 32)
    throw Error("Apple account binding unavailable");
  const bytes = createHmac("sha256", secret)
    .update(`apple:${release.appleBundleId}\0${member}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 15) | 128; // RFC 9562 version 8, application-defined HMAC UUID.
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export type AppleNotice = {
  id: string;
  receiptKey: string | null;
  kind: "test" | "verify" | "review";
  occurredAt: number;
  reason: string;
};
type Decoder = Pick<
  SignedDataVerifier,
  "verifyAndDecodeTransaction" | "verifyAndDecodeNotification"
>;
export type AppleTransactionReader = {
  getTransactionInfo: (
    id: string,
  ) => Promise<{ signedTransactionInfo?: string }>;
};

/** Pure validation after cryptographic verification. Exported for realistic
 * fixtures; HTTP callers must use AppleSandboxPurchases, never decoded JSON. */
export function appleSandboxReceipt(
  t: JWSTransactionDecodedPayload,
  account: string,
  products: readonly StoreProduct[],
): StoreReceipt {
  if (
    !uuid.test(account) ||
    t.appAccountToken?.toLowerCase() !== account.toLowerCase()
  )
    throw Error("Purchase belongs to a different account");
  if (
    t.environment !== Environment.SANDBOX ||
    t.bundleId !== release.appleBundleId ||
    t.type !== "Consumable" ||
    t.quantity !== 1 ||
    !transactionId.test(t.transactionId ?? "") ||
    t.storefront !== "AUS" ||
    (t.inAppOwnershipType && t.inAppOwnershipType !== "PURCHASED")
  )
    throw Error("Unsupported Apple sandbox purchase");
  const product = products.find((p) => p.id === t.productId);
  if (!product) throw Error("Apple product is not approved");
  assertStoreProduct(product);
  if (
    t.revocationDate !== undefined &&
    (!Number.isFinite(t.revocationDate) || t.revocationDate <= 0)
  )
    throw Error("Invalid revocation evidence");
  return {
    provider: "apple",
    key: t.transactionId!,
    product,
    account: account.toLowerCase(),
    environment: "test",
    state: t.revocationDate === undefined ? "PURCHASED" : "REVOKED",
  };
}

/** Sandbox only. Uses Apple's maintained chain/JWS/online-revocation verifier.
 * A latest signed server readback is required, including when replaying a client
 * JWS, so an old successful transaction cannot conceal a later refund. */
export class AppleSandboxPurchases {
  constructor(
    private decoder: Decoder,
    private reader: AppleTransactionReader,
    private products: readonly StoreProduct[],
  ) {
    products.forEach(assertStoreProduct);
    if (new Set(products.map((p) => p.id)).size !== products.length)
      throw Error("Ambiguous Apple products");
  }
  static verified(
    roots: Buffer[],
    reader: AppleTransactionReader,
    products: readonly StoreProduct[],
  ) {
    if (!roots.length) throw Error("Apple trust roots required");
    return new AppleSandboxPurchases(
      new SignedDataVerifier(
        roots,
        true,
        Environment.SANDBOX,
        release.appleBundleId,
      ),
      reader,
      products,
    );
  }
  async verify(signed: string, account: string) {
    try {
      if (!signed || signed.length > 16000) throw Error();
      const original = appleSandboxReceipt(
        await this.decoder.verifyAndDecodeTransaction(signed),
        account,
        this.products,
      );
      const latest = await this.refresh(original.key, account);
      if (latest.product.id !== original.product.id) throw Error();
      return latest;
    } catch {
      throw Error("Apple sandbox purchase could not be verified");
    }
  }
  async refresh(id: string, account: string) {
    try {
      if (!transactionId.test(id) || !uuid.test(account)) throw Error();
      const response = await this.reader.getTransactionInfo(id);
      if (
        !response.signedTransactionInfo ||
        response.signedTransactionInfo.length > 16000
      )
        throw Error();
      const receipt = appleSandboxReceipt(
        await this.decoder.verifyAndDecodeTransaction(
          response.signedTransactionInfo,
        ),
        account,
        this.products,
      );
      if (receipt.key !== id) throw Error();
      return receipt;
    } catch {
      throw Error("Apple sandbox reconciliation is pending");
    }
  }
  async notification(signed: string): Promise<AppleNotice> {
    try {
      if (!signed || signed.length > 64000) throw Error();
      const n: ResponseBodyV2DecodedPayload =
        await this.decoder.verifyAndDecodeNotification(signed);
      if (
        !uuid.test(n.notificationUUID ?? "") ||
        n.version !== "2.0" ||
        n.data?.environment !== Environment.SANDBOX ||
        n.data.bundleId !== release.appleBundleId ||
        !Number.isSafeInteger(n.signedDate) ||
        n.signedDate! <= 0 ||
        n.signedDate! > Date.now() + 300000
      )
        throw Error();
      const id = createHash("sha256")
        .update(
          `apple:sandbox:${release.appleBundleId}:${n.notificationUUID!.toLowerCase()}`,
        )
        .digest("hex");
      if (n.notificationType === "TEST")
        return {
          id,
          receiptKey: null,
          kind: "test",
          occurredAt: n.signedDate!,
          reason: "TEST",
        };
      if (!n.data.signedTransactionInfo) throw Error();
      const t = await this.decoder.verifyAndDecodeTransaction(
        n.data.signedTransactionInfo,
      );
      const receipt = appleSandboxReceipt(
        t,
        t.appAccountToken ?? "",
        this.products,
      );
      const kind = ["ONE_TIME_CHARGE", "REFUND", "REVOKE"].includes(
        n.notificationType ?? "",
      )
        ? "verify"
        : "review";
      // Refund reversal/consumption requests require support review. Never send
      // consumption data without a separately approved consent policy.
      return {
        id,
        receiptKey: receipt.key,
        kind,
        occurredAt: n.signedDate!,
        reason: n.notificationType ?? "UNKNOWN",
      };
    } catch {
      throw Error("Apple notification not authenticated");
    }
  }
}
