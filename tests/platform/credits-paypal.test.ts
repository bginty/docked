import { test } from "node:test";
import assert from "node:assert/strict";
import { PayPalSandbox, paypalAmount } from "../../src/server/paypal-sandbox";

test("PayPal decimal strings retain every integer ledger cent without floating rounding", async () => {
  for (const [cents, expected] of [
    [1, "0.01"],
    [100, "1.00"],
    [4900, "49.00"],
    [Number.MAX_SAFE_INTEGER, "90071992547409.91"],
  ] as const)
    assert.equal(paypalAmount(cents), expected);
  for (const invalid of [
    0,
    -1,
    0.1,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
  ])
    assert.throws(() => paypalAmount(invalid), /integer cents/);
  let calls = 0;
  const api = new PayPalSandbox(
    {
      clientId: "fixture",
      secret: "fixture",
      webhookId: "fixture",
      merchantId: "fixture",
    },
    (async () => {
      calls++;
      throw Error("No provider request expected");
    }) as typeof fetch,
  );
  await assert.rejects(
    () => api.verifiedCapture(new Headers(), {}, { order: "PP1", price: 0 }),
    /integer cents/,
  );
  await assert.rejects(
    () =>
      api.verifiedCapture(new Headers(), {}, { order: "../wrong", price: 100 }),
    /Bound provider/,
  );
  assert.equal(calls, 0);
});
test("Wallet funding contract verifies authenticated merchant, order attribution, currency and exact captured amount", async () => {
  const order = {
    id: "PP1",
    status: "COMPLETED",
    purchase_units: [
      {
        custom_id: "LOCAL1",
        invoice_id: "LOCAL1",
        payee: { merchant_id: "MERCHANT" },
        amount: { currency_code: "AUD", value: "49.00" },
        payments: {
          captures: [
            {
              id: "CAP1",
              status: "COMPLETED",
              amount: { currency_code: "AUD", value: "49.00" },
            },
          ],
        },
      },
    ],
  };
  const calls: { url: string; method: string }[] = [];
  const transport = (async (url, options) => {
    const u = String(url);
    calls.push({ url: u, method: options?.method ?? "GET" });
    assert.equal(
      options?.redirect,
      "error",
      "Provider credentials must not follow redirects",
    );
    assert.ok(u.startsWith("https://api-m.sandbox.paypal.com/"));
    if (u.endsWith("/token")) {
      assert.equal(options?.method, "POST");
      return Response.json({ access_token: "synthetic-only" });
    }
    if (u.endsWith("/verify-webhook-signature"))
      return Response.json({ verification_status: "SUCCESS" });
    assert.equal(options?.method, "GET");
    return Response.json(order);
  }) as typeof fetch;
  const api = new PayPalSandbox(
    {
      clientId: "synthetic",
      secret: "synthetic",
      webhookId: "synthetic",
      merchantId: "MERCHANT",
    },
    transport,
  );
  const headers = new Headers(
    Object.fromEntries(
      [
        "paypal-auth-algo",
        "paypal-cert-url",
        "paypal-transmission-id",
        "paypal-transmission-sig",
        "paypal-transmission-time",
      ].map((k) => [k, "synthetic"]),
    ),
  );
  const event = {
    id: "EVENT1",
    event_type: "PAYMENT.CAPTURE.COMPLETED",
    resource: {
      id: "CAP1",
      status: "COMPLETED",
      amount: { currency_code: "AUD", value: "49.00" },
      supplementary_data: { related_ids: { order_id: "PP1" } },
    },
  };
  const expected = { order: "PP1", price: 4900, reference: "LOCAL1" };
  assert.equal(
    (await api.verifiedFundingCapture(headers, event, expected)).capture,
    "CAP1",
  );
  order.purchase_units[0].payee.merchant_id = "OTHER";
  await assert.rejects(
    () => api.verifiedFundingCapture(headers, event, expected),
    /merchant/,
  );
  order.purchase_units[0].payee.merchant_id = "MERCHANT";
  order.purchase_units[0].custom_id = "SOMEONE_ELSE";
  await assert.rejects(
    () => api.verifiedFundingCapture(headers, event, expected),
    /reference/,
  );
  order.purchase_units[0].custom_id = "LOCAL1";
  order.purchase_units[0].payments.captures[0].amount.value = "1.00";
  await assert.rejects(
    () => api.verifiedFundingCapture(headers, event, expected),
    /capture/,
  );
  assert.ok(calls.length > 0);
});
