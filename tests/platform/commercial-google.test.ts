import test from "node:test";
import assert from "node:assert/strict";
import {
  GoogleCommercialVerifier,
  googleAudCents,
} from "../../src/server/google-commercial-verifier";
import {
  commercialProducts,
  commercialPack,
  assertCommercialApproval,
} from "../../src/core/commercial-billing";
const account = "a".repeat(64),
  token = "synthetic-provider-token",
  product = commercialProducts[0];
function provider() {
  const purchase = {
    orderId: "GPA.0000-0000-0000",
    purchaseStateContext: { purchaseState: "PURCHASED" },
    obfuscatedExternalAccountId: account,
    regionCode: "AU",
    productLineItem: [
      {
        productId: product.id,
        productOfferDetails: {
          quantity: 1,
          refundableQuantity: 1,
          purchaseOptionId: "buy-au",
          consumptionState: "CONSUMPTION_STATE_YET_TO_BE_CONSUMED",
        },
      },
    ],
  };
  const order = {
    orderId: purchase.orderId,
    purchaseToken: token,
    state: "PROCESSED",
    lastEventTime: "2026-11-01T00:00:00Z",
    total: { currencyCode: "AUD", units: "49" },
    tax: { currencyCode: "AUD", units: "4", nanos: 450000000 },
    lineItems: [
      {
        productId: product.id,
        oneTimePurchaseDetails: { quantity: 1, purchaseOptionId: "buy-au" },
      },
    ],
    orderHistory: {} as Record<string, unknown>,
  };
  const paths: string[] = [];
  let down = false;
  const transport: typeof fetch = async (input, init) => {
    paths.push(String(input));
    assert.equal(init?.redirect, "error");
    assert.equal(init?.cache, "no-store");
    if (down) throw Error("secret provider payload");
    return Response.json(String(input).includes("/orders/") ? order : purchase);
  };
  return {
    purchase,
    order,
    paths,
    transport,
    setDown() {
      down = true;
    },
  };
}
test("verified commercial receipt uses provider identity, exact AUD charge and account", async () => {
  const f = provider(),
    v = new GoogleCommercialVerifier(
      "commercial",
      async () => "fixture-oauth",
      f.transport,
    );
  const r = await v.verify(token, account);
  assert.equal(r.state, "PURCHASED");
  assert.equal(r.product.credits, 4900);
  assert.equal(r.grossCents, 4900);
  assert.equal(r.taxCents, 445);
  assert.equal(r.paid, true);
  assert.equal(f.paths.length, 2);
});
test("TEST receipts cannot cross commercial boundary in either direction", async () => {
  const f = provider();
  (f.purchase as unknown as Record<string, unknown>).testPurchaseContext = {
    fopType: "TEST",
  };
  await assert.rejects(
    new GoogleCommercialVerifier(
      "commercial",
      async () => "fixture",
      f.transport,
    ).verify(token, account),
  );
  assert.equal(
    (
      await new GoogleCommercialVerifier(
        "acceptance",
        async () => "fixture",
        f.transport,
      ).verify(token, account)
    ).environment,
    "acceptance",
  );
  delete (f.purchase as unknown as Record<string, unknown>).testPurchaseContext;
  await assert.rejects(
    new GoogleCommercialVerifier(
      "acceptance",
      async () => "fixture",
      f.transport,
    ).verify(token, account),
  );
});
for (const variant of [
  "account",
  "product",
  "region",
  "quantity",
  "option",
  "orderToken",
  "orderProduct",
  "currency",
])
  test(`reject manipulated ${variant}`, async () => {
    const f = provider();
    switch (variant) {
      case "account":
        f.purchase.obfuscatedExternalAccountId = "b".repeat(64);
        break;
      case "product":
        f.purchase.productLineItem[0].productId = "unapproved";
        break;
      case "region":
        f.purchase.regionCode = "US";
        break;
      case "quantity":
        f.purchase.productLineItem[0].productOfferDetails.quantity = 2;
        break;
      case "option":
        f.purchase.productLineItem[0].productOfferDetails.purchaseOptionId =
          "other";
        break;
      case "orderToken":
        f.order.purchaseToken = "different";
        break;
      case "orderProduct":
        f.order.lineItems[0].productId = "different";
        break;
      case "currency":
        f.order.total.currencyCode = "USD";
    }
    await assert.rejects(
      new GoogleCommercialVerifier(
        "commercial",
        async () => "fixture",
        f.transport,
      ).verify(token, account),
    );
  });
test("pending without order remains pending and is not a verified charge", async () => {
  const f = provider();
  delete (f.purchase as { orderId?: string }).orderId;
  f.purchase.purchaseStateContext.purchaseState = "PENDING";
  const r = await new GoogleCommercialVerifier(
    "commercial",
    async () => "fixture",
    f.transport,
  ).verify(token, account);
  assert.equal(r.paid, false);
  assert.equal(r.grossCents, null);
  assert.equal(r.state, "PENDING");
});
test("partial refunds are held, full refund is cumulative without double counting", async () => {
  const f = provider(),
    v = new GoogleCommercialVerifier(
      "commercial",
      async () => "fixture",
      f.transport,
    );
  f.order.state = "PARTIALLY_REFUNDED";
  f.order.orderHistory.partialRefundEvents = [
    {
      state: "PROCESSED_SUCCESSFULLY",
      refundDetails: { total: { currencyCode: "AUD", units: "5" } },
    },
  ];
  let r = await v.verify(token, account);
  assert.equal(r.refundedCents, 500);
  assert.equal(r.state, "REVIEW");
  f.order.state = "REFUNDED";
  f.order.orderHistory.refundEvent = {
    refundDetails: { total: { currencyCode: "AUD", units: "49" } },
  };
  r = await v.verify(token, account);
  assert.equal(r.refundedCents, 4900);
  assert.equal(r.state, "REVOKED");
});
test("amount drift records a charge needing review, never silently changes credit allocation", async () => {
  const f = provider();
  f.order.total.units = "48";
  const r = await new GoogleCommercialVerifier(
    "commercial",
    async () => "fixture",
    f.transport,
  ).verify(token, account);
  assert.equal(r.paid, true);
  assert.equal(r.state, "REVIEW");
  assert.equal(r.product.credits, 4900);
});
test("provider outages do not leak tokens or invent successful purchases", async () => {
  const f = provider();
  f.setDown();
  await assert.rejects(
    new GoogleCommercialVerifier(
      "commercial",
      async () => "fixture",
      f.transport,
    ).verify(token, account),
    (e) =>
      e instanceof Error &&
      !e.message.includes(token) &&
      !e.message.includes("secret"),
  );
});
test("integer money and unchanged sport-specific pack configuration", () => {
  assert.equal(googleAudCents({ currencyCode: "AUD", units: "99" }), 9900);
  assert.throws(() =>
    googleAudCents({ currencyCode: "AUD", units: "49", nanos: 1 }),
  );
  for (const sport of ["nfl", "afl", "nrl"] as const) {
    assert.equal(commercialPack(sport, "STANDARD", 9).priceCredits, 700);
    assert.equal(commercialPack(sport, "PREMIUM", 9).priceCredits, 5000);
    assert.equal("CORE" in commercialPack(sport, "STANDARD", 9).weights, false);
  }
  assert.throws(() =>
    assertCommercialApproval(
      { environment: "commercial", policy_version: "pending", approvals: {} },
      "commercial",
    ),
  );
});
