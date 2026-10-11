import { test } from "node:test";
import assert from "node:assert/strict";
import { PayPalSandbox } from "../../src/server/paypal-sandbox";
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
