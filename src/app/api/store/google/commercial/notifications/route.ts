import { commercialGoogleNotification } from "@/server/commercial-google-notification-handler";
import { isolatedBillingConfiguration } from "@/core/isolated-billing-acceptance";
import { boundedCommunityBody } from "@/core/community-social";
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
    return await commercialGoogleNotification(req);
  } catch {
    return Response.json(
      { error: "Commercial notification persistence unavailable" },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
