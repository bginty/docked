import test from "node:test";
import assert from "node:assert/strict";
import {
  googleNotificationRequest,
  googleReconciliationRequest,
} from "../../src/server/google-reconciliation-http";
const policy = {
  audience: "https://example.invalid/api/store/google/notifications",
  serviceAccount: "push@test.iam.gserviceaccount.com",
  subscription: "projects/test/subscriptions/store",
  packageName: "docked.fantasy" as const,
};
const notice = {
  id: "verified-test-event",
  receiptKey: null,
  kind: "test" as const,
  occurredAt: 1,
};
test("push acknowledges only durable persistence; duplicate is still successful", async () => {
  let inserted = 0;
  const deps = {
    policy,
    verify: async () => notice,
    enqueue: async () => ++inserted === 1,
  };
  for (let n = 0; n < 2; n++) {
    const r = await googleNotificationRequest(
      new Request(policy.audience, { method: "POST" }),
      deps,
    );
    assert.equal(r.status, 204);
    assert.equal(await r.text(), "");
    assert.equal(r.headers.get("cache-control"), "private, no-store");
  }
  const failed = await googleNotificationRequest(
    new Request(policy.audience, { method: "POST" }),
    {
      ...deps,
      enqueue: async () => {
        throw Error("secret database content");
      },
    },
  );
  assert.equal(failed.status, 503);
  assert.ok(!(await failed.text()).includes("secret"));
});
test("invalid Google identity or alternate callback never reaches persistence", async () => {
  let writes = 0;
  for (const url of [
    policy.audience,
    "https://other.invalid/api/store/google/notifications",
  ]) {
    const r = await googleNotificationRequest(
      new Request(url, { method: "POST" }),
      {
        policy,
        verify: async () => {
          throw Error("invalid signature");
        },
        enqueue: async () => {
          writes++;
          return true;
        },
      },
    );
    assert.equal(r.status, 401);
  }
  assert.equal(writes, 0);
});
test("scheduled worker requires independent server credential, never a member session", async () => {
  const secret = "isolated-test-worker-credential-1234567890";
  let calls = 0;
  const deps = {
    secret,
    run: async () => {
      calls++;
      return { pending: 0 };
    },
  };
  const denied: RequestInit[] = [
    { method: "POST", headers: {} },
    { method: "GET", headers: { authorization: `Bearer ${secret}` } },
    { method: "POST", headers: { authorization: "Bearer forged" } },
    {
      method: "POST",
      headers: { authorization: `Bearer ${secret}`, cookie: "member-session" },
    },
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
        origin: "https://docked.com.au",
      },
    },
  ];
  for (const options of denied)
    assert.equal(
      (
        await googleReconciliationRequest(
          new Request("https://example.invalid/worker", options),
          deps,
        )
      ).status,
      401,
    );
  assert.equal(calls, 0);
  const r = await googleReconciliationRequest(
    new Request("https://example.invalid/worker", {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
    }),
    deps,
  );
  assert.equal(r.status, 200);
  assert.equal(calls, 1);
});
