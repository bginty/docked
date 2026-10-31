import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  GooglePlayTestVerifier,
  AppleStoreTestVerifier,
  storeAccountId,
  type StoreProduct,
} from "../../src/server/store-purchase-verification";
const product = {
  id: "isolated_test_credits",
  sport: "afl" as const,
  credits: 100,
  version: "synthetic-only",
};
const account = storeAccountId("fixture-member", "s".repeat(32));
const payload = () => ({
  purchaseStateContext: { purchaseState: "PURCHASED" },
  testPurchaseContext: { fopType: "TEST" },
  obfuscatedExternalAccountId: account,
  regionCode: "AU",
  productLineItem: [
    {
      productId: product.id,
      productOfferDetails: { quantity: 1, refundableQuantity: 1 },
    },
  ],
});
const verifier = (body: unknown, products: StoreProduct[] = [product]) =>
  new GooglePlayTestVerifier(
    "docked.fantasy",
    products,
    async () => "synthetic-oauth",
    async (url, options) => {
      assert.match(String(url), /^https:\/\/androidpublisher.googleapis.com\//);
      assert.equal(options?.redirect, "error");
      return Response.json(body);
    },
  );
test("Google API readback binds account/product, keeps pending and cancels distinct, and identifies revocation", async () => {
  for (const state of ["PURCHASED", "PENDING", "CANCELLED"]) {
    const body = payload();
    body.purchaseStateContext.purchaseState = state;
    const got = await verifier(body).verify("synthetic-token", account);
    assert.equal(got.state, state);
    assert.equal(got.product.credits, 100);
    assert.equal(
      got.key,
      (await verifier(body).verify("synthetic-token", account)).key,
    );
    assert.equal(JSON.stringify(got).includes("synthetic-token"), false);
  }
  const body = payload();
  body.productLineItem[0].productOfferDetails.refundableQuantity = 0;
  assert.equal(
    (await verifier(body).verify("synthetic-token", account)).state,
    "REVOKED",
  );
  // A pending/declined order has no refundable purchased units. This must not
  // turn an unpaid order into a refund or prematurely terminalise pending work.
  for (const state of ["PENDING", "CANCELLED"]) {
    body.purchaseStateContext.purchaseState = state;
    assert.equal(
      (await verifier(body).verify("synthetic-token", account)).state,
      state,
    );
  }
});
test("no live payment, wrong account, foreign storefront, unknown product, extra quantity or hidden sport passes", async () => {
  await assert.rejects(verifier(payload()).verify("synthetic-token", "other"));
  await assert.rejects(
    verifier(payload(), []).verify("synthetic-token", account),
  );
  for (const mutation of [
    (p: any) => delete p.testPurchaseContext,
    (p: any) => (p.regionCode = "US"),
    (p: any) => (p.productLineItem[0].productOfferDetails.quantity = 2),
    (p: any) => (p.purchaseStateContext.purchaseState = "UNKNOWN"),
  ]) {
    const p = payload();
    mutation(p);
    await assert.rejects(verifier(p).verify("synthetic-token", account));
  }
  await assert.rejects(
    verifier(payload(), [{ ...product, sport: "basketball" as any }]).verify(
      "synthetic-token",
      account,
    ),
  );
  assert.throws(
    () => new GooglePlayTestVerifier("another.app", [product], async () => ""),
  );
});
test("Apple rejects unsigned/untrusted receipts; missing trust configuration is closed", async () => {
  assert.throws(() => new AppleStoreTestVerifier([], []));
  assert.throws(
    () => new AppleStoreTestVerifier([Buffer.from("not-an-apple-root")], []),
  );
  const v = new AppleStoreTestVerifier(
    [readFileSync("certs/supabase-prod-ca-2021.crt")],
    [],
  );
  await assert.rejects(v.verify("unverified.client.payload", "fixture"));
  await assert.rejects(v.verifyNotification("unverified.notification.payload"));
});

test("account-wide credit bundles require approved scope and cannot smuggle a hidden sport", async () => {
  const shared: StoreProduct = {
    id: product.id,
    scope: "account",
    credits: 100,
    version: "synthetic-only",
  };
  const got = await verifier(payload(), [shared]).verify(
    "test-shared",
    account,
  );
  assert.deepEqual(got.product, shared);
  for (const invalid of [
    { ...shared, sport: "basketball" },
    { ...shared, sport: "nfl" },
    { ...shared, scope: "unknown" },
    { ...shared, credits: 0 },
    { ...shared, credits: 1.5 },
  ])
    await assert.rejects(
      verifier(payload(), [invalid as unknown as StoreProduct]).verify(
        "test-shared",
        account,
      ),
    );
  const real = payload() as Record<string, unknown>;
  delete real.testPurchaseContext;
  await assert.rejects(
    verifier(real, [shared]).verify("real-rejected", account),
  );
});

test("consumption verifies account and test status before any provider mutation", async () => {
  for (const invalid of [
    "live",
    "other-account",
    "PENDING",
    "CANCELLED",
    "refunded",
  ] as const) {
    const body = payload() as any;
    if (invalid === "live") delete body.testPurchaseContext;
    if (invalid === "other-account") body.obfuscatedExternalAccountId = "other";
    if (invalid === "PENDING" || invalid === "CANCELLED")
      body.purchaseStateContext.purchaseState = invalid;
    if (invalid === "refunded")
      body.productLineItem[0].productOfferDetails.refundableQuantity = 0;
    let mutations = 0;
    const v = new GooglePlayTestVerifier(
      "docked.fantasy",
      [product],
      async () => "synthetic",
      async (_url, options) => {
        if (options?.method === "POST") mutations++;
        return Response.json(body);
      },
    );
    await assert.rejects(v.consume("synthetic", product.id, account));
    assert.equal(mutations, 0, invalid);
  }
});

test("consumption retries use authoritative consumed state and remain retryable on failure", async () => {
  let consumed = false,
    writes = 0;
  const v = new GooglePlayTestVerifier(
    "docked.fantasy",
    [product],
    async () => "synthetic",
    async (_url, options) => {
      if (options?.method === "POST") {
        writes++;
        consumed = true;
        // Simulate success on Google followed by a failed transport response.
        return new Response(null, { status: 503 });
      }
      const body: any = payload();
      body.productLineItem[0].productOfferDetails.consumptionState = consumed
        ? "CONSUMPTION_STATE_CONSUMED"
        : "CONSUMPTION_STATE_YET_TO_BE_CONSUMED";
      return Response.json(body);
    },
  );
  await v.consume("synthetic", product.id, account);
  await v.consume("synthetic", product.id, account);
  assert.equal(writes, 1);
  const failed = new GooglePlayTestVerifier(
    "docked.fantasy",
    [product],
    async () => "synthetic",
    async (_url, options) =>
      options?.method === "POST"
        ? new Response(null, { status: 503 })
        : Response.json(payload()),
  );
  await assert.rejects(
    failed.consume("synthetic", product.id, account),
    /requires reconciliation/,
  );
});

test("provider failures and malformed data cannot leak raw receipt material", async () => {
  let requests = 0;
  const unavailable = new GooglePlayTestVerifier(
    "docked.fantasy",
    [product],
    async () => {
      throw Error("secret-token-from-oauth-provider");
    },
    async () => {
      requests++;
      return Response.json(payload());
    },
  );
  await assert.rejects(
    unavailable.verify("synthetic", account),
    /authorization unavailable/,
  );
  assert.equal(requests, 0);
  for (const transport of [
    async () => {
      throw Error("secret-token-in-provider-url");
    },
    async () =>
      Response.json({
        ...payload(),
        purchaseStateContext: { purchaseState: "secret-token-in-provider-url" },
      }),
  ]) {
    const v = new GooglePlayTestVerifier(
      "docked.fantasy",
      [product],
      async () => "synthetic",
      transport,
    );
    await assert.rejects(
      v.verify("synthetic", account),
      (error: unknown) =>
        error instanceof Error && !error.message.includes("secret-token"),
    );
  }
});
