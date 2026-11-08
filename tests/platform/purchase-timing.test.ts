import test from "node:test";
import assert from "node:assert/strict";
import {
  PurchaseTiming,
  purchaseResponse,
  timePurchase,
  timePurchaseSync,
  withPurchaseTiming,
} from "../../src/server/purchase-timing";
import { MemberStoreTestPurchases } from "../../src/server/member-store-purchases";
import { storePackReceipt } from "../fixtures/store-pack-lifecycle";

test("timing is request-local across concurrent requests and preserves response/privacy", async () => {
  const [first, second] = await Promise.all([
    purchaseResponse(async () => {
      await timePurchase("purchase_verify", async () => {
        await new Promise((resolve) => setTimeout(resolve, 12));
      });
      return Response.json(
        { state: "PENDING" },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }),
    purchaseResponse(async () => {
      await timePurchase("purchase_auth", async () => 42);
      return Response.json({ error: "Unavailable" }, { status: 403 });
    }),
  ]);
  assert.match(first.headers.get("Server-Timing")!, /purchase_verify;dur=/);
  assert.doesNotMatch(first.headers.get("Server-Timing")!, /purchase_auth/);
  assert.match(second.headers.get("Server-Timing")!, /purchase_auth;dur=/);
  assert.doesNotMatch(second.headers.get("Server-Timing")!, /purchase_verify/);
  assert.equal(first.headers.get("Cache-Control"), "private, no-store");
  assert.deepEqual(await first.json(), { state: "PENDING" });
  assert.equal(second.status, 403);
});

test("timing preserves errors, records failed stages, and is inert outside a request", async () => {
  const timing = new PurchaseTiming(),
    failure = Error("secret provider token and identity must not be logged");
  await assert.rejects(
    withPurchaseTiming(timing, () =>
      timePurchase("purchase_verify", async () => {
        throw failure;
      }),
    ),
    (error) => error === failure,
  );
  assert.match(
    timing.header(),
    /^purchase_verify;dur=[\d.]+, purchase_total;dur=[\d.]+$/,
  );
  assert.doesNotMatch(timing.header(), /secret|provider|token|identity/);
  assert.equal(await timePurchase("purchase_verify", async () => 12), 12);
  assert.equal(
    timePurchaseSync("purchase_issue", () => 9),
    9,
  );
  timing.record("purchase_verify", NaN);
  timing.record("purchase_verify", -1);
  assert.ok(Number.isFinite(timing.snapshot().purchase_verify));
});

test("receipt timings retain both admission checks and never report pending as fulfilled", async () => {
  const receipt = storePackReceipt(),
    timing = new PurchaseTiming();
  let admissions = 0,
    accepts = 0;
  const service = new MemberStoreTestPurchases({
    authenticate: async () => ({ member: "timing-member", session: "session" }),
    admission: async () => {
      admissions++;
      return {
        version: "fixture",
        expiresAt: Date.now() + 60000,
        products: [receipt.product],
      };
    },
    rateLimit: async () => true,
    bindingSecret: "isolated-not-a-deployed-secret-123456",
    verify: async (_token, account) => ({
      ...receipt,
      account,
      state: "PENDING",
    }),
    accept: async () => {
      accepts++;
    },
  });
  const result = await withPurchaseTiming(timing, () =>
    service.receipt({ token: "synthetic-reference" }),
  );
  assert.equal(admissions, 2);
  assert.equal(accepts, 1);
  assert.equal(result.state, "PENDING");
  assert.equal(result.reconciliationRequired, true);
  assert.ok(timing.snapshot().purchase_admission! >= 0);
  assert.ok(timing.snapshot().purchase_verify! >= 0);
  assert.doesNotMatch(
    timing.header(),
    /timing-member|synthetic-reference|session/,
  );
});
