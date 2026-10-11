import historical from "../../config/beta-policy-content.json" with { type: "json" };
import current from "../../config/friends-policy-content.json" with { type: "json" };
import { assertFriendsTarget } from "./friends-release.mjs";

/** Never serve historical copy under a new consent version.
 * @param {Record<string,string|undefined>} env
 * @param {Record<string,any>} [receipt] */
export function betaPolicyPacket(env, receipt) {
  if (env.DOCKED_FRIENDS_BETA !== "true")
    return { packet: historical, friends: false };
  assertFriendsTarget(env, receipt);
  return { packet: current, friends: true };
}
