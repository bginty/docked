import { createHmac } from "node:crypto";
import { Webhook } from "svix";
import { z } from "zod";
import { normalizedPhone } from "../core/public-phone";

const payloadSchema = z.object({
  user: z.object({ id: z.string().uuid() }),
  sms: z.object({
    otp: z.string().regex(/^[0-9]{6}$/),
    phone: z.string().min(1).max(40),
  }),
});
export type SmsBudgetStore = {
  reserve(window: string, fingerprint: string, user: string): Promise<string>;
  finish(window: string, fingerprint: string, accepted: boolean): Promise<void>;
};
export type SmsHookConfig = {
  secret: string;
  window: string;
  account: string;
  token: string;
  service: string;
};

/** Signed Supabase Auth calls only. No HTTP retry or release of ambiguous costs. */
export async function deliverBudgetedSms(
  raw: string,
  headers: Record<string, string>,
  config: SmsHookConfig,
  store: SmsBudgetStore,
  send: typeof fetch = fetch,
) {
  const started = performance.now();
  if (
    Buffer.byteLength(raw) > 16384 ||
    !/^v1,whsec_[A-Za-z0-9+/=]+$/.test(config.secret) ||
    !/^[a-z0-9-]{8,80}$/.test(config.window) ||
    !/^AC[a-fA-F0-9]{32}$/.test(config.account) ||
    !/^MG[a-fA-F0-9]{32}$/.test(config.service) ||
    !config.token ||
    config.token.length > 256
  )
    throw Error("SMS unavailable");
  new Webhook(config.secret.slice(3)).verify(raw, headers);
  const input = payloadSchema.parse(JSON.parse(raw));
  // GoTrue supplies the OTP destination in sms.phone. During phone_change,
  // user.phone is absent or the OLD number; never use it as a fallback.
  const phone = normalizedPhone(input.sms.phone);
  const fingerprint = createHmac("sha256", config.secret)
    .update(
      JSON.stringify([config.window, input.user.id, phone, input.sms.otp]),
    )
    .digest("hex");
  const decision = await store.reserve(
    config.window,
    fingerprint,
    input.user.id,
  );
  if (decision === "accepted") return;
  if (decision !== "send") throw Error("SMS unavailable");
  // ASCII-only, one GSM segment; never interpolate names or arbitrary text.
  const body = `Your Docked verification code is ${input.sms.otp}. It expires in 5 minutes. Do not share this code.`;
  let accepted = false;
  try {
    // Auth allows five seconds for the whole hook. A slow reservation must not
    // start a fresh provider send after that invocation has already timed out.
    const remaining = Math.floor(4000 - (performance.now() - started));
    if (remaining < 500) throw Error("SMS unavailable");
    const response = await send(
      `https://api.twilio.com/2010-04-01/Accounts/${config.account}/Messages.json`,
      {
        method: "POST",
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(Math.min(3000, remaining)),
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(config.account + ":" + config.token).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: phone,
          MessagingServiceSid: config.service,
          Body: body,
          ValidityPeriod: "300",
        }),
      },
    );
    // Consume no provider response into logs; acceptance is not inbox delivery.
    const result = response.ok ? await response.json() : null;
    accepted =
      response.status === 201 &&
      /^SM[a-fA-F0-9]{32}$/.test(result?.sid ?? "") &&
      ["accepted", "queued", "sending", "sent", "delivered"].includes(
        result?.status,
      );
  } finally {
    await store.finish(config.window, fingerprint, accepted);
  }
  if (!accepted) throw Error("SMS unavailable");
}
