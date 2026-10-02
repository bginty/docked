import type { EmailProvider } from "./contracts";
export class ResendEmail implements EmailProvider {
  async send(m: {
    to: string;
    subject: string;
    text: string;
    unsubscribeUrl: string;
    idempotencyKey: string;
  }) {
    if (
      process.env.APP_ENV !== "production" ||
      process.env.SENDING_ENABLED !== "true" ||
      !process.env.EMAIL_API_KEY ||
      !process.env.EMAIL_FROM ||
      !process.env.EMAIL_SENDER_IDENTITY
    )
      throw new Error("Real sending disabled");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.EMAIL_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": m.idempotencyKey,
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: m.to,
        subject: m.subject,
        text: `${m.text}\n\n${process.env.EMAIL_SENDER_IDENTITY}\nManage optional communications: ${m.unsubscribeUrl.replace("/api/unsubscribe", "/unsubscribe")}`,
        headers: {
          "List-Unsubscribe": `<${m.unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`Email provider HTTP ${response.status}`);
    return (await response.json()) as { id: string };
  }
}
