import { commercialRuntime } from "@/server/commercial-runtime";
import { googleNotificationRequest } from "@/server/google-reconciliation-http";
import { isolatedBillingConfiguration } from "@/core/isolated-billing-acceptance";
import { boundedCommunityBody } from "@/core/community-social";
import { after } from "next/server";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(req: Request) {
  try {
    // During an expiring isolated acceptance window the existing authenticated
    // Production receiver relays the original signed Pub/Sub envelope. Google
    // still must validate its original audience, service identity and subscription.
    // No shared relay secret, forged identity or manual notification is trusted.
    if (isolatedBillingConfiguration(process.env)) {
      if (
        new URL(req.url).pathname !==
        "/api/store/google/commercial/notifications"
      )
        throw Error("Wrong isolated receiver");
      req = new Request(
        "https://docked.com.au/api/store/google/notifications",
        {
          method: "POST",
          headers: req.headers,
          body: Buffer.from(await boundedCommunityBody(req, 65536)),
        },
      );
    }
    return await googleNotificationRequest(req, {
      policy: {
        audience: process.env.DOCKED_GOOGLE_COMMERCIAL_PUSH_AUDIENCE ?? "",
        serviceAccount:
          process.env.DOCKED_GOOGLE_COMMERCIAL_PUSH_SERVICE_ACCOUNT ?? "",
        subscription:
          process.env.DOCKED_GOOGLE_COMMERCIAL_PUSH_SUBSCRIPTION ?? "",
        packageName: "docked.fantasy",
      },
      enqueue: async (n) => {
        const { worker } = await commercialRuntime();
        const inserted = await worker.enqueue(n);
        // Authenticate and persist before returning 204. Dispatch bounded work
        // independently of the browser; failed runs retain their durable jobs.
        after(async () => {
          try {
            const health = await worker.run();
            if (health.attentionRequired)
              console.error(
                JSON.stringify({
                  event: "google-commercial-reconciliation",
                  ...health,
                }),
              );
          } catch {
            console.error(
              JSON.stringify({
                event: "google-commercial-reconciliation-deferred",
              }),
            );
          }
        });
        return inserted;
      },
    });
  } catch {
    return Response.json(
      { error: "Commercial notification persistence unavailable" },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
