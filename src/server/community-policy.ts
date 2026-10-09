import "server-only";
import type { CommunityFeature } from "@/core/community-policy";
import { regionAccess } from "./region-access";
import { db } from "./db";

export async function communityAccess(
  feature: CommunityFeature,
  operator?: string,
) {
  const access = await regionAccess(feature, operator);
  if (!access.allowed || !access.policy) return access;
  const rows =
    await db()`select minimum_age from private.region_policies where id=${access.policy}`;
  return { ...access, allowed: rows[0]?.minimum_age === 18 };
}

export async function requireCommunityAccess(
  feature: CommunityFeature,
  operator?: string,
) {
  const access = await communityAccess(feature, operator);
  if (!access.allowed)
    throw new Error(
      "This community feature is not approved for your jurisdiction.",
    );
  return access;
}
