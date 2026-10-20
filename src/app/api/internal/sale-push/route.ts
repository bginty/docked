import { NextResponse } from "next/server";
import { timingSafeEqual, createHash } from "node:crypto";
import postgres from "postgres";
import webpush from "web-push";
import { pushConfigured } from "@/server/web-push-config";
import { databaseConnectionOptions } from "@/server/database-tls";
import { safePushEndpoint } from "@/core/web-push";
import { saleNotice, type SaleNotice } from "@/core/sale-notice";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (
    !secret ||
    actual.length !== expected.length ||
    !timingSafeEqual(actual, expected)
  )
    return new NextResponse(null, { status: 401 });
  if (!pushConfigured())
    return NextResponse.json({ configured: false }, { status: 503 });
  const url = process.env.WEB_PUSH_WORKER_DATABASE_URL!;
  const sql = postgres(url, {
    ...databaseConnectionOptions(url),
    max: 1,
    prepare: false,
    connect_timeout: 10,
  });
  try {
    const jobs = (await sql`select credits_sandbox.claim_sale_push() jobs`)[0]
      .jobs as {
      listing: string;
      subscription: string;
      lease: string;
      endpoint: string;
      keys: { p256dh: string; auth: string };
      receipt: SaleNotice;
    }[];
    let sent = 0;
    await Promise.all(
      jobs.map(async (job) => {
        let status = "retry";
        try {
          if (!safePushEndpoint(job.endpoint)) {
            status = "expired";
          } else {
            const notice = saleNotice(job.receipt),
              id = createHash("sha256")
                .update(job.listing)
                .digest("base64url")
                .slice(0, 32);
            await webpush.sendNotification(
              { endpoint: job.endpoint, keys: job.keys },
              JSON.stringify({
                id,
                title: notice.title,
                body: `${notice.body} You received ${job.receipt.net.toLocaleString("en-AU")} credits.`,
                href: `/fantasy/market?tab=activity&sale=${encodeURIComponent(job.listing)}`,
              }),
              {
                vapidDetails: {
                  subject: process.env.WEB_PUSH_VAPID_SUBJECT!,
                  publicKey: process.env.WEB_PUSH_VAPID_PUBLIC_KEY!,
                  privateKey: process.env.WEB_PUSH_VAPID_PRIVATE_KEY!,
                },
                timeout: 8000,
                TTL: 86400,
                topic: id,
              },
            );
            status = "sent";
            sent++;
          }
        } catch (error) {
          const code = (error as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) status = "expired";
        }
        await sql`select credits_sandbox.finish_sale_push(${job.listing},${job.subscription}::uuid,${job.lease}::uuid,${status})`;
      }),
    );
    return NextResponse.json(
      { processed: jobs.length, sent },
      { headers: { "Cache-Control": "no-store" } },
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}
