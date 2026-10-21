import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { requireIdentity, requireRole } from "./auth";
import { db, rateLimit } from "./db";
import { memberTestSource } from "./member-test-wallet";
import { setCommunityClaims } from "./community-social";
import { CreditsSandboxStore } from "./credits-sandbox-store";
import {
  couponManagement,
  couponStatus,
  couponUses,
  normalizeCoupon,
  quoteCoupon,
} from "@/core/pack-coupons";
import type { TransactionSql } from "postgres";

export async function memberCoupon(input: unknown) {
  const who = await requireIdentity();
  if (!(await rateLimit(`coupon-validation:${who.user.id}`, 12, 60)))
    throw Error("Too many coupon checks. Try again shortly.");
  const { code } = z
    .object({ code: z.string().trim().min(3).max(32) })
    .strict()
    .parse(input);
  const { s, member } = await memberTestSource();
  const campaign = s.packCoupons?.campaigns[normalizeCoupon(code)];
  if (!campaign || campaign.status === "draft")
    throw Error("Invalid coupon code.");
  const products = Object.values(s.economy?.products ?? {}).filter((p) =>
    s.economy?.activeProductVersions?.includes(p.id),
  );
  const quotes = products.map((p) => {
    try {
      return {
        product: p.id,
        quote: quoteCoupon(s, member, code, p, Date.now()),
        error: null,
      };
    } catch (e) {
      return {
        product: p.id,
        quote: null,
        error: e instanceof Error ? e.message : "Coupon validation failed.",
      };
    }
  });
  if (!quotes.some((q) => q.quote))
    throw Error(
      quotes.find((q) => campaign.products.includes(q.product))?.error ??
        "No eligible pack products.",
    );
  return {
    code: campaign.code,
    terms: {
      type: campaign.type,
      value: campaign.value,
      maximumDiscount: campaign.maximumDiscount,
      expiresAt: campaign.expiresAt,
      accountLimit: campaign.accountLimit,
      firstPurchaseOnly: campaign.firstPurchaseOnly,
      allowZero: campaign.allowZero,
    },
    quotes,
  };
}
export async function adminCoupons(input?: unknown) {
  const who = await requireRole(["owner", "admin"]);
  if (process.env.DOCKED_FRIENDS_BETA !== "true")
    throw Error("Coupon service unavailable");
  if (!(await rateLimit(`coupon-admin:${who.user.id}`, input ? 20 : 60, 60)))
    throw Error("Too many requests.");
  const sql = db();
  const store = new CreditsSandboxStore(sql, async (tx) => {
    await setCommunityClaims(tx as unknown as TransactionSql, who);
    const [access] =
      await tx`select role from private.roles where user_id=${who.user.id}::uuid and role in ('owner','admin') and beta_private.active_member_session() for share`;
    if (!access || who.aal !== "aal2") throw Error("Role denied");
  });
  if (input !== undefined) {
    const c = z
      .object({ request: z.string().uuid(), mutation: couponManagement })
      .strict()
      .parse(input);
    await store.execute(
      { id: who.user.id, role: "reviewer", aal: "aal2" },
      c.request,
      { kind: "manage-coupon", mutation: c.mutation },
    );
  }
  const s = await store.read(),
    book = s.packCoupons;
  const members =
    await sql`select user_id::text id,label from credits_sandbox.access`;
  return {
    generatedCode: randomBytes(10).toString("hex").toUpperCase(),
    products: Object.values(s.economy?.products ?? {})
      .filter((p) => s.economy?.activeProductVersions?.includes(p.id))
      .map((p) => ({
        id: p.id,
        name: p.name,
        sport: p.sport,
        price: p.priceCredits,
      })),
    campaigns: Object.values(book?.campaigns ?? {}).map((c) => {
      const uses = couponUses(book, c.code);
      const maximum = Math.max(
        0,
        ...c.products.map((id) => {
          const p = s.economy?.products[id];
          if (!p) return 0;
          const raw =
            c.type === "fixed"
              ? c.value
              : Number((BigInt(p.priceCredits) * BigInt(c.value) + 50n) / 100n);
          return Math.min(
            raw,
            c.maximumDiscount,
            p.priceCredits - (c.allowZero ? 0 : 1),
          );
        }),
      );
      return {
        ...c,
        effectiveStatus: couponStatus(c, book, Date.now()),
        successful: uses.length,
        discounted: uses.reduce((n, r) => n + r.saving, 0),
        remaining: Math.max(0, c.totalLimit - uses.length),
        maximumAllocation: (
          BigInt(c.totalLimit) * BigInt(maximum)
        ).toLocaleString("en-AU"),
      };
    }),
    redemptions: Object.values(book?.redemptions ?? {})
      .sort((a, b) => b.at - a.at)
      .map((r) => ({
        ...r,
        memberLabel: members.find((m) => m.id === r.member)?.label ?? "Member",
      })),
  };
}
