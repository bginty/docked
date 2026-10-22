import { assertHostedBeta } from "./hosted-beta.mjs";

/** This opens only the isolated NBA laboratory in the existing private beta.
 * Live sport activation, issuance, trading and ingestion retain their own gates. */
export function nbaPrivateBetaEnabled(
  env: Record<string, string | undefined> = process.env,
) {
  if (env.DOCKED_NBA_PRIVATE_BETA !== "true") return false;
  if (
    env.DOCKED_FRIENDS_BETA !== "true" ||
    !assertHostedBeta(env) ||
    env.REGISTRATION_ENABLED !== "false" ||
    env.DOCKED_MULTI_SPORT_SANDBOX === "true"
  )
    throw Error("NBA private beta target is not approved");
  return true;
}
