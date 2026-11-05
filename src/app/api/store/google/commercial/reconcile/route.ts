import { commercialRuntime } from "@/server/commercial-runtime";
import { googleReconciliationRequest } from "@/server/google-reconciliation-http";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(req: Request) {
  return googleReconciliationRequest(req, {
    secret: process.env.DOCKED_GOOGLE_COMMERCIAL_WORKER_SECRET ?? "",
    run: async () => {
      const { worker } = await commercialRuntime();
      return worker.run();
    },
  });
}
