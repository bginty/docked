import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { deliverBudgetedSms } from "@/server/sms-budget-hook";
import { phoneDeliveryReady } from "@/core/public-phone";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (
      process.env.DOCKED_SMS_BUDGET_HOOK_ENABLED !== "true" ||
      !phoneDeliveryReady()
    )
      throw Error("Disabled");
    // Bound streamed input, not just an untrusted Content-Length header.
    const reader = request.body?.getReader();
    if (!reader) throw Error("Missing body");
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.length;
        if (bytes > 16384) {
          await reader.cancel();
          throw Error("Body too large");
        }
        chunks.push(part.value);
      }
    } finally {
      reader.releaseLock();
    }
    await deliverBudgetedSms(
      Buffer.concat(chunks).toString("utf8"),
      Object.fromEntries(request.headers),
      {
        secret: process.env.DOCKED_SMS_HOOK_SECRET ?? "",
        window: process.env.DOCKED_SMS_BUDGET_WINDOW ?? "",
        account: process.env.DOCKED_TWILIO_ACCOUNT_SID ?? "",
        token: process.env.DOCKED_TWILIO_AUTH_TOKEN ?? "",
        service: process.env.DOCKED_TWILIO_MESSAGE_SERVICE_SID ?? "",
      },
      {
        async reserve(w, f, u) {
          const [row] =
            await db()`select sms_delivery.reserve(${w},${f},${u}::uuid) decision`;
          return row.decision;
        },
        async finish(w, f, accepted) {
          await db()`select sms_delivery.finish(${w},${f},${accepted})`;
        },
      },
    );
    return NextResponse.json({}, { headers: { "Cache-Control": "no-store" } });
  } catch {
    // Never return/log an OTP, phone, provider response or credential-bearing error.
    return NextResponse.json(
      {
        error: {
          http_code: 503,
          message:
            "Phone verification temporarily unavailable. Please wait before trying again.",
        },
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
