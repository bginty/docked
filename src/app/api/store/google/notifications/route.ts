import { googleNotificationRequest } from "@/server/google-reconciliation-http";
import { memberGoogleReconciliation } from "@/server/member-google-reconciliation";
import { relayIsolatedGoogleNotification } from "@/server/isolated-v30-transport";
import { commercialGoogleNotification } from "@/server/commercial-google-notification-handler";
export const maxDuration = 60;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    if (
      process.env.DOCKED_COMMERCIAL_SERVICE === "true" &&
      process.env.DOCKED_FRIENDS_BETA === "false" &&
      process.env.DOCKED_BETA_STAGING === "false"
    ) {
      return await commercialGoogleNotification(req);
    }
    const relay = req.clone();
    const response = await googleNotificationRequest(
      req,
      memberGoogleReconciliation(),
    );
    if (response.status === 204)
      await relayIsolatedGoogleNotification(relay, process.env);
    return response;
  } catch {
    return Response.json(
      { error: "Store notifications unavailable" },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
