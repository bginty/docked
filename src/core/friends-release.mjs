import recorded from "../../config/friends-release.json" with { type: "json" };
import policy from "../../config/friends-policy-content.json" with { type: "json" };

/** Readiness evidence is separate from the owner's already-recorded release authority.
 * No environment variable alone opens the friends release.
 * @param {Record<string, any>} [receipt]
 */
export function assertFriendsReadiness(receipt = recorded) {
  if (
    receipt.schemaVersion !== 1 ||
    receipt.liveDomainDeploymentAuthorizedWhenReady !== true ||
    receipt.externalReadinessVerified !== true ||
    receipt.maximumLifetimeInvitedTesters !== 10 ||
    receipt.country !== "AU" ||
    receipt.minimumAge !== 18 ||
    receipt.ordinaryMemberMfaMandatory !== false ||
    receipt.ownerAdminMfaMandatory !== true ||
    receipt.publicRegistration !== false ||
    receipt.realPayments !== false ||
    receipt.cashTrading !== false ||
    receipt.realWithdrawals !== false ||
    receipt.prizesActivated !== false ||
    receipt.kycCollection !== false ||
    receipt.sport !== "nfl" ||
    receipt.scoringMode !== "post-game" ||
    !/^[a-f0-9]{40}$/.test(receipt.readiness?.sourceCommit ?? "") ||
    !Number.isFinite(Date.parse(receipt.readiness?.verifiedAt ?? "")) ||
    !receipt.readiness?.evidencePath ||
    !receipt.policyApproval?.versions ||
    receipt.policyApproval?.digest !== policy.packetDigest ||
    !receipt.policyApproval?.approvedBy ||
    !Number.isFinite(Date.parse(receipt.policyApproval?.approvedAt ?? "")) ||
    [
      "terms",
      "privacy",
      "beta",
      "community",
      "fantasy",
      "competition",
      "responsible_gambling",
    ].some((key) => receipt.policyApproval?.versions?.[key] !== policy.version)
  )
    throw Error("Friends release readiness is incomplete");
  for (const key of [
    "mailbox",
    "privacy",
    "admission",
    "security",
    "inventory",
    "memberGameplay",
  ])
    if (receipt.readiness.checks?.[key] !== true)
      throw Error("Friends release evidence is incomplete: " + key);
  if (receipt.readiness.checks?.nflCollection !== true) {
    if (
      receipt.releaseStage !== "invited-gameplay" ||
      receipt.scoringAcceptance?.status !== "pending" ||
      receipt.scoringAcceptance?.freshUnattendedCollection !== false ||
      receipt.scoringAcceptance?.genuineMemberRoundObserved !== false ||
      !receipt.scoringAcceptance?.authority ||
      !receipt.scoringAcceptance?.notice
    )
      throw Error(
        "Pending scoring requires explicit staged gameplay authority and disclosure",
      );
  }
  return receipt;
}

/** Exact production host binding; protected owner Preview keeps its separate guard.
 * @param {Record<string,string|undefined>} env
 * @param {Record<string,any>} [receipt]
 */
export function assertFriendsTarget(env, receipt = recorded) {
  if (env.DOCKED_FRIENDS_BETA !== "true") return false;
  assertFriendsReadiness(receipt);
  if (
    env.DOCKED_BETA_STAGING !== "true" ||
    env.VERCEL_ENV !== "production" ||
    (env.VERCEL_TARGET_ENV && env.VERCEL_TARGET_ENV !== "production") ||
    env.SITE_URL !== "https://docked.com.au" ||
    env.BETA_TESTERS_ENABLED !== "true" ||
    env.BETA_ACCESS_ENABLED !== "true" ||
    env.AUTH_EMAIL_ENABLED !== "true" ||
    env.DOCKED_AUTH_INVITES_READY !== "true" ||
    env.DOCKED_OWNER_GAMEPLAY !== "true" ||
    env.FANTASY_FREE_PLAY_PRODUCTION !== "true" ||
    env.DOCKED_TWO_PERSON_BETA !== "true"
  )
    throw Error("Unreviewed friends deployment target");
  return true;
}
