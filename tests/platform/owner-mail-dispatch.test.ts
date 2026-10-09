import { test } from "node:test";
import assert from "node:assert/strict";
import { Webhook } from "svix";
import {
  dispatchOnce,
  validateApproval,
  workerUrl,
  drainBody,
} from "../../scripts/owner-mail-dispatch.mjs";

const secret = "v1,whsec_" + Buffer.alloc(32, 19).toString("base64"); // Local fixture only.
const approval = () => ({
  enabled: true,
  projectRef: "pojoymtniryarxxunyvz",
  recipient: "support@docked.com.au",
  serverRecipientMode: "support-test",
  queueReviewed: true,
  ownerApprovalReference: "Authored local test approval only",
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
});

test("dispatch requires current narrowly scoped approval before any network request", async () => {
  for (const change of [
    { enabled: false },
    { projectRef: "other" },
    { recipient: "other@example.test" },
    { serverRecipientMode: "all" },
    { queueReviewed: false },
    { ownerApprovalReference: "" },
    { expiresAt: "invalid" },
    { expiresAt: new Date(0).toISOString() },
    { expiresAt: new Date(Date.now() + 16 * 60_000).toISOString() },
  ]) {
    let calls = 0;
    await assert.rejects(
      dispatchOnce({
        approval: { ...approval(), ...change },
        secret,
        fetcher: async () => {
          calls++;
          throw Error("must not call");
        },
      }),
      /approval/,
    );
    assert.equal(calls, 0);
  }
  assert.throws(() => validateApproval(null), /approval/);
});

test("one signed fixed drain, exact endpoint, no redirect and no delivery claim", async () => {
  let calls = 0;
  const result = await dispatchOnce({
    approval: approval(),
    secret,
    fetcher: async (url, init) => {
      calls++;
      assert.ok(init);
      assert.equal(url, workerUrl);
      assert.equal(init.redirect, "error");
      assert.equal(init.method, "POST");
      assert.equal(init.body, drainBody);
      assert.ok(init.signal);
      new Webhook(secret.slice(3)).verify(
        init.body as string,
        init.headers as Record<string, string>,
      );
      assert.deepEqual(JSON.parse(init.body as string), {
        mode: "production",
        control: "drain",
      });
      return Response.json({
        states: ["accepted", "idle", "idle", "idle"],
        secret: "never print",
      });
    },
  });
  assert.equal(calls, 1);
  assert.equal(result.deliveryVerified, false);
  assert.equal(result.retryAttempted, false);
  assert.equal(result.operatorReviewRequired, false);
  assert.ok(!JSON.stringify(result).includes("never print"));
});

test("ambiguous, rejected, malformed and oversized responses are never retried or disclosed", async () => {
  for (const response of [
    () => {
      throw Error(secret);
    },
    () => new Response(secret, { status: 503 }),
    () =>
      new Response(secret, {
        status: 302,
        headers: { Location: "https://example.test" },
      }),
    () => new Response("x".repeat(2049)),
    () => Response.json({ states: ["idle"] }),
    () => Response.json({ states: ["secret", "idle", "idle", "idle"] }),
  ]) {
    let calls = 0;
    await assert.rejects(
      dispatchOnce({
        approval: approval(),
        secret,
        fetcher: async () => {
          calls++;
          return response();
        },
      }),
      (error: Error) =>
        /No retry attempted/.test(error.message) &&
        !error.message.includes(secret),
    );
    assert.equal(calls, 1);
  }
});

test("worker uncertainty and pre-send authorization failure require operator review", async () => {
  for (const state of ["pending", "unknown", "failed", "unconfirmed"]) {
    const result = await dispatchOnce({
      approval: approval(),
      secret,
      fetcher: async () =>
        Response.json({ states: [state, "idle", "idle", "idle"] }),
    });
    assert.equal(result.operatorReviewRequired, true);
    assert.equal(result.retryAttempted, false);
  }
});
