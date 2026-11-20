import { after } from "next/server";
import { commercialRuntime } from "./commercial-runtime";
import { googleNotificationRequest } from "./google-reconciliation-http";

export function commercialGoogleNotification(req: Request) {
  return googleNotificationRequest(req, {
    policy: {
      audience: process.env.DOCKED_GOOGLE_COMMERCIAL_PUSH_AUDIENCE ?? "",
      serviceAccount:
        process.env.DOCKED_GOOGLE_COMMERCIAL_PUSH_SERVICE_ACCOUNT ?? "",
      subscription:
        process.env.DOCKED_GOOGLE_COMMERCIAL_PUSH_SUBSCRIPTION ?? "",
      packageName: "docked.fantasy",
    },
    enqueue: async (n) => {
      const { worker } = await commercialRuntime();
      const inserted = await worker.enqueue(n);
      // Authenticate and persist before returning 204. Dispatch bounded work
      // independently of the browser; failed runs retain their durable jobs.
      after(async () => {
        try {
          const health = await worker.run();
          if (health.attentionRequired)
            console.error(
              JSON.stringify({
                event: "google-commercial-reconciliation",
                ...health,
              }),
            );
        } catch {
          console.error(
            JSON.stringify({
              event: "google-commercial-reconciliation-deferred",
            }),
          );
        }
      });
      return inserted;
    },
  });
}
