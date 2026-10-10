import { z } from "zod";
const captureSchema = z.object({
  id: z.string(),
  status: z.literal("COMPLETED"),
  amount: z.object({
    currency_code: z.literal("AUD"),
    value: z.string().regex(/^\d+\.\d{2}$/),
  }),
  supplementary_data: z.object({
    related_ids: z.object({ order_id: z.string() }),
  }),
});
/** Sandbox host is fixed. There is deliberately no live-mode switch. */
export class PayPalSandbox {
  private readonly origin = "https://api-m.sandbox.paypal.com";
  constructor(
    private config: {
      clientId: string;
      secret: string;
      webhookId: string;
      merchantId: string;
    },
    private transport: typeof fetch = fetch,
  ) {
    if (Object.values(config).some((v) => !v))
      throw Error("PayPal sandbox not configured");
  }
  private async api(path: string, body: object, request?: string) {
    const auth = await this.transport(`${this.origin}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.config.clientId}:${this.config.secret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(15000),
    });
    if (!auth.ok) throw Error("PayPal sandbox authentication unavailable");
    const token = z
      .object({ access_token: z.string().min(1) })
      .parse(await auth.json());
    const r = await this.transport(this.origin + path, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        "Content-Type": "application/json",
        ...(request ? { "PayPal-Request-Id": request } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok)
      throw Error(
        `PayPal sandbox request failed (${r.status}); reconcile before retry`,
      );
    return r.json();
  }
  async createOrder(order: { id: string; price: number; currency: "AUD" }) {
    if (
      !/^[a-zA-Z0-9_-]{1,100}$/.test(order.id) ||
      !Number.isSafeInteger(order.price) ||
      order.price <= 0 ||
      order.currency !== "AUD"
    )
      throw Error("Server order required");
    return this.api(
      "/v2/checkout/orders",
      {
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: order.id,
            custom_id: order.id,
            invoice_id: order.id,
            payee: { merchant_id: this.config.merchantId },
            amount: {
              currency_code: "AUD",
              value: (order.price / 100).toFixed(2),
            },
          },
        ],
      },
      order.id,
    );
  }
  async capture(providerOrder: string, request: string) {
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(providerOrder) || !request)
      throw Error("Bound provider order required");
    return this.api(
      `/v2/checkout/orders/${providerOrder}/capture`,
      {},
      request,
    );
  }
  async verifiedCapture(
    headers: Headers,
    event: unknown,
    expected: { order: string; price: number },
  ) {
    const required = [
      "paypal-auth-algo",
      "paypal-cert-url",
      "paypal-transmission-id",
      "paypal-transmission-sig",
      "paypal-transmission-time",
    ];
    if (required.some((h) => !headers.get(h)))
      throw Error("Missing PayPal signature");
    const verification = await this.api(
      "/v1/notifications/verify-webhook-signature",
      {
        auth_algo: headers.get(required[0]),
        cert_url: headers.get(required[1]),
        transmission_id: headers.get(required[2]),
        transmission_sig: headers.get(required[3]),
        transmission_time: headers.get(required[4]),
        webhook_id: this.config.webhookId,
        webhook_event: event,
      },
    );
    if (verification.verification_status !== "SUCCESS")
      throw Error("Invalid PayPal signature");
    const e = z
      .object({
        id: z.string(),
        event_type: z.literal("PAYMENT.CAPTURE.COMPLETED"),
        resource: captureSchema,
      })
      .parse(event);
    const cents = Number(e.resource.amount.value.replace(".", ""));
    if (
      !Number.isSafeInteger(cents) ||
      cents !== expected.price ||
      e.resource.supplementary_data.related_ids.order_id !== expected.order
    )
      throw Error("Capture amount/order mismatch");
    return {
      event: e.id,
      capture: e.resource.id,
      providerOrder: expected.order,
      cents,
      currency: "AUD" as const,
      confirmed: true as const,
    };
  }
}
