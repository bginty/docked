import { productionInvitationsEnabled } from "./auth-invitation";
import { isolatedCustomerEmailEnabled } from "./isolated-public-preview.mjs";
import productionManifest from "../../config/hosted-production.json";
import { assertHostedProduction } from "./hosted-production.mjs";
import { publicCustomersEnabled } from "./public-customer";

/** Verification/recovery only. Invitation privileges remain independently gated. */
export function customerEmailEnabled(env: Record<string, string | undefined>) {
  if (productionInvitationsEnabled(env) || isolatedCustomerEmailEnabled(env))
    return true;
  if (
    !publicCustomersEnabled(env) ||
    env.DOCKED_HOSTED_PRODUCTION !== "true" ||
    env.DOCKED_RELEASE_CHANNEL !== "stable" ||
    env.AUTH_EMAIL_ENABLED !== "true"
  )
    return false;
  // Existing email links must still work while new signups are paused.
  assertHostedProduction(env, productionManifest);
  return true;
}
