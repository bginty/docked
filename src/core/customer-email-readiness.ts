import { productionInvitationsEnabled } from "./auth-invitation";
import { isolatedCustomerEmailEnabled } from "./isolated-public-preview.mjs";

/** Verification/recovery only. Invitation privileges remain independently gated. */
export function customerEmailEnabled(env: Record<string, string | undefined>) {
  return productionInvitationsEnabled(env) || isolatedCustomerEmailEnabled(env);
}
