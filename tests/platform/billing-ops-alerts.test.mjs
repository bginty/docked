import test from "node:test";
import assert from "node:assert/strict";
import {
  billingOpsAlertMessage,
  dispatchBillingOpsAlert,
} from "../../src/server/billing-ops-alerts.mjs";

const now = Date.parse("2026-11-06T00:00:00Z");
const env = {
  DOCKED_BILLING_OPS_ALERTS: "true",
  SUPABASE_URL: "https://pojoymtniryarxxunyvz.supabase.co",
  DOCKED_GRAPH_MAIL_ENABLED: "true",
  DOCKED_BILLING_OPS_RECIPIENT: "support@docked.com.au",
  DOCKED_BILLING_OPS_AUTHORITY: "isolated adapter test; not live approval",
  DOCKED_BILLING_OPS_UNTIL: "2026-11-07T00:00:00Z",
};
const health = {
  commercialAttention: 0,
  commercialOverdue: 0,
  openRecoveryCases: 0,
  testAttention: 7,
  testOverdue: 0,
  authMailFailures: 0,
  authMailPending: 0,
  authMailOverdue: 0,
};
function fixture({ rejectFence = false, rejectSettle = false } = {}) {
  let claimed = false;
  let fenced = false;
  let status;
  return {
    queue: {
      async claim() {
        if (claimed) return null;
        claimed = true;
        return {
          id: "fixture",
          lease: "fixture-lease",
          health,
          observedAt: new Date(now).toISOString(),
        };
      },
      async fence() {
        if (rejectFence) return false;
        fenced = true;
        return true;
      },
      async finish(_id, _lease, next) {
        if (rejectSettle) throw Error("Isolated settlement outage");
        status = next;
      },
    },
    state: () => ({ claimed, fenced, status }),
  };
}
test("default-off and unapproved configuration do not claim or send", async () => {
  const q = fixture();
  let sends = 0;
  const send = async () => {
    sends++;
  };
  assert.deepEqual(await dispatchBillingOpsAlert(q.queue, {}, { send, now }), {
    status: "disabled",
  });
  for (const change of [
    { DOCKED_BILLING_OPS_RECIPIENT: "other@example.invalid" },
    { DOCKED_BILLING_OPS_AUTHORITY: "" },
    { DOCKED_BILLING_OPS_UNTIL: "2020-01-01" },
    { SUPABASE_URL: "https://other.supabase.co" },
    { DOCKED_GRAPH_MAIL_ENABLED: "false" },
  ])
    await assert.rejects(
      dispatchBillingOpsAlert(q.queue, { ...env, ...change }, { send, now }),
    );
  assert.equal(sends, 0);
  assert.equal(q.state().claimed, false);
});
test("aggregate message excludes arbitrary sensitive input and validates missing data", () => {
  const plan = billingOpsAlertMessage(
    {
      ...health,
      email: "private@example.invalid",
      token: "secret-provider-token",
      error: "private-document",
    },
    new Date(now).toISOString(),
  );
  assert(plan);
  assert(
    !JSON.stringify(plan).match(
      /private@example|secret-provider|private-document/,
    ),
  );
  assert(plan.message.body.content.includes("TEST attention notifications: 7"));
  assert.deepEqual(plan.message.toRecipients, [
    { emailAddress: { address: "support@docked.com.au" } },
  ]);
  assert.throws(() =>
    billingOpsAlertMessage(
      { ...health, testAttention: undefined },
      new Date(now).toISOString(),
    ),
  );
  assert.throws(() =>
    billingOpsAlertMessage(
      { ...health, testAttention: -1 },
      new Date(now).toISOString(),
    ),
  );
  assert.equal(
    billingOpsAlertMessage(
      { ...health, testAttention: 0, authMailPending: 1 },
      new Date(now).toISOString(),
    ),
    null,
  );
});
test("durable-fence contract blocks duplicate and concurrent mock delivery", async () => {
  const q = fixture();
  let sends = 0;
  const send = async (messages) => {
    assert(q.state().fenced);
    assert.equal(messages.length, 1);
    sends++;
  };
  const results = await Promise.all([
    dispatchBillingOpsAlert(q.queue, env, { send, now }),
    dispatchBillingOpsAlert(q.queue, env, { send, now }),
  ]);
  assert.equal(sends, 1);
  assert(
    results.some(
      (r) => r.status === "accepted" && r.deliveryVerified === false,
    ),
  );
  assert.equal(q.state().status, "accepted");
  const blocked = fixture({ rejectFence: true });
  assert.equal(
    (await dispatchBillingOpsAlert(blocked.queue, env, { send, now })).status,
    "not-dispatched",
  );
  assert.equal(sends, 1);
});
test("ambiguous transport and settlement outage cannot blindly resend a fenced job", async () => {
  const q = fixture();
  let sends = 0;
  const send = async () => {
    sends++;
    throw Error("Isolated network timeout; no external request");
  };
  assert.equal(
    (await dispatchBillingOpsAlert(q.queue, env, { send, now })).status,
    "unknown",
  );
  assert.equal(q.state().status, "unknown");
  assert.equal(
    (await dispatchBillingOpsAlert(q.queue, env, { send, now })).status,
    "empty",
  );
  assert.equal(sends, 1);
  const outage = fixture({ rejectSettle: true });
  let accepted = 0;
  await assert.rejects(
    dispatchBillingOpsAlert(outage.queue, env, {
      send: async () => {
        accepted++;
      },
      now,
    }),
  );
  assert(outage.state().fenced);
  assert.equal(
    (
      await dispatchBillingOpsAlert(outage.queue, env, {
        send: async () => {
          accepted++;
        },
        now,
      })
    ).status,
    "empty",
  );
  assert.equal(accepted, 1);
});
