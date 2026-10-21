import { z } from "zod";
import { digest } from "./scoring-engine";
import type { CreditsState } from "./credits-sandbox";
import type { NinePackProduct } from "./card-economy";

export const normalizeCoupon = (code: string) => code.trim().toUpperCase();
const code = z
  .string()
  .transform(normalizeCoupon)
  .pipe(z.string().regex(/^[A-Z0-9][A-Z0-9_-]{2,31}$/));
const whole = z.number().int().min(1).max(1_000_000_000);
export const couponTerms = z
  .object({
    code,
    type: z.enum(["percent", "fixed"]),
    value: whole,
    sport: z.enum(["nfl", "football", "afl"]),
    products: z.array(z.string().min(1).max(100)).min(1).max(30),
    startsAt: z.number().int().nonnegative(),
    expiresAt: z.number().int().nonnegative(),
    totalLimit: whole,
    accountLimit: whole.default(1),
    maximumDiscount: whole,
    firstPurchaseOnly: z.boolean(),
    allowZero: z.boolean().default(false),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.expiresAt <= v.startsAt)
      ctx.addIssue({ code: "custom", message: "Expiry must follow start" });
    if (v.type === "percent" && v.value > 100)
      ctx.addIssue({ code: "custom", message: "Percentage must be 1–100" });
    if (new Set(v.products).size !== v.products.length)
      ctx.addIssue({ code: "custom", message: "Duplicate products" });
  });
