import test from "node:test";
import assert from "node:assert/strict";
import catalogue from "../../config/store-credit-package-drafts.json";
import release from "../../config/mobile-store-release.json";
import {
  assertStoreProduct,
  GooglePlayTestVerifier,
} from "../../src/server/store-purchase-verification";

test("approved credit contents stay separate from runtime purchase activation", async () => {
  assert.equal(catalogue.scope, "account");
  assert.equal(catalogue.currency, "AUD");
  assert.deepEqual(catalogue.territories, ["AU"]);
  assert.deepEqual(
    catalogue.products.map(({ credits, priceCents, bonusCredits }) => [
      credits,
      priceCents,
      bonusCredits,
    ]),
    [
      [4900, 4900, 0],
      [9900, 9900, 0],
    ],
  );
  assert.equal(new Set(catalogue.products.map((p) => p.id)).size, 2);
  assert.deepEqual(release.googleProducts, []);
  assert.deepEqual(release.appleProducts, []);
  assert.equal(release.paymentsApproved, false);
  for (const product of catalogue.products) {
    assertStoreProduct({
      id: product.id,
      scope: "account",
      credits: product.credits,
      version: catalogue.version,
    });
    const verifier = new GooglePlayTestVerifier(
      "docked.fantasy",
      [],
      async () => "synthetic-only",
      async () =>
        new Response(
          JSON.stringify({
            purchaseStateContext: { purchaseState: "PURCHASED" },
            testPurchaseContext: { fopType: "TEST" },
            obfuscatedExternalAccountId: "synthetic-account",
            regionCode: "AU",
            productLineItem: [
              {
                productId: product.id,
                productOfferDetails: { quantity: 1, refundableQuantity: 1 },
              },
            ],
          }),
          { status: 200 },
        ),
    );
    await assert.rejects(
      verifier.verify("synthetic-receipt", "synthetic-account"),
      /not approved/,
    );
  }
});
