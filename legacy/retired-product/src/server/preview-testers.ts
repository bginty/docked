import "server-only";
import type { TransactionSql } from "postgres";
import { db } from "./db";
import { requireIdentity } from "./auth";
import { setCommunityClaims, type CommunityActor } from "./community-social";
import {
  requirePreviewEnvironment,
  previewCapabilitySchema,
  type PreviewCapability,
} from "@/core/preview-testers";

export async function withPreviewTesterCapability<T>(
  capability: PreviewCapability,
  fn: (tx: TransactionSql, who: CommunityActor, grantId: string) => Promise<T>,
): Promise<T> {
  requirePreviewEnvironment();
  previewCapabilitySchema.parse(capability);
  const who = await requireIdentity();
  return (await db().begin(async (tx) => {
    await setCommunityClaims(tx, who);
    const [row] =
      await tx`select private.assert_preview_tester_capability(${who.user.id},${capability}) id`;
    return fn(tx, who, String(row.id));
  })) as T;
}
export async function requirePreviewTesterCapability(
  capability: PreviewCapability,
) {
  return withPreviewTesterCapability(capability, async (_tx, who, grantId) => ({
    who,
    grantId,
  }));
}
export async function previewTesterCapabilities() {
  try {
    requirePreviewEnvironment();
    const who = await requireIdentity();
    return await db().begin(async (tx) => {
      await setCommunityClaims(tx, who);
      const rows =
        await tx`select capability from unnest(array['community_social','public_profiles','preview_market_fixtures','preview_top_docked']) capability where private.preview_tester_capability(${who.user.id},capability)`;
      return rows.map((r) => String(r.capability) as PreviewCapability);
    });
  } catch {
    return [] as PreviewCapability[];
  }
}
