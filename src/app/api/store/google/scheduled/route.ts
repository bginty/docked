import { googleScheduledReconciliationRequest } from "@/server/google-reconciliation-http";
import { memberGoogleReconciliation } from "@/server/member-google-reconciliation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(req: Request) {
  const response = await googleScheduledReconciliationRequest(req, {
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
  if (response.status === 401)
    console.warn(
      JSON.stringify({
        event: "google-test-scheduler-auth-denied",
        authorizationPresent: req.headers.has("authorization"),
        cookiePresent: req.headers.has("cookie"),
        originPresent: req.headers.has("origin"),
        forwardedAuthorizationPresent: req.headers.has(
          "x-forwarded-authorization",
        ),
      }),
    );
  return response;
}
