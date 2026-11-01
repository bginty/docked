import { googleReconciliationRequest } from "@/server/google-reconciliation-http";
import { memberGoogleReconciliation } from "@/server/member-google-reconciliation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export function POST(req: Request) {
  return googleReconciliationRequest(req, {
    secret: process.env.DOCKED_STORE_WORKER_SECRET ?? "",
    run: () => memberGoogleReconciliation().run(),
  });
}
