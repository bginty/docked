import { googleScheduledReconciliationRequest } from "@/server/google-reconciliation-http";
import { memberGoogleReconciliation } from "@/server/member-google-reconciliation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export function GET(req: Request) {
  return googleScheduledReconciliationRequest(req, {
    secret: process.env.CRON_SECRET ?? "",
    run: async () => {
      const health = await memberGoogleReconciliation().run();
      // Operational counters only: never log receipt tokens or account identity.
      const event = { event: "google-test-reconciliation", ...health };
      if (health.attentionRequired) console.error(JSON.stringify(event));
      else console.info(JSON.stringify(event));
      return health;
    },
  });
}
