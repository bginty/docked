import "server-only";
import { z } from "zod";
import { db } from "./db";
import { requirePreviewEnvironment } from "@/core/preview-testers";
import { previewFixtureExportQuery } from "./preview-export-query";

/** Called with requireIdentity().user.id by the authenticated account-export route.
 * Revocation of a test capability must not erase an active account's export rights. */
export async function exportPreviewFixtureData(verifiedUserId: string) {
  z.uuid().parse(verifiedUserId);
  try {
    requirePreviewEnvironment();
  } catch {
    return null;
  }
  return {
    label: "DEMO / PREVIEW PRICE",
    purpose:
      "Synthetic test evidence only; excluded from genuine performance and rankings.",
    reviews: await db().unsafe(previewFixtureExportQuery, [verifiedUserId]),
  };
}
