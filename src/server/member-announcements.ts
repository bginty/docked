import "server-only";
import { requireIdentity } from "./auth";
import { db } from "./db";
export type PublishedAnnouncement = {
  id: string;
  title: string;
  body: string;
  cta: string | null;
  published_at: string;
  edited_at?: string | null;
  pinned: boolean;
};
export async function memberAnnouncements(
  page = 1,
  id?: string,
): Promise<PublishedAnnouncement[]> {
  const who = await requireIdentity();
  if (process.env.DOCKED_BETA_STAGING !== "true") return [];
  if (!Number.isInteger(page) || page < 1 || page > 1000)
    throw Error("Invalid page");
  return db().begin(async (tx) => {
    await tx`select set_config('request.jwt.claim.sub',${who.user.id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: who.user.id, session_id: who.sessionId, aal: who.aal })},true)`;
    const [r] =
      await tx`select private.member_announcements(${id ?? null}::uuid,${page}) value`;
    return r.value;
  }) as Promise<PublishedAnnouncement[]>;
}
