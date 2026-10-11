import { assertHostedBeta } from "./hosted-beta.mjs";
import { packRevealPreview } from "./pack-opening";

/** Server-selected presentation flag. Admission and receipt ownership remain
 * enforced by the normal authenticated read/command path. Design samples use
 * packRevealPreview directly and never become public through this flag. */
export function packExperienceEnabled(
  env: Record<string, string | undefined> = process.env,
) {
  if (packRevealPreview(env)) return true;
  return (
    env.DOCKED_FRIENDS_PACK_REVEAL === "true" &&
    env.DOCKED_FRIENDS_BETA === "true" &&
    assertHostedBeta(env)
  );
}
