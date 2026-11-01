import "server-only";
import type { Sql, TransactionSql } from "postgres";
import { requireIdentity } from "./auth";
import { db, rateLimit } from "./db";
import { setCommunityClaims } from "./community-social";
import {
  MemberStoreTestPurchases,
  sameStoreProducts,
  type StoreTestAdmission,
} from "./member-store-purchases";
import { StoreTestInbox } from "./store-test-inbox";
import { GooglePlayTestVerifier } from "./store-purchase-verification";
import { googlePlayOAuth } from "./google-play-oauth";
import draft from "../../config/store-credit-package-drafts.json";
import { storeAdmissionQuery } from "./store-admission-query";

/** Same member authentication, same wallet/ledger and same pack engine. Only
 * Google's no-charge TEST receipts are accepted; no production-money switch.
 * Admission is empty by default and can only be provisioned by an operator. */
export async function memberGoogleTest() {
  if (
    process.env.DOCKED_MEMBER_GOOGLE_TEST !== "true" ||
    process.env.DOCKED_FRIENDS_BETA !== "true" ||
    process.env.DOCKED_BETA_STAGING !== "true"
  )
    throw Error("Google test purchasing is disabled");
  const who = await requireIdentity(),
    sql = db();
  const key = process.env.DOCKED_STORE_REFERENCE_KEY ?? "";
  if (!/^[a-f0-9]{64}$/.test(key))
    throw Error("Store security configuration unavailable");
  const products = draft.products.map((p) => ({
    id: p.id,
    credits: p.credits,
    scope: "account" as const,
    version: draft.version,
  }));
  const readGrant = async (tx: Sql): Promise<StoreTestAdmission | null> => {
    await setCommunityClaims(tx as unknown as TransactionSql, who);
    const [row] = await tx.unsafe(storeAdmissionQuery);
    const grant = row?.admission as StoreTestAdmission | null;
    if (!grant || !sameStoreProducts(grant.products, products)) return null;
    return grant;
  };
  const verifier = new GooglePlayTestVerifier(
    "docked.fantasy",
    products,
    googlePlayOAuth(
      process.env.DOCKED_GOOGLE_SERVICE_EMAIL ?? "",
      process.env.DOCKED_GOOGLE_PRIVATE_KEY ?? "",
    ),
  );
  const service = new MemberStoreTestPurchases({
    authenticate: async () => ({ member: who.user.id, session: who.sessionId }),
    admission: async () =>
      (await sql.begin((tx) =>
        readGrant(tx as unknown as Sql),
      )) as StoreTestAdmission | null,
    rateLimit: () => rateLimit(`google-test:${who.user.id}`, 20, 60),
    bindingSecret: process.env.DOCKED_STORE_ACCOUNT_BINDING_SECRET ?? "",
    verify: (token, account) => verifier.verify(token, account),
    accept: async (receipt, member, account, token, grant) => {
      const inbox = new StoreTestInbox(
        {
          memberTestWallet: sql,
          authorize: async (tx, current, id) => {
            const active = await readGrant(tx);
            if (
              id !== who.user.id ||
              current.environment !== "test" ||
              !active ||
              active.version !== grant.version ||
              !sameStoreProducts(active.products, grant.products)
            )
              throw Error("Store test admission changed");
          },
        },
        Buffer.from(key, "hex"),
      );
      await inbox.accept(receipt, member, account, token);
      // Consume only after atomic fulfilment. A failure stays in the durable
      // outbox; it does not reverse crediting or report an unsuccessful purchase.
      try {
        await inbox.deliverOne(async (provider, reference, product) => {
          if (provider !== "google") throw Error("Unsupported provider");
          await verifier.consume(reference, product, account);
        }, receipt.key);
      } catch {
        /* Retry through authenticated reconciliation. */
      }
    },
  });
  return {
    session: () => service.session(),
    receipt: (body: unknown) => service.receipt(body),
    reconcile: async () => {
      await service.session();
      // Also revisit consumed purchases: Play's native query omits them, but
      // they can subsequently be refunded. References never leave the server.
      const reader = new StoreTestInbox(
        {
          memberTestWallet: sql,
          authorize: async () => {
            throw Error("Read-only receipt scope");
          },
        },
        Buffer.from(key, "hex"),
      );
      const refs = await reader.references(who.user.id, 4);
      for (const ref of refs) await service.receipt({ token: ref.token });
      return { checked: refs.length, morePossible: refs.length === 4 };
    },
  };
}
