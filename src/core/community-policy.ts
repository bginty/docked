import { eligible, type RegionPolicy } from "./policy";

export const communityFeatures = [
  "community_social",
  "community_edges",
  "public_profiles",
  "leaderboards",
  "paid_analysis",
  "competitions",
  "prizes",
  "deals",
  "sponsorship",
  "marketing",
] as const;
export type CommunityFeature = (typeof communityFeatures)[number];

/** A tips approval does not silently approve a community or commercial feature. */
export function communityFeatureAllowed(
  policy: RegionPolicy | null,
  location: { country: string; state: string; ageAttested: boolean },
  feature: CommunityFeature,
  now: string,
  operator?: string,
) {
  // Existing accounts attest 18+, not a higher jurisdiction-specific age.
  if (!policy || policy.minimumAge !== 18) return false;
  return eligible(policy, location, feature, now, operator);
}
