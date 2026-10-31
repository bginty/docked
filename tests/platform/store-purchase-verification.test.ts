import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  GooglePlayTestVerifier,
  AppleStoreTestVerifier,
  storeAccountId,
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
const verifier = (body: unknown, products = [product]) =>
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
