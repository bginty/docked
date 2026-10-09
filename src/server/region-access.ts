import "server-only";
import { config } from "./config";
import { db } from "./db";
import { identity } from "./auth";
import { previewCommunityPolicy } from "./preview-community";
import { eligible, type RegionPolicy } from "@/core/policy";
export async function regionAccess(feature: string, operator?: string) {
  if (!["community_social", "public_profiles"].includes(feature))
    return { allowed: false, policy: null };
  if (!config().database || !config().auth)
    return { allowed: false, policy: null };
  const who = await identity();
  if (!who) return { allowed: false, policy: null };
  const sql = db();
  const rows =
    await sql`select * from private.region_policies where not preview_community_only and country=${who.profile.country} and state=${who.profile.state} and effective_from<=now() and effective_to>now() order by effective_from desc,id desc limit 1`;
  if (!rows[0]) return previewCommunityPolicy(who, feature, operator);
  const r = rows[0];
  const p: RegionPolicy = {
    country: r.country,
    state: r.state,
    effectiveFrom: r.effective_from.toISOString(),
    effectiveTo: r.effective_to.toISOString(),
    reviewAt: r.review_at.toISOString(),
    approved: r.approved,
    minimumAge: r.minimum_age,
    features: r.features,
    operators: r.operators,
    evidence: r.evidence,
    version: r.version,
  };
  const regular = {
    allowed: eligible(
      p,
      {
        country: who.profile.country,
        state: who.profile.state,
        ageAttested: who.profile.age_attested,
      },
      feature,
      new Date().toISOString(),
      operator,
    ),
    policy: r.id as string,
  };
  return regular.allowed
    ? regular
    : previewCommunityPolicy(who, feature, operator);
}
