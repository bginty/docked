import test from "node:test";
import assert from "node:assert/strict";
import {
  Environment,
  type JWSTransactionDecodedPayload,
} from "@apple/app-store-server-library";
import {
  AppleSandboxPurchases,
  appleAccountToken,
  appleSandboxReceipt,
} from "../../src/server/apple-store-verification";
import { MemberStoreTestPurchases } from "../../src/server/member-store-purchases";
import release from "../../config/mobile-store-release.json";
const secret = "isolated-test-only-binding-secret-123456789";
const account = appleAccountToken("member-one", secret);
const product = {
  id: "docked_credits_4900_v1",
  credits: 4900,
  scope: "account" as const,
  version: "fixture",
};
const payload = (): JWSTransactionDecodedPayload => ({
  appAccountToken: account,
  bundleId: release.appleBundleId,
  environment: Environment.SANDBOX,
  type: "Consumable",
  quantity: 1,
  transactionId: "20000000001",
  productId: product.id,
  storefront: "AUS",
  inAppOwnershipType: "PURCHASED",
});
test("Apple binding is stable, private, provider-separated and UUID-shaped", () => {
  assert.match(
    account,
    /^[a-f0-9-]{14}8[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,
  );
  assert.equal(account, appleAccountToken("member-one", secret));
  assert.notEqual(account, appleAccountToken("member-two", secret));
  assert.notEqual(
    account,
    appleAccountToken("member-one", secret + "rotation"),
  );
  assert.throws(() => appleAccountToken("member", "short"));
});
test("Apple sandbox validates identity, signed product, region, quantity and provenance", () => {
  assert.equal(
    appleSandboxReceipt(payload(), account, [product]).product.credits,
    4900,
  );
  for (const change of [
    { environment: Environment.PRODUCTION },
    { bundleId: "unrelated.app" },
    { storefront: "USA" },
    { type: "Non-Consumable" },
    { quantity: 2 },
    { transactionId: "bad" },
    { productId: "unapproved" },
    { appAccountToken: appleAccountToken("other", secret) },
    { inAppOwnershipType: "FAMILY_SHARED" },
    { revocationDate: 0 },
  ])
    assert.throws(() =>
      appleSandboxReceipt({ ...payload(), ...change }, account, [product]),
    );
  assert.equal(
    appleSandboxReceipt({ ...payload(), revocationDate: Date.now() }, account, [
      product,
    ]).state,
    "REVOKED",
  );
});
test("old purchase proof refreshes against Apple before crediting; errors disclose no payload", async () => {
  const latest = { ...payload(), revocationDate: Date.now() };
  const decoder = {
    verifyAndDecodeTransaction: async (value: string) =>
      value === "original" ? payload() : latest,
    verifyAndDecodeNotification: async () => ({}),
  };
  let calls = 0;
  const v = new AppleSandboxPurchases(
    decoder,
    {
      getTransactionInfo: async (id) => {
        calls++;
        assert.equal(id, payload().transactionId);
        return { signedTransactionInfo: "latest" };
      },
    },
    [product],
  );
  assert.equal((await v.verify("original", account)).state, "REVOKED");
  assert.equal(calls, 1);
  const unavailable = new AppleSandboxPurchases(
    decoder,
    {
      getTransactionInfo: async () => {
        throw Error("private-provider-secret");
      },
    },
    [product],
  );
  await assert.rejects(unavailable.verify("original", account), {
    message: "Apple sandbox purchase could not be verified",
  });
});
test("notifications require both signed layers and keep consumption/refund reversal for review", async () => {
  let type = "REFUND";
  const n = {
    notificationUUID: "11111111-1111-4111-8111-111111111111",
    version: "2.0",
    signedDate: Date.now(),
    data: {
      environment: Environment.SANDBOX,
      bundleId: release.appleBundleId,
      signedTransactionInfo: "signed-inner",
    },
  };
  const decoder = {
    verifyAndDecodeTransaction: async () => payload(),
    verifyAndDecodeNotification: async () => ({ ...n, notificationType: type }),
  };
  const v = new AppleSandboxPurchases(
    decoder,
    { getTransactionInfo: async () => ({}) },
    [product],
  );
  const first = await v.notification("outer");
  assert.equal(first.kind, "verify");
  assert.equal(first.receiptKey, "20000000001");
  assert.deepEqual(await v.notification("outer"), first);
  for (const reason of [
    "CONSUMPTION_REQUEST",
    "REFUND_REVERSED",
    "REFUND_DECLINED",
  ]) {
    type = reason;
    assert.equal((await v.notification("outer")).kind, "review");
  }
  type = "TEST";
  assert.equal((await v.notification("outer")).receiptKey, null);
  n.data.environment = Environment.PRODUCTION;
  await assert.rejects(v.notification("outer"), /not authenticated/);
});
test("Apple uses the shared member orchestration and refuses cross-provider fulfilment", async () => {
  let accepted = 0;
  const base = {
    authenticate: async () => ({
      member: "member-one",
      session: "verified-session",
    }),
    admission: async () => ({
      version: "apple-sandbox-only",
      expiresAt: Date.now() + 60000,
      products: [product],
    }),
    rateLimit: async () => true,
    bindingSecret: secret,
    verify: async () => appleSandboxReceipt(payload(), account, [product]),
    accept: async () => {
      accepted++;
    },
  };
  await assert.rejects(
    new MemberStoreTestPurchases(base).receipt({ token: "signed-proof" }),
  );
  const service = new MemberStoreTestPurchases({
    ...base,
    provider: "apple",
    accountBinding: appleAccountToken,
  });
  assert.equal((await service.session()).accountBinding, account);
  assert.equal(
    (await service.receipt({ token: "signed-proof" })).state,
    "PURCHASED",
  );
  assert.equal(accepted, 1);
  await assert.rejects(
    service.receipt({ token: "signed-proof", member: "other" }),
  );
});
