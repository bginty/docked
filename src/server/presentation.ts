import "server-only";
import { cache } from "react";
import { authUiReadiness } from "@/core/auth-readiness";
import { config } from "./config";
import { db } from "./db";
import { fantasyEnabled } from "@/core/fantasy";
import { fantasyProductionEnabled } from "@/core/fantasy-production";

/** Only non-sensitive capability flags are passed to the client. */
export const environmentPresentation = cache(async () => {
  const settings = config();
  let registrationApproved = false;
  if (settings.database && settings.auth && settings.registration) {
    try {
      const rows =
        await db()`select enabled from private.feature_flags where key='registration'`;
      registrationApproved = rows[0]?.enabled === true;
    } catch {
      /* Registration stays unavailable during a database outage. */
    }
  }
  const readiness = authUiReadiness(process.env, registrationApproved);
  const accountConfigured = settings.auth && settings.database;
  return {
    ...readiness,
    reviewOnly: settings.reviewOnly,
    fantasyPreview: fantasyEnabled(),
    fantasyProduction: fantasyProductionEnabled(),
    registrationAvailable: accountConfigured && readiness.registrationAvailable,
    accountConfigured,
    reason: accountConfigured
      ? readiness.reason
      : "Account services are not configured. Registration is unavailable.",
  };
});