export type CouponTerms = z.infer<typeof couponTerms>;
export type PackCoupon = CouponTerms & {
  revision: number;
  status: "draft" | "active" | "paused";
  updatedAt: number;
  updatedBy: string;
};
export type CouponBook = {
  campaigns: Record<string, PackCoupon>;
  redemptions: Record<string, CouponRedemption>;
};
export type CouponRedemption = {
  purchase: string;
  member: string;
  product: string;
  at: number;
  original: number;
  saving: number;
  charge: number;
  coupon: PackCoupon;
};
export const couponManagement = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("save"),
      terms: couponTerms,
      expectedRevision: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      action: z.enum(["activate", "pause"]),
      code,
      expectedRevision: z.number().int().positive(),
    })
    .strict(),
]);
export type CouponQuote = {
  code: string;
  revision: number;
  product: string;
  original: number;
  saving: number;
  charge: number;
  fingerprint: string;
  expiresAt: number;
};
export function validateCouponBook(s: CreditsState) {
  if (!s.packCoupons) return;
  for (const [key, c] of Object.entries(s.packCoupons.campaigns)) {
    const { revision, status, updatedAt, updatedBy, ...terms } = c;
    couponTerms.parse(terms);
    if (
      key !== c.code ||
      !Number.isSafeInteger(revision) ||
      revision < 1 ||
      !["draft", "active", "paused"].includes(status) ||
      !Number.isSafeInteger(updatedAt) ||
      !updatedBy
    )
      throw Error("Coupon configuration integrity");
  }
  for (const [key, r] of Object.entries(s.packCoupons.redemptions)) {
    const pack = s.economy?.packs[key];
    const expected =
      r.coupon.type === "fixed"
        ? r.coupon.value
        : Number((BigInt(r.original) * BigInt(r.coupon.value) + 50n) / 100n);
    if (
      key !== r.purchase ||
      !pack ||
      pack.member !== r.member ||
      pack.product.id !== r.product ||
      pack.product.priceCredits !== r.original ||
      JSON.stringify(pack.pricing) !== JSON.stringify(r) ||
      r.saving !==
        Math.min(
          expected,
          r.coupon.maximumDiscount,
          r.original - (r.coupon.allowZero ? 0 : 1),
        ) ||
      r.charge !== r.original - r.saving ||
      r.saving <= 0 ||
      r.charge < 0 ||
      !s.entitlements[key] ||
      !s.journal.some(
        (j) =>
          j.id === s.entitlements[key].source &&
          j.lines
            .filter((l) => l.account === "system:pack-revenue")
            .reduce((n, l) => n + l.credits, 0) === r.charge,
      )
    )
      throw Error("Coupon purchase integrity");
  }
}
export function couponUses(
  book: CouponBook | undefined,
  code: string,
  member?: string,
) {
  return Object.values(book?.redemptions ?? {}).filter(
    (r) => r.coupon.code === code && (!member || r.member === member),
  );
}
export function couponStatus(
  c: PackCoupon,
  book: CouponBook | undefined,
  now: number,
) {
  if (c.status === "draft" || c.status === "paused") return c.status;
  if (now < c.startsAt) return "scheduled";
  if (now >= c.expiresAt) return "expired";
  if (couponUses(book, c.code).length >= c.totalLimit) return "exhausted";
  return "active";
}
export function hasPurchasedPack(s: CreditsState, member: string) {
  // Successful legacy and current pack purchases, including zero-credit coupon
  // purchases. Weekly/reward grants are not purchase journals and do not count.
  return Object.values(s.entitlements).some(
    (e) =>
      e.member === member &&
      s.journal.some((j) => j.id === e.source && j.id.endsWith("_pack")),
  );
}
export function quoteCoupon(
  s: CreditsState,
  member: string,
  raw: string,
  p: NinePackProduct,
  now: number,
): CouponQuote {
  const normalized = code.parse(raw),
    c = s.packCoupons?.campaigns[normalized];
  if (!c || c.status === "draft") throw Error("Invalid coupon code.");
  if (c.status === "paused") throw Error("This coupon is paused.");
  if (now < c.startsAt) throw Error("This coupon has not started.");
  if (now >= c.expiresAt) throw Error("This coupon has expired.");
  if (couponUses(s.packCoupons, c.code).length >= c.totalLimit)
    throw Error("Coupon redemption limit reached.");
  if (couponUses(s.packCoupons, c.code, member).length >= c.accountLimit)
    throw Error("You have already used this coupon.");
  if (c.sport !== p.sport || !c.products.includes(p.id))
    throw Error("This product is not eligible for this coupon.");
  if (c.firstPurchaseOnly && hasPurchasedPack(s, member))
    throw Error("This coupon is for your first successful pack purchase only.");
  // Whole credits, discount rounded half up. BigInt avoids binary floating point.
  const calculated =
    c.type === "fixed"
      ? c.value
      : Number((BigInt(p.priceCredits) * BigInt(c.value) + 50n) / 100n);
  const saving = Math.min(
    calculated,
    c.maximumDiscount,
    p.priceCredits - (c.allowZero ? 0 : 1),
  );
  if (saving <= 0)
    throw Error("This coupon gives no discount on this product.");
  const q = {
    code: c.code,
    revision: c.revision,
    product: p.id,
    original: p.priceCredits,
    saving,
    charge: p.priceCredits - saving,
    expiresAt: c.expiresAt,
  };
  return { ...q, fingerprint: digest({ member, quote: q, terms: c }) };
}
export function manageCoupon(
  s: CreditsState,
  actor: string,
  input: z.infer<typeof couponManagement>,
  now: number,
) {
  const book = (s.packCoupons ??= { campaigns: {}, redemptions: {} });
  const key = input.action === "save" ? input.terms.code : input.code;
  const old = book.campaigns[key];
  if ((old?.revision ?? 0) !== input.expectedRevision)
    throw Error("Coupon changed. Refresh and review again.");
  if (input.action === "save") {
    if (
      input.terms.products.some(
        (id) =>
          !s.economy?.products[id] ||
          s.economy.products[id].sport !== input.terms.sport,
      )
    )
      throw Error("Choose existing products for the selected sport.");
    if (input.terms.totalLimit < couponUses(book, key).length)
      throw Error("Limit cannot be below completed redemptions.");
    book.campaigns[key] = {
      ...input.terms,
      revision: (old?.revision ?? 0) + 1,
      status: "draft",
      updatedAt: now,
      updatedBy: actor,
    };
  } else {
    if (!old) throw Error("Coupon unavailable.");
    if (input.action === "activate" && old.expiresAt <= now)
      throw Error("Expired coupon cannot be activated.");
    book.campaigns[key] = {
      ...old,
      status: input.action === "activate" ? "active" : "paused",
      revision: old.revision + 1,
      updatedAt: now,
      updatedBy: actor,
    };
  }
  return book.campaigns[key];
}
