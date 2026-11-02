import { googleReconciliationRequest } from "@/server/google-reconciliation-http";
import { retentionRuntime } from "@/server/commercial-retention-runtime";
export const runtime = "nodejs";
/** Existing authenticated worker transport; no browser/cookie/owner override.
 * No schedule is installed by this route. Dry-run unless separately configured. */
export async function POST(req: Request) {
  return googleReconciliationRequest(req, {
    secret: process.env.DOCKED_RETENTION_WORKER_SECRET ?? "",
    run: async () =>
      (await retentionRuntime()).run({
        expectedPolicy: process.env.DOCKED_RETENTION_POLICY_VERSION ?? "",
        apply: process.env.DOCKED_RETENTION_APPLY === "true",
        limit: 100,
      }),
  });
}
