import "server-only";
import {
  announcementMutation,
  type AnnouncementDraft,
  type AnnouncementEvent,
  type AnnouncementListing,
} from "@/core/admin-announcements";
import { requireRole } from "./auth";
import { db, rateLimit } from "./db";

export async function adminAnnouncements(input: {
  page?: number;
  id?: string;
  mutation?: unknown;
}): Promise<AnnouncementListing | AnnouncementDraft | AnnouncementEvent[]> {
  const actor = await requireRole(["owner", "admin", "editor", "auditor"]);
  if (process.env.DOCKED_BETA_STAGING !== "true")
    throw Error("Announcement source unavailable");
  const mutation =
    input.mutation === undefined
      ? undefined
      : announcementMutation.parse(input.mutation);
  if (mutation && actor.role === "auditor") throw Error("Role denied");
  if (
    !(await rateLimit(
      `admin-announcements:${actor.user.id}`,
      mutation ? 20 : 60,
      60,
    ))
  )
    throw Error("Announcement rate limit");
  return db().begin(async (tx) => {
    // Admission checks take FOR SHARE locks; SQL READ ONLY would reject them.
    // Read branches still call only permission-scoped reporting projections.
    await tx`set local statement_timeout='4000ms'`;
    await tx`select set_config('request.jwt.claim.sub',${actor.user.id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: actor.user.id, session_id: actor.sessionId, aal: actor.aal })},true)`;
    if (mutation) {
      const [row] =
        await tx`select private.announcement_mutate(${tx.json(mutation)}::jsonb) value`;
      return row.value as AnnouncementDraft;
    }
    if (input.id) {
      const [row] =
        await tx`select private.announcement_history(${input.id}::uuid) value`;
      return row.value as AnnouncementEvent[];
    }
    const page = input.page ?? 1;
    if (!Number.isInteger(page) || page < 1 || page > 1000)
      throw Error("Invalid announcement page");
    const [row] = await tx`select private.announcement_list(${page}) value`;
    const data = row.value as Omit<AnnouncementListing, "page" | "hasMore">;
    return {
      ...data,
      drafts: data.drafts.slice(0, 25),
      hasMore: data.drafts.length > 25,
      page,
    };
  });
}
