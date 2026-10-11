import { assertHostedBeta } from "./hosted-beta.mjs";
/** Enables presentation and narrow invitation endpoints, never admission.
 * Protected acceptance uses the same SQL invitation gates as the friends site. */
export function customerOnboardingEnabled(env = process.env) {
  if (env.DOCKED_BETA_STAGING !== "true") return false;
  if (
    env.DOCKED_FRIENDS_BETA !== "true" &&
    env.DOCKED_CUSTOMER_ONBOARDING !== "true"
  )
    return false;
  return (
    assertHostedBeta(env) &&
    env.BETA_ACCESS_ENABLED === "true" &&
    env.DOCKED_OWNER_GAMEPLAY === "true"
  );
}
