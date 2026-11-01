import { z } from "zod";
import {
  storeAccountId,
  assertStoreProduct,
  type StoreProduct,
  type StoreReceipt,
} from "./store-purchase-verification";

type Identity = { member: string; session: string };
export function sameStoreProducts(
  a: readonly StoreProduct[],
  b: readonly StoreProduct[],
) {
  const key = (p: StoreProduct) =>
    JSON.stringify([
      p.id,
      p.version,
      p.credits,
      p.scope ?? "sport",
      p.sport ?? null,
    ]);
  return (
    a.length === b.length &&
    a.map(key).sort().join("\n") === b.map(key).sort().join("\n")
  );
}
export type StoreTestAdmission = {
  version: string;
  expiresAt: number;
  products: readonly StoreProduct[];
};
type Dependencies = {
  /** Must call the existing verified identity/session/MFA service, never decode a client claim. */
  authenticate: () => Promise<Identity>;
  /** Server-owned isolated acceptance membership; null is disabled. No public activation here. */
  admission: (who: Identity) => Promise<StoreTestAdmission | null>;
  rateLimit: (who: Identity) => Promise<boolean>;
  bindingSecret: string;
  verify: (token: string, account: string) => Promise<StoreReceipt>;
  accept: (
    receipt: StoreReceipt,
    member: string,
    account: string,
    token: string,
    grant: StoreTestAdmission,
  ) => Promise<unknown>;
};
const receiptBody = z
  .object({
    token: z
      .string()
      .min(1)
      .max(4096)
      .regex(/^[^\s\x00-\x1f]+$/),
  })
  .strict();

/** Authenticated member orchestration for an isolated TEST environment. It reuses
 * the verified receipt/inbox and wallet services; it does not provision accounts,
 * grant access, expose refunds, consume before commit or enable a hosted route.
 * The HTTP adapter must also apply the existing same-origin and bounded-body checks.
 */
export class MemberStoreTestPurchases {
  constructor(private deps: Dependencies) {}
  private async admitted() {
    const who = await this.deps.authenticate();
    if (!who.member || !who.session)
      throw Error("Verified member session required");
    const grant = structuredClone(await this.deps.admission(who));
    if (
      !grant ||
      !grant.version ||
      !Number.isFinite(grant.expiresAt) ||
      grant.expiresAt <= Date.now() ||
      !grant.products.length
    )
      throw Error("Store testing is not enabled for this account");
    grant.products.forEach(assertStoreProduct);
    if (new Set(grant.products.map((p) => p.id)).size !== grant.products.length)
      throw Error("Ambiguous store product configuration");
    if (!(await this.deps.rateLimit(who)))
      throw Error("Please wait before another purchase request");
    return {
      who,
      grant,
      account: storeAccountId(who.member, this.deps.bindingSecret),
    };
  }
  async session() {
    const { who, grant, account } = await this.admitted();
    return {
      member: who.member,
      accountBinding: account,
      products: grant.products.map((p) => ({ id: p.id, credits: p.credits })),
      environment: "test" as const,
    };
  }
  async receipt(input: unknown) {
    const { who, grant, account } = await this.admitted();
    let token: string;
    try {
      token = receiptBody.parse(input).token;
    } catch {
      throw Error("Invalid purchase reference");
    }
    let receipt: StoreReceipt;
    try {
      receipt = await this.deps.verify(token, account);
    } catch {
      throw Error(
        "Purchase not verified. Retry reconciliation; no fulfilment confirmed.",
      );
    }
    const approved = grant.products.find((p) => p.id === receipt.product.id);
    if (
      !approved ||
      receipt.environment !== "test" ||
      receipt.account !== account ||
      ["id", "version", "credits", "scope", "sport"].some(
        (k) =>
          approved[k as keyof StoreProduct] !==
          receipt.product[k as keyof StoreProduct],
      )
    )
      throw Error("Purchase does not match the approved account and product");
    // Verification is remote I/O. Recheck revocation/session and product approval
    // before handing off to the atomic inbox; admission must also be enforced in
    // the hosted transaction when this service is eventually wired to a route.
    const current = await this.admitted();
    if (
      current.who.member !== who.member ||
      current.who.session !== who.session ||
      current.account !== account ||
      current.grant.version !== grant.version ||
      !sameStoreProducts(current.grant.products, grant.products)
    )
      throw Error("Purchase session changed. Sign in and reconcile again.");
    try {
      await this.deps.accept(receipt, who.member, account, token, grant);
    } catch {
      throw Error(
        "Purchase fulfilment is not confirmed. Retry reconciliation.",
      );
    }
    return {
      state: receipt.state,
      receipt: receipt.key,
      reconciliationRequired: receipt.state === "PENDING",
    };
  }
}
