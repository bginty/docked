import "server-only";
import { after } from "next/server";
import { schedulePreviewInAppBatch } from "@/core/preview-maintenance";
import type { identity } from "./auth";
import { db, rateLimit } from "./db";
import { previewCommunityPolicy } from "./preview-community";
import { processCommunityNotifications } from "./community-social";

/** Called only after an authenticated request; never sends email or native push. */
export async function schedulePreviewNotifications(
  who: NonNullable<Awaited<ReturnType<typeof identity>>>,
) {
  await schedulePreviewInAppBatch(who.user.id, {
    environment: () => process.env,
    eligible: async () =>
      (await previewCommunityPolicy(who, "community_social")).allowed,
    rate: rateLimit,
    defer: after,
    process: () => processCommunityNotifications({ previewOnly: true }),
    failure: async () => {
      await db()`insert into private.audit_events(actor,action,subject,details) values('preview-maintenance','in_app_batch_failed','service','{"reason":"Bounded in-app processing failed; durable cursor retained"}')`;
    },
  });
}
