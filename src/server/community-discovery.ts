import "server-only";
import type postgres from "postgres";
import { z } from "zod";
import { config } from "./config";
import { communityAccess } from "./community-policy";
import { withCommunityActor } from "./community-social";
import {
  decodeSocialCursor,
  encodeSocialCursor,
  type SocialProfile,
} from "@/core/community-social";

type Sql = postgres.TransactionSql;
const iso = (value: unknown) =>
  value instanceof Date ? value.toISOString() : String(value);
async function project(
  sql: Sql,
  ids: string[],
  viewer: string,
): Promise<SocialProfile[]> {
  if (!ids.length) return [];
  const rows =
    await sql`select p.id,p.handle,p.display_name,p.bio,p.is_official,p.visibility,p.status,p.joined_at,
    (select count(*) from private.social_follows where target_id=p.id) followers,
    (select count(*) from private.social_follows where actor_id=p.id) following,
    exists(select 1 from private.social_follows where actor_id=${viewer} and target_id=p.id) is_following,
    exists(select 1 from private.social_follows where actor_id=${viewer} and target_id=p.id and notifications) follow_notifications,
    exists(select 1 from private.social_mutes where actor_id=${viewer} and target_id=p.id) is_muted,
    (select id from private.social_media where id=p.avatar_media_id and owner_id=p.id and status='approved' and content is not null) avatar
    from private.social_profiles p where p.id=any(${ids}) and private.social_profile_visible(${viewer}::uuid,p.id,false)`;
  const mapped = new Map(
    rows.map((r) => [
      String(r.id),
      {
        id: String(r.id),
        handle: String(r.handle),
        displayName: String(r.display_name),
        bio: String(r.bio),
        avatarUrl: r.avatar ? `/api/community?view=media&id=${r.avatar}` : null,
        isOfficial: r.is_official === true,
        visibility: r.visibility as SocialProfile["visibility"],
        status: r.status as SocialProfile["status"],
        joinedAt: iso(r.joined_at),
        followers: Number(r.followers),
        following: Number(r.following),
        isFollowing: r.is_following === true,
        followNotifications: r.follow_notifications === true,
        isMuted: r.is_muted === true,
        isBlocked: false,
        isOwn: r.id === viewer,
      },
    ]),
  );
  return ids.flatMap((id) => (mapped.has(id) ? [mapped.get(id)!] : []));
}
const empty = {
  profiles: [] as SocialProfile[],
  nextCursor: null as string | null,
  message:
    "Member discovery requires an eligible account and connected community services.",
};
async function permitted() {
  return (
    config().database &&
    config().auth &&
    (await communityAccess("public_profiles")).allowed
  );
}
export async function communityGraph(
  profileId: string,
  direction: "followers" | "following",
  cursor?: string,
) {
  if (!(await permitted())) return empty;
  try {
    z.string().uuid().parse(profileId);
    const at = decodeSocialCursor(cursor);
    return await withCommunityActor(
      "public_profiles",
      false,
      async (tx, _who, viewer) => {
        const target =
          await tx`select id from private.social_profiles where id=${profileId} and private.social_profile_visible(${viewer}::uuid,id,false)`;
        if (!target.length)
          return {
            ...empty,
            message: "This member's relationships are unavailable.",
          };
        const rows =
          await tx`select p.id,f.created_at from private.social_follows f join private.social_profiles p
        on p.id=(case when ${direction === "followers"} then f.actor_id else f.target_id end)
        where (case when ${direction === "followers"} then f.target_id else f.actor_id end)=${profileId}
        and private.social_profile_visible(${viewer}::uuid,p.id,false)
        and (${at?.createdAt ?? null}::timestamptz is null or (f.created_at,p.id)<(${at?.createdAt ?? null}::timestamptz,${at?.id ?? null}::uuid))
        order by f.created_at desc,p.id desc limit 21`;
        const page = rows.slice(0, 20),
          last = page.at(-1);
        return {
          profiles: await project(
            tx,
            page.map((r) => String(r.id)),
            viewer,
          ),
          nextCursor:
            rows.length > 20 && last
              ? encodeSocialCursor(iso(last.created_at), String(last.id))
              : null,
          message:
            "Only relationships visible under profile privacy and block controls appear here.",
        };
      },
    );
  } catch {
    return {
      ...empty,
      message: "Member relationships are temporarily unavailable.",
    };
  }
}
export async function mostFollowedMembers() {
  if (!(await permitted())) return empty;
  try {
    return await withCommunityActor(
      "public_profiles",
      false,
      async (tx, _who, viewer) => {
        const rows =
          await tx`select p.id,count(f.actor_id) followers from private.social_profiles p
        left join private.social_follows f on f.target_id=p.id where not p.is_official
        and private.social_profile_visible(${viewer}::uuid,p.id,false)
        and not exists(select 1 from private.social_mutes where actor_id=${viewer} and target_id=p.id)
        group by p.id having count(f.actor_id)>0 order by count(f.actor_id) desc,p.id limit 8`;
        return {
          profiles: await project(
            tx,
            rows.map((r) => String(r.id)),
            viewer,
          ),
          nextCursor: null,
          message:
            "Ordered by recorded followers. Popularity is separate from performance and never changes Top Docked rank.",
        };
      },
    );
  } catch {
    return {
      ...empty,
      message: "Member discovery is temporarily unavailable.",
    };
  }
}
