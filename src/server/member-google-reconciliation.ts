import "server-only";
import { db } from "./db";
import { StoreTestInbox } from "./store-test-inbox";
import { StoreTestReconciliation } from "./store-reconciliation";
import {
  GooglePlayTestVerifier,
  storeAccountId,
} from "./store-purchase-verification";
import { googlePlayOAuth } from "./google-play-oauth";
import { sameStoreProducts } from "./member-store-purchases";
import type { GooglePushPolicy } from "./google-store-notifications";
import draft from "../../config/store-credit-package-drafts.json";

/** Independent of new-purchase admission: refund recovery must continue when a
 * member's test grant expires. It can only revisit an already-bound TEST receipt.
 * No caller supplies a member, amount, product, token or an arbitrary job command. */
export function memberGoogleReconciliation() {
  if (
    process.env.DOCKED_GOOGLE_RECONCILIATION_ENABLED !== "true" ||
    process.env.DOCKED_FRIENDS_BETA !== "true" ||
    process.env.DOCKED_BETA_STAGING !== "true"
  )
    throw Error("Store reconciliation is disabled");
  const key = process.env.DOCKED_STORE_REFERENCE_KEY ?? "";
  const binding = process.env.DOCKED_STORE_ACCOUNT_BINDING_SECRET ?? "";
  if (!/^[a-f0-9]{64}$/.test(key) || binding.length < 32)
    throw Error("Store security configuration unavailable");
  const sql = db();
  const products = draft.products.map((p) => ({
    id: p.id,
    credits: p.credits,
    scope: "account" as const,
    version: draft.version,
  }));
  const verifier = new GooglePlayTestVerifier(
    "docked.fantasy",
    products,
    googlePlayOAuth(
      process.env.DOCKED_GOOGLE_SERVICE_EMAIL ?? "",
      process.env.DOCKED_GOOGLE_PRIVATE_KEY ?? "",
    ),
  );
  const inbox = new StoreTestInbox(
    {
      memberTestWallet: sql,
      authorize: async (tx, receipt, member) => {
        const [bound] =
          await tx`select member_id,product from credits_sandbox.store_receipts
      where provider='google' and receipt_key=${receipt.key} for update`;
        if (
          !bound ||
          bound.member_id !== member ||
          receipt.provider !== "google" ||
          receipt.environment !== "test" ||
          receipt.account !== storeAccountId(member, binding) ||
          !sameStoreProducts([bound.product], [receipt.product])
        )
          throw Error("Existing account-bound TEST receipt required");
      },
    },
    Buffer.from(key, "hex"),
  );
  const worker = new StoreTestReconciliation(inbox, verifier, (member) =>
    storeAccountId(member, binding),
  );
  const policy: GooglePushPolicy = {
    audience: process.env.DOCKED_GOOGLE_PUSH_AUDIENCE ?? "",
    serviceAccount: process.env.DOCKED_GOOGLE_PUSH_SERVICE_ACCOUNT ?? "",
    subscription: process.env.DOCKED_GOOGLE_PUSH_SUBSCRIPTION ?? "",
    packageName: "docked.fantasy",
  };
  return {
    policy,
    enqueue: (notice: Parameters<typeof worker.enqueue>[0]) =>
      worker.enqueue(notice),
    run: async () => {
      const [{ period }] =
        await sql`select to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI') period`;
      const scheduled = await worker.schedule(period);
      // A single bounded tick leaves unfinished work durable. Independent workers
      // claim separate leases; none relies on an open app or this computer.
      const results = await Promise.allSettled([
        worker.runOne(),
        worker.runOne(),
        worker.consumeOne(),
      ]);
      const health = await worker.health();
      return {
        scheduled: scheduled.length,
        completed: results.filter((r) => r.status === "fulfilled" && r.value)
          .length,
        ...health,
        attentionRequired: health.attention > 0 || health.overdue > 0,
      };
    },
  };
}
