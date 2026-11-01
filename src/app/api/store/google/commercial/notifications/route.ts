import { commercialRuntime } from "@/server/commercial-runtime";
import { googleNotificationRequest } from "@/server/google-reconciliation-http";
export const runtime = "nodejs";
export async function POST(req: Request) {
  try {
    return googleNotificationRequest(req, {
      policy: {
        audience: process.env.DOCKED_GOOGLE_COMMERCIAL_PUSH_AUDIENCE ?? "",
        serviceAccount:
          process.env.DOCKED_GOOGLE_COMMERCIAL_PUSH_SERVICE_ACCOUNT ?? "",
        subscription:
          process.env.DOCKED_GOOGLE_COMMERCIAL_PUSH_SUBSCRIPTION ?? "",
        packageName: "docked.fantasy",
      },
      enqueue: async (n) => (await commercialRuntime()).worker.enqueue(n),
    });
  } catch {
    return Response.json(
      { error: "Commercial notification persistence unavailable" },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
