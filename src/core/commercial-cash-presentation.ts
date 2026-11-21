/** Exact versions of the separately prepared cash-capable release documents.
 * Selection publishes notices; it never proves provider, cash or payout readiness. */
export const cashWithdrawalConsentVersions = {
  terms: "2026-11-21-terms-market-withdrawals-v1",
  privacy: "2026-11-21-privacy-market-withdrawals-v1",
} as const;

/** Persistent document selection, deliberately independent of request/payment
 * kill switches. Stopping new transactions must not erase published obligations. */
export function cashWithdrawalPolicyPublished(
  env: Record<string, string | undefined> = process.env,
) {
  return (
    env.DOCKED_COMMERCIAL_CASH_POLICY === "true" &&
    env.DOCKED_BETA_STAGING !== "true" &&
    env.TERMS_VERSION === cashWithdrawalConsentVersions.terms &&
    env.PRIVACY_POLICY_VERSION === cashWithdrawalConsentVersions.privacy
  );
}
