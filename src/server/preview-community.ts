import "server-only";
import type { TransactionSql } from "postgres";
import type { identity } from "./auth";
import { db } from "./db";
import { previewCommunityPolicyQuery } from "./preview-community-query";
import {
  previewCommunityContext,
  previewCommunityFeature,
} from "@/core/preview-community";

export async function setPreviewCommunityContext(tx: TransactionSql) {
  await tx`select set_config('docked.hosted_preview_project',${previewCommunityContext(process.env)},true)`;
}

export async function previewCommunityPolicy(
  who: NonNullable<Awaited<ReturnType<typeof identity>>>,
  feature: string,
  operator?: string,
) {
  if (
    !previewCommunityFeature(feature, operator) ||
    !previewCommunityContext(process.env)
  )
    return { allowed: false, policy: null };
  return db().begin(async (tx) => {
    await setPreviewCommunityContext(tx);
    await tx`select set_config('request.jwt.claim.sub',${who.user.id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: who.user.id, session_id: who.sessionId, aal: who.aal })},true)`;
    const rows = await tx.unsafe(previewCommunityPolicyQuery, [
      who.user.id,
      feature,
    ]);
    const policy = rows[0]?.policy ? String(rows[0].policy) : null;
    return { allowed: policy !== null, policy };
  });
}
