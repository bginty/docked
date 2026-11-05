import "server-only";
import { z } from "zod";
import { requireIdentity } from "./auth";
import { db, rateLimit } from "./db";
import { authSessionsRelation } from "../core/auth-relations";
import { commercialPolicyVersion } from "../core/commercial-billing";
import { commercialRuntime } from "./commercial-runtime";
import { storeAccountId } from "./store-purchase-verification";
import { currentConsentVersions } from "../core/auth-readiness";
import { CommercialMemberView } from "./commercial-member-view";
import { commercialCard } from "../core/commercial-presentation";
import { isolatedPreviewReadOnlyIdentity } from "../core/isolated-public-preview.mjs";
import { isolatedBillingIdentity } from "../core/isolated-billing-acceptance";
/** Ordinary authenticated member; body never contains a customer, balance, price
 * or credited amount. TEST admission and synthetic identities are not reused. */
export class CommercialRateLimit extends Error {}
export async function memberCommercial(access: "read" | "mutation" = "read") {
  if (
    process.env.DOCKED_COMMERCIAL_SERVICE !== "true" ||
    process.env.DOCKED_BETA_STAGING === "true"
  )
    throw Error("Commercial checkout disabled");
  const who = await requireIdentity(),
    sql = db();
  const isolatedReadOnly = isolatedPreviewReadOnlyIdentity(
    process.env,
    who.user.email,
  );
  const acceptance = isolatedBillingIdentity(
    process.env,
    who.user.id,
    who.user.email,
  );
  const checkoutEnabled =
    process.env.DOCKED_COMMERCIAL_CHECKOUT === "true" || acceptance;
  const assertTransactionIdentity = () => {
    if (isolatedReadOnly && !acceptance)
      throw Error(
        "Isolated public acceptance is read-only for commercial records",
      );
  };
  if (
    !who.user.email ||
    (!isolatedReadOnly &&
      /(@synthetic\.invalid$|@example\.(com|invalid)$)/i.test(who.user.email))
  )
    throw Error("Commercial customer identity required");
  const binding = process.env.DOCKED_COMMERCIAL_ACCOUNT_BINDING_SECRET ?? "";
  if (binding.length < 32)
    throw Error("Commercial account binding unavailable");
  const account = storeAccountId(who.user.id, binding),
    versions = currentConsentVersions();
  const authorize = async () => {
    const [p] =
      await sql`select p.id from public.profiles p where p.id=${who.user.id} and p.disabled_at is null and p.country='AU' and p.age_attested and p.accepted_version=${versions.terms}
   and exists(select 1 from private.consent_events c where c.user_id=p.id and c.purpose='privacy' and c.granted and c.version=${versions.privacy} and c.id=(select id from private.consent_events where user_id=p.id and purpose='privacy' order by created_at desc,id desc limit 1))
   and exists(select 1 from lateral (select * from private.region_policies r where r.country=p.country and r.state=p.state and r.effective_from<=clock_timestamp() and r.effective_to>clock_timestamp() order by r.effective_from desc,r.id desc limit 1) r where not r.preview_community_only and r.approved and r.minimum_age=18 and r.review_at>clock_timestamp())
   and exists(select 1 from ${sql.unsafe(authSessionsRelation())} s where s.id=${who.sessionId} and s.user_id=p.id and (s.not_after is null or s.not_after>clock_timestamp()))`;
    if (!p)
      throw Error("Current customer eligibility and policy consent required");
  };
  await authorize();
  // Header, collection, history and current-price reads must not consume the
  // receipt/purchase quota. Preserve the existing mutation key and limit.
  if (
    !(await rateLimit(
      `${access === "read" ? "commercial-read" : "commercial"}:${who.user.id}`,
      access === "read" ? 90 : 15,
      60,
    ))
  )
    throw new CommercialRateLimit("Please retry shortly");
  const { ledger, verifier, worker } = await commercialRuntime();
  return {
    member: who.user.id,
    view: new CommercialMemberView(ledger, who.user.id, authorize),
    wallet: () => ledger.wallet(who.user.id),
    session: async () => ({
      environment: "commercial",
      isolatedTestOnly: acceptance,
      policy: commercialPolicyVersion,
      member: who.user.id,
      accountBinding: account,
      products: checkoutEnabled
        ? await ledger.checkout(who.user.id, authorize)
        : [],
      wallet: await ledger.wallet(who.user.id),
    }),
    receipt: async (body: unknown) => {
      assertTransactionIdentity();
      if (!checkoutEnabled) throw Error("Checkout disabled");
      const { token } = z
        .object({
          token: z
            .string()
            .min(1)
            .max(4096)
            .regex(/^[^\s\x00-\x1f]+$/),
        })
        .strict()
        .parse(body);
      const receipt = await verifier.verify(token, account);
      const result = await ledger.accept(
        receipt,
        who.user.id,
        token,
        authorize,
      );
      // Google requires acknowledgement after fulfilment. The durable consume
      // job exists before this call; a failed attempt never rolls back or repeats
      // wallet crediting, and its persisted lease/backoff supports recovery.
      const acknowledged =
        result.state === "PURCHASED" &&
        (await worker
          .acknowledgeReceipt(result.receipt, who.user.id)
          .catch(() => false));
      if (result.state === "PURCHASED" && !acknowledged)
        console.warn(
          JSON.stringify({ event: "google-commercial-acknowledgement-deferred" }),
        );
      return {
        ...result,
        wallet: await ledger.wallet(who.user.id),
        acknowledgement: acknowledged ? "acknowledged" : "durable-worker",
      };
    },
    reconcile: async () => {
      assertTransactionIdentity();
      const refs =
        await ledger.sql`select key from commercial_billing.receipts where member_id=${who.user.id} order by updated_at,key limit 4`;
      for (const row of refs) {
        const ref = await ledger.reference(row.key);
        if (ref) {
          const r = await verifier.verify(ref.token, account);
          await ledger.accept(r, who.user.id, ref.token, authorize, false);
        }
      }
      return { checked: refs.length, morePossible: refs.length === 4 };
    },
    buyPack: async (body: unknown) => {
      assertTransactionIdentity();
      const v = z
        .object({
          request: z.string().uuid(),
          sport: z.enum(["nfl", "afl", "nrl"]),
          family: z.enum(["STANDARD", "PREMIUM"]),
          size: z.union([z.literal(1), z.literal(3), z.literal(9)]),
          configurationHash: z.string().length(64),
          confirmed: z.literal(true),
          expectedMember: z.literal(who.user.id),
        })
        .strict()
        .parse(body);
      return ledger.buyPack(who.user.id, v.request, v, authorize);
    },
    openPack: async (body: unknown) => {
      assertTransactionIdentity();
      const { id } = z
        .object({
          id: z.string().uuid(),
          expectedMember: z.literal(who.user.id),
        })
        .strict()
        .parse(body);
      const r = await ledger.openPack(who.user.id, id, authorize);
      return {
        id,
        name: r.product.name,
        opened_at: r.openedAt,
        cards: r.cards.map((c) =>
          commercialCard(c as Parameters<typeof commercialCard>[0]),
        ),
      };
    },
  };
}
