import { commercialRuntime } from "@/server/commercial-runtime";
import { googleReconciliationRequest } from "@/server/google-reconciliation-http";
export const runtime = "nodejs";
export async function POST(req: Request) {
  return googleReconciliationRequest(req, {
    secret: process.env.DOCKED_GOOGLE_COMMERCIAL_WORKER_SECRET ?? "",
    run: async () => {
      const { worker } = await commercialRuntime();
      const scheduled = await worker.schedule();
      await Promise.all([worker.runOne(), worker.runOne(), worker.runOne()]);
      return { scheduled, ...(await worker.health()) };
    },
  });
}
