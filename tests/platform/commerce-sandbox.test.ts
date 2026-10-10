import { test } from "node:test";
import assert from "node:assert/strict";
import {
  executeCommerce as run,
  initialCommerce,
  type Operator,
} from "../../src/core/commerce-sandbox";
import { PayPalSandbox } from "../../src/server/paypal-sandbox";
import { verifyIdentitySignature } from "../../src/server/identity-webhook";
import { createHmac } from "node:crypto";
const member: Operator = { id: "member", role: "member" },
  admin: Operator = { id: "admin", role: "reviewer", aal: "aal2" },
  provider: Operator = { id: "provider", role: "payment-provider" };
const now = Date.parse("2026-10-10T00:00:00Z");
function fixture() {
  const s = initialCommerce();
  s.products.elite = {
    tier: "ELITE",
    cents: 9900,
    pool: ["card"],
    method: "named",
    sport: "epl",
  };
  s.cards.card = { tier: "ELITE", sport: "epl", owner: null, reserved: null };
  return s;
}
test("Orders reserve finite supply; server price, confirmed bank payment, single issuance and idempotency", () => {
  let s = fixture();
  const c = { kind: "order", product: "elite", card: "card", method: "bank" };
  s = run(s, member, "order1", c, now).state;
  assert.equal(run(s, member, "order1", c, now).state.events.length, 1);
  assert.throws(
    () => run(s, member, "order1", { ...c, card: "other" }, now),
    /Idempotency/,
  );
  assert.throws(
    () => run(s, { id: "other", role: "member" }, "another", c, now),
    /supply/,
  );
  const payment = {
    kind: "payment",
    order: "order1",
    event: "bank1",
    cents: 9900,
    currency: "AUD",
    confirmed: true,
  };
  assert.throws(() => run(s, member, "fake", payment, now), /MFA/);
  s = run(s, admin, "pay", payment, now).state;
  s = run(s, admin, "fulfil", { kind: "fulfil", order: "order1" }, now).state;
  assert.equal(s.cards.card.owner, "member");
  assert.equal(s.orders.order1.price, 9900);
  assert.equal(
    run(s, admin, "fulfil", { kind: "fulfil", order: "order1" }, now).state
      .events.length,
    s.events.length,
  );
  assert.throws(
    () => run(s, member, "cancel", { kind: "cancel", order: "order1" }, now),
    /refund/,
  );
  assert.equal(s.funds.member, undefined);
});
test("Expired, cancelled, partial/excess payments cannot issue; failures preserve original state", () => {
  for (const cents of [1, 9901]) {
    let s = run(
      fixture(),
      member,
      "o",
      { kind: "order", product: "elite", card: "card", method: "bank" },
      now,
    ).state;
    s = run(
      s,
      admin,
      "pay",
      {
        kind: "payment",
        order: "o",
        event: "bank",
        cents,
        currency: "AUD",
        confirmed: true,
      },
      now,
    ).state;
    assert.equal(s.orders.o.status, "REVIEW");
    assert.throws(() =>
      run(s, admin, "f", { kind: "fulfil", order: "o" }, now),
    );
    assert.equal(s.cards.card.owner, null);
  }
  let s = run(
    fixture(),
    member,
    "o",
    { kind: "order", product: "elite", card: "card", method: "bank" },
    now,
  ).state;
  assert.throws(
    () =>
      run(
        s,
        { id: "other", role: "member" },
        "x",
        { kind: "cancel", order: "o" },
        now,
      ),
    /isolation/,
  );
  s = run(s, admin, "expire", { kind: "expire" }, now + 1800000).state;
  assert.equal(s.cards.card.reserved, null);
  s = run(
    s,
    admin,
    "late",
    {
      kind: "payment",
      order: "o",
      event: "late",
      cents: 9900,
      currency: "AUD",
      confirmed: true,
    },
    now + 1800001,
  ).state;
  assert.equal(s.orders.o.status, "REVIEW");
  assert.equal(s.cards.card.owner, null);
});
test("PayPal requires bound verified completed capture; duplicate event cannot be reused", () => {
  let s = run(
    fixture(),
    member,
    "o",
    { kind: "order", product: "elite", card: "card", method: "paypal" },
    now,
  ).state;
  const pay = {
    kind: "payment",
    order: "o",
    event: "p1",
    providerOrder: "PP1",
    capture: "CAP1",
    cents: 9900,
    currency: "AUD",
    confirmed: true,
  };
  assert.throws(() => run(s, provider, "p", pay, now), /bound/);
  s = run(
    s,
    provider,
    "bind",
    { kind: "bind-paypal", order: "o", providerOrder: "PP1" },
    now,
  ).state;
  s = run(s, provider, "p", pay, now).state;
  assert.throws(
    () => run(s, provider, "retry", { ...pay, cents: 1 }, now),
    /collision/,
  );
  s = run(s, provider, "f", { kind: "fulfil", order: "o" }, now).state;
  assert.equal(s.cards.card.owner, member.id);
  s = run(s, provider, "duplicate-capture", { ...pay, event: "p2" }, now).state;
  assert.equal(s.orders.o.status, "FULFILLED");
});
test("KYC and beneficiary gate withdrawal, reserve only eligible funds, never enable payouts", () => {
  let s = fixture();
  s.funds.member = { eligible: 5000, reserved: 0 };
  s.beneficiaries.bank = { member: "member", verified: true };
  const w = { kind: "withdraw", cents: 4000, beneficiary: "bank" };
  assert.throws(() => run(s, member, "w", w, now), /identity/);
  s = run(
    s,
    member,
    "start",
    { kind: "kyc-start", session: "session" },
    now,
  ).state;
  const e = {
    kind: "kyc-event",
    member: "member",
    event: "verified",
    session: "session",
    revision: 1,
    state: "VERIFIED",
    expires: now + 10000,
    reason: "Synthetic authorised review only",
  };
  assert.throws(() => run(s, member, "self", e, now), /MFA/);
  s = run(s, admin, "event", e, now).state;
  s = run(s, member, "w", w, now).state;
  assert.equal(s.funds.member.reserved, 4000);
  assert.throws(() => run(s, member, "w2", w, now), /funds/);
  assert.throws(
    () =>
      run(
        s,
        admin,
        "approve-late",
        {
          kind: "withdraw-review",
          withdrawal: "w",
          status: "APPROVED",
          reason: "Review synthetic request",
        },
        now + 10000,
      ),
    /identity/,
  );
  s = run(
    s,
    admin,
    "approve",
    {
      kind: "withdraw-review",
      withdrawal: "w",
      status: "APPROVED",
      reason: "Review synthetic request",
    },
    now,
  ).state;
  assert.throws(
    () => run(s, admin, "payout", { kind: "payout", withdrawal: "w" }, now),
    /disabled/,
  );
  s = run(
    s,
    admin,
    "fail",
    {
      kind: "withdraw-review",
      withdrawal: "w",
      status: "FAILED",
      reason: "No approved payout rail",
    },
    now,
  ).state;
  assert.equal(s.funds.member.reserved, 0);
});
test("Identity webhook verifies raw HMAC and rejects tampering", () => {
  const raw = '{"test":true}',
    key = "synthetic-secret";
  const sig = createHmac("sha256", key).update(raw).digest("hex");
  assert.deepEqual(verifyIdentitySignature(raw, sig, key), { test: true });
  assert.throws(() => verifyIdentitySignature(raw + " ", sig, key));
});
test("PayPal transport pins sandbox and verifies signature, event kind, currency, amount and order", async () => {
  let success = true;
  const calls: string[] = [];
  const transport = (async (url: string | URL | Request) => {
    calls.push(String(url));
    return Response.json(
      String(url).endsWith("token")
        ? { access_token: "TEST" }
        : { verification_status: success ? "SUCCESS" : "FAILURE" },
    );
  }) as typeof fetch;
  const api = new PayPalSandbox(
    { clientId: "TEST", secret: "TEST", webhookId: "TEST", merchantId: "TEST" },
    transport,
  );
  const h = new Headers(
    Object.fromEntries(
      [
        "paypal-auth-algo",
        "paypal-cert-url",
        "paypal-transmission-id",
        "paypal-transmission-sig",
        "paypal-transmission-time",
      ].map((x) => [x, "test"]),
    ),
  );
  const e = {
    id: "event",
    event_type: "PAYMENT.CAPTURE.COMPLETED",
    resource: {
      id: "cap",
      status: "COMPLETED",
      amount: { currency_code: "AUD", value: "99.00" },
      supplementary_data: { related_ids: { order_id: "PP1" } },
    },
  };
  assert.equal(
    (await api.verifiedCapture(h, e, { order: "PP1", price: 9900 })).cents,
    9900,
  );
  await assert.rejects(() =>
    api.verifiedCapture(h, e, { order: "PP2", price: 9900 }),
  );
  success = false;
  await assert.rejects(() =>
    api.verifiedCapture(h, e, { order: "PP1", price: 9900 }),
  );
  assert.ok(
    calls.every((x) => x.startsWith("https://api-m.sandbox.paypal.com/")),
  );
});
