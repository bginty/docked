import { NextResponse } from "next/server";
import { verifyEmailWebhook } from "@/server/webhooks";
import { db } from "@/server/db";
export async function POST(request: Request) {
  if (!process.env.EMAIL_WEBHOOK_SECRET || !process.env.DATABASE_URL)
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 503 },
    );
  try {
    const body = await request.text();
    if (body.length > 100000) throw new Error("Payload too large");
    const id = request.headers.get("svix-id") ?? "";
    const event = verifyEmailWebhook(
      body,
      {
        "svix-id": id,
        "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
        "svix-signature": request.headers.get("svix-signature") ?? "",
      },
      process.env.EMAIL_WEBHOOK_SECRET,
    );
    const sql = db();
    await sql.begin(async (tx) => {
      const receipt =
        await tx`insert into private.webhook_receipts(provider,event_id) values('resend',${id}) on conflict do nothing returning event_id`;
      if (!receipt.length) return;
      if (["email.bounced", "email.complained"].includes(event.type)) {
        await tx`insert into private.audit_events(actor,action,subject) values('provider-webhook',${event.type},'delivery')`;
        const recipients =
          await tx`select distinct user_id from private.delivery_attempts where provider_id=${event.data.email_id}`;
        for (const r of recipients) {
          await tx`update public.notification_preferences set paused=true where user_id=${r.user_id}`;
          await tx`update private.outbox set state='suppressed',last_error=${event.type} where user_id=${r.user_id} and state in ('queued','leased')`;
          await tx`insert into private.consent_events(user_id,purpose,granted,version,actor) values(${r.user_id},'all_optional',false,'2026-10','provider-webhook')`;
        }
      }
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid webhook" }, { status: 400 });
  }
}
