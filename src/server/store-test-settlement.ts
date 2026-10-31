import { createHash } from "node:crypto";
import { executeCredits, type CreditsState } from "../core/credits-sandbox";
import {
  assertStoreProduct,
  type StoreReceipt,
} from "./store-purchase-verification";

/** TEST integration with Docked's existing wallet, not a second store wallet.
 * The member adapter requires explicit expiring admission, TEST verification,
 * encrypted receipt inbox and transactional outbox deployment.
 * A caller must verify the receipt and lock its existing wallet aggregate first. */
export function settleStoreTestReceipt(
  before: CreditsState,
  receipt: StoreReceipt,
  member: string,
  expectedAccount: string,
  now: number,
) {
  if (
    before.mode !== "financial-sandbox-only" ||
    !before.creditOnly ||
    receipt.environment !== "test"
  )
    throw Error("Isolated test wallet required");
  if (!member || receipt.account !== expectedAccount)
    throw Error("Store account mismatch");
  assertStoreProduct(receipt.product);
  if (receipt.state === "PENDING") return { state: before, finish: false };
  const key =
    receipt.provider +
    "_" +
    createHash("sha256").update(receipt.key).digest("hex");
  const existing = before.deposits[key];
  if (
    existing &&
    (existing.member !== member || existing.amount !== receipt.product.credits)
  )
    throw Error("Purchase already bound to another account or product");
  if (existing && before.storeTestDeposits?.[key] &&
    (before.storeTestDeposits[key].product !== receipt.product.id ||
      before.storeTestDeposits[key].productVersion !== receipt.product.version))
    throw Error("Store product provenance mismatch");
  let state = before;
  const provider = {
    id: "store-test-provider",
    role: "payment-provider" as const,
  };
  const run = (
    actor: typeof provider | { id: string; role: "member" },
    suffix: string,
    command: unknown,
  ) => {
    state = executeCredits(state, actor, key + suffix, command, now).state;
  };
  if (receipt.state === "CANCELLED" || receipt.state === "REVOKED") {
    if (existing?.capture)
      run(provider, "_refund", {
        kind: "refund-event",
        deposit: key,
        event: key + "_revoked",
        cumulativeRefund: receipt.product.credits,
        dispute: false,
        reason: "Verified test store refund or revocation",
      });
    return { state, finish: false };
  }
  // A later stale purchase notification must never resurrect a revoked payment.
  if (existing?.refunded) return { state, finish: false };
  if (!existing) {
    run({ id: member, role: "member" }, "", {
      kind: "credit-deposit",
      cents: receipt.product.credits,
    });
    run(provider, "_bind", { kind: "bind", deposit: key, providerOrder: key });
    // executeCredits returned a new aggregate. This server-authored evidence is
    // committed atomically with the receipt and prevents TEST lots being redeemable.
    state.storeTestDeposits ??= {};
    state.storeTestDeposits[key] = {
      provider: receipt.provider,
      environment: "test",
      member,
      product: receipt.product.id,
      productVersion: receipt.product.version,
      credits: receipt.product.credits,
      verifiedAt: now,
    };
  }
  run(provider, "_capture", {
    kind: "capture",
    deposit: key,
    event: key + "_event",
    providerOrder: key,
    capture: key,
    amount: receipt.product.credits,
    currency: "AUD",
    verified: true,
    merchant: state.creditOnly!.merchant,
  });
  run(provider, "_clear", { kind: "clear", deposit: key });
  return { state, finish: true };
}
