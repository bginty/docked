import { currentRulesets } from "./scoring-release";
import { aflConfiguration } from "./sport-configuration";
import type { Rules } from "./scoring-v1";
/** New format snapshot; retain the repository's existing v2 event weights.
 * Does not register a scored round, approve data rights or mutate v1/v2. */
export function aflTwentyTwoRules(): Rules {
  return {
    ...structuredClone(currentRulesets.afl),
    version: "docked-afl-22-events-sandbox-v1",
    title: "Docked AFL · 22-player sandbox",
    slots: structuredClone(aflConfiguration.slots),
    policy: [
      currentRulesets.afl.policy[0],
      "Approved format: six backs, eight midfielders, six forwards and two rucks. No bench, emergencies, captain or additional rarity multipliers. Live scoring remains disabled pending source rights and release approval.",
      ...currentRulesets.afl.policy.slice(2),
    ],
  };
}
