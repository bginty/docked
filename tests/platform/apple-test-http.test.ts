import test from "node:test";
import assert from "node:assert/strict";
import { appleTestHttp } from "../../src/server/apple-test-http";
import { MemberStoreTestPurchases } from "../../src/server/member-store-purchases";
import { appleAccountToken } from "../../src/server/apple-store-verification";

const origin = "https://docked.com.au",
  product = {
    id: "synthetic-apple",
    version: "fixture",
    scope: "account" as const,
    credits: 4900,
  };
test("Apple HTTP binds normal auth, denies cross-origin and bounds untrusted bodies", async () => {
  let signedIn = true,
    accepted = 0;
  const service = new MemberStoreTestPurchases({
    provider: "apple",
    accountBinding: appleAccountToken,
    bindingSecret: "s".repeat(64),
    authenticate: async () => {
      if (!signedIn) throw Error();
      return { member: "fixture-member", session: "normal-session" };
    },
    admission: async () => ({
      version: "fixture",
      expiresAt: Date.now() + 60000,
      products: [product],
    }),
    rateLimit: async () => true,
    verify: async (_token, account) => ({
      provider: "apple",
      environment: "test",
      key: "20001",
      account,
      product,
      state: "PURCHASED",
    }),
    accept: async () => {
      accepted++;
    },
  });
  const api = appleTestHttp({
    origin,
    member: async () => service,
    verifier: {
      notification: async () => {
        throw Error();
      },
    },
    queue: { enqueue: async () => true },
  });
  assert.equal((await api.session()).status, 200);
  const request = (body: string, source = origin) =>
    new Request(origin + "/api/store/apple/test", {
      method: "POST",
      headers: { Origin: source, "Content-Type": "application/json" },
      body,
    });
  assert.equal(
    (
      await api.receipt(
        request('{"token":"signed-fixture"}', "https://attacker.invalid"),
      )
    ).status,
    403,
  );
  assert.equal(
    (await api.receipt(request(JSON.stringify({ token: "x".repeat(19000) }))))
      .status,
    403,
  );
  assert.equal(
    (await api.receipt(request('{"token":"signed-fixture","member":"other"}')))
      .status,
    403,
  );
  assert.equal(accepted, 0);
  assert.equal(
    (await api.receipt(request('{"token":"signed-fixture"}'))).status,
    200,
  );
  signedIn = false;
  assert.equal((await api.session()).status, 403);
  assert.equal(
    (await api.receipt(request('{"token":"signed-fixture"}'))).status,
    403,
  );
  assert.equal(accepted, 1);
});
test("Apple notification acknowledges only authenticated durable persistence and permits safe retry", async () => {
  let authentic = false,
    storageAvailable = false,
    writes = 0;
  const api = appleTestHttp({
    origin,
    member: async () => {
      throw Error();
    },
    verifier: {
      notification: async () => {
        if (!authentic) throw Error("private signature");
        return {
          id: "a".repeat(64),
          receiptKey: "20001",
          kind: "verify",
          reason: "REFUND",
          occurredAt: Date.now(),
        };
      },
    },
    queue: {
      enqueue: async () => {
        if (!storageAvailable) throw Error("private database");
        writes++;
        return writes === 1;
      },
    },
  });
  const request = () =>
    new Request(origin + "/api/store/apple/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"signedPayload":"signed-fixture"}',
    });
  const response = await api.notification(request());
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /private/);
  assert.equal(writes, 0);
  authentic = true;
  assert.equal((await api.notification(request())).status, 503);
  storageAvailable = true;
  assert.equal((await api.notification(request())).status, 200);
  assert.equal((await api.notification(request())).status, 200);
});
