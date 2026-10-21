import { test } from "node:test";
import assert from "node:assert/strict";
import { packFixture, packMember, packNow } from "../fixtures/pack-economy";
import { paidPackCatalogueUpgrade } from "../../src/core/card-economy";
import { executeCredits, wallet } from "../../src/core/credits-sandbox";
import {
  couponStatus,
  quoteCoupon,
  hasPurchasedPack,
  type CouponTerms,
} from "../../src/core/pack-coupons";
const admin = { id: "local-owner", role: "reviewer", aal: "aal2" } as const;
function fixture(overrides: Partial<CouponTerms> = {}) {
  let s = packFixture();
  const [p] = paidPackCatalogueUpgrade(s.economy!, packNow).filter(
    (p) => p.type === "STANDARD" && p.cards === 9,
  );
  const terms: CouponTerms = {
    code: "LOCAL50",
    type: "percent",
    value: 50,
    sport: "nfl",
    products: [p.id],
    startsAt: packNow,
    expiresAt: packNow + 86400000,
    totalLimit: 2,
    accountLimit: 1,
    maximumDiscount: 350,
    firstPurchaseOnly: false,
    allowZero: false,
    ...overrides,
  };
  s = executeCredits(
    s,
    admin,
    "draft",
    {
      kind: "manage-coupon",
      mutation: { action: "save", terms, expectedRevision: 0 },
    },
    packNow,
  ).state;
  s = executeCredits(
    s,
    admin,
    "activate",
    {
      kind: "manage-coupon",
      mutation: { action: "activate", code: "local50", expectedRevision: 1 },
    },
    packNow,
  ).state;
  return { s, p, terms };
}
test("quote is free; successful coupon purchase is atomic, single-use and replay-safe", () => {
  const { s, p } = fixture();
  const before = structuredClone(s),
    q = quoteCoupon(s, packMember.id, " local50 ", p, packNow);
  assert.equal(q.charge, 350);
  assert.deepEqual(s, before);
  const c = {
    kind: "buy-pack",
    product: p.id,
    configuration: p.version,
    expectedPrice: q.charge,
    coupon: q.code,
    couponQuote: q.fingerprint,
    confirmed: true,
    policy: s.policy.version,
  };
  const bought = executeCredits(s, packMember, "purchase", c, packNow);
  assert.equal(
    wallet(bought.state, packMember.id).spendable,
    wallet(s, packMember.id).spendable - 350,
  );
  assert.equal(bought.state.economy!.packs.purchase.cards.length, 9);
  assert.equal(bought.state.economy!.packs.purchase.product.priceCredits, 700);
  assert.equal(bought.state.economy!.packs.purchase.pricing?.charge, 350);
  assert.equal(Object.keys(bought.state.packCoupons!.redemptions).length, 1);
  assert.deepEqual(
    executeCredits(bought.state, packMember, "purchase", c, packNow + 1),
    bought,
  );
  assert.throws(
    () => quoteCoupon(bought.state, packMember.id, q.code, p, packNow),
    /already used/,
  );
  assert.deepEqual(s, before);
});
test("failure, stale review, permission and campaign caps cannot consume a redemption", () => {
  const { s, p } = fixture({ totalLimit: 1 });
  const q = quoteCoupon(s, packMember.id, "LOCAL50", p, packNow);
  const command = {
    kind: "buy-pack",
    product: p.id,
    configuration: p.version,
    expectedPrice: 350,
    coupon: q.code,
    couponQuote: q.fingerprint,
    confirmed: true,
    policy: s.policy.version,
  };
  const empty = structuredClone(s);
  for (const x of Object.values(empty.economy!.players)) x.status = "inactive";
  assert.throws(
    () => executeCredits(empty, packMember, "fail", command, packNow),
    /insufficient/,
  );
  assert.equal(Object.keys(empty.packCoupons!.redemptions).length, 0);
  assert.throws(
    () =>
      executeCredits(
        s,
        packMember,
        "forge",
        {
          kind: "manage-coupon",
          mutation: { action: "pause", code: q.code, expectedRevision: 2 },
        },
        packNow,
      ),
    /MFA/,
  );
  const paused = executeCredits(
    s,
    admin,
    "pause",
    {
      kind: "manage-coupon",
      mutation: { action: "pause", code: q.code, expectedRevision: 2 },
    },
    packNow,
  ).state;
  assert.throws(
    () => executeCredits(paused, packMember, "paused", command, packNow),
    /paused/,
  );
  const resumed = executeCredits(
    paused,
    admin,
    "resume",
    {
      kind: "manage-coupon",
      mutation: { action: "activate", code: q.code, expectedRevision: 3 },
    },
    packNow,
  ).state;
  assert.throws(
    () => executeCredits(resumed, packMember, "changed", command, packNow),
    /offer changed/,
  );
  const bought = executeCredits(s, packMember, "buy", command, packNow).state;
  assert.throws(
    () => quoteCoupon(bought, "another-member", q.code, p, packNow),
    /limit reached/,
  );
  assert.equal(
    couponStatus(
      bought.packCoupons!.campaigns.LOCAL50,
      bought.packCoupons,
      packNow,
    ),
    "exhausted",
  );
});
test("whole-credit half-up savings, zero policy, first purchase and product restrictions", () => {
  const { s, p } = fixture({
    type: "percent",
    value: 100,
    maximumDiscount: 1000,
  });
  assert.equal(quoteCoupon(s, packMember.id, "LOCAL50", p, packNow).charge, 1);
  const zero = fixture({
    type: "fixed",
    value: 1000,
    maximumDiscount: 1000,
    allowZero: true,
    firstPurchaseOnly: true,
  });
  const q = quoteCoupon(zero.s, packMember.id, "LOCAL50", zero.p, packNow);
  assert.equal(q.charge, 0);
  const bought = executeCredits(
    zero.s,
    packMember,
    "free-coupon",
    {
      kind: "buy-pack",
      product: zero.p.id,
      configuration: zero.p.version,
      expectedPrice: 0,
      coupon: q.code,
      couponQuote: q.fingerprint,
      confirmed: true,
      policy: zero.s.policy.version,
    },
    packNow,
  ).state;
  assert.equal(
    wallet(bought, packMember.id).spendable,
    wallet(zero.s, packMember.id).spendable,
  );
  assert.equal(hasPurchasedPack(bought, packMember.id), true);
  assert.throws(
    () =>
      quoteCoupon(s, packMember.id, "LOCAL50", { ...p, id: "other" }, packNow),
    /not eligible/,
  );
  assert.throws(
    () => quoteCoupon(s, packMember.id, "LOCAL50", p, packNow - 1),
    /not started/,
  );
  assert.throws(
    () => quoteCoupon(s, packMember.id, "LOCAL50", p, packNow + 86400000),
    /expired/,
  );
  const fractional = fixture({ value: 1 });
  assert.equal(
    quoteCoupon(
      fractional.s,
      packMember.id,
      "LOCAL50",
      { ...fractional.p, priceCredits: 150 },
      packNow,
    ).saving,
    2,
  );
});
