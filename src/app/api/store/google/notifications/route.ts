import { googleNotificationRequest } from "@/server/google-reconciliation-http";
import { memberGoogleReconciliation } from "@/server/member-google-reconciliation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    return await googleNotificationRequest(req, memberGoogleReconciliation());
  } catch {
    return Response.json(
      { error: "Store notifications unavailable" },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
