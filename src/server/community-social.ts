import "server-only";
import { createHash } from "node:crypto";
import { encodeCommunityImage } from "./community-image";
import { communityImageMaxBytes } from "@/core/community-media";
import { setPreviewCommunityContext } from "./preview-community";
import type { TransactionSql } from "postgres";
import { z } from "zod";
import { db, rateLimit } from "./db";
import { identity, requireIdentity, requireRole } from "./auth";
import { requireCommunityAccess } from "./community-policy";
import type { CommunityFeature } from "@/core/community-policy";
import { recordAnalytics } from "./analytics";
import {
  OFFICIAL_PROFILE_ID,
  decodeSocialCursor,
  encodeSocialCursor,
  socialActionSchema,
  notificationActionSchema,
  safeSocialText,
  canReviewCommunityMedia,
} from "@/core/community-social";
import type {
  SocialProfile,
  SocialPost,
  SocialMedia,
  SocialComment,
  CommunityBase,
  CommunityFeed,
  CommunityFeedOptions,
  CommunityProfile,
  CommunitySearch,
  CommunityNotifications,
  CommunityModeration,
  NotificationPreferences,
} from "@/core/community-social";

export type CommunityActor = NonNullable<Awaited<ReturnType<typeof identity>>>;
export type CommunityTransaction = TransactionSql;
type Row = Record<string, unknown>;
type Context = {
  tx: CommunityTransaction;
  who: CommunityActor;
  profileId: string | null;
  viewer: SocialProfile | null;
};
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));
const mediaUrl = (id: string) => `/api/community?view=media&id=${id}`;
export async function setCommunityClaims(
  tx: CommunityTransaction,
  who: CommunityActor,
) {
  await setPreviewCommunityContext(tx);
  await tx`select set_config('request.jwt.claim.sub',${who.user.id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: who.user.id, session_id: who.sessionId, aal: who.aal })},true)`;
}
export async function withCommunityActor<T>(
  feature: CommunityFeature,
  requirePosting: boolean,
  callback: (
    tx: CommunityTransaction,
    who: CommunityActor,
    profileId: string,
  ) => Promise<T>,
): Promise<T> {
  const who = await requireIdentity();
  await requireCommunityAccess(feature);
  return (await db().begin(async (tx) => {
    await setCommunityClaims(tx, who);
    const rows =
      await tx`select private.community_actor(${who.user.id},${feature},${requirePosting}) as id`;
    return callback(tx, who, String(rows[0].id));
  })) as T;
}
async function profiles(
  tx: CommunityTransaction,
  ids: string[],
  viewer: string | null,
): Promise<SocialProfile[]> {
  if (!ids.length) return [];
  const rows =
    await tx`select p.id,p.handle,p.display_name,p.bio,p.avatar_media_id,p.is_official,p.visibility,p.status,p.joined_at,
    (select count(*)::int from private.social_follows f where f.target_id=p.id) as followers,
    (select count(*)::int from private.social_follows f where f.actor_id=p.id) as following,
    exists(select 1 from private.social_follows f where f.actor_id=${viewer} and f.target_id=p.id) as is_following,
    exists(select 1 from private.social_follows f where f.actor_id=${viewer} and f.target_id=p.id and f.notifications) as follow_notifications,
    exists(select 1 from private.social_mutes m where m.actor_id=${viewer} and m.target_id=p.id) as is_muted,
    exists(select 1 from private.social_blocks b where b.actor_id=${viewer} and b.target_id=p.id) as is_blocked,
    exists(select 1 from private.social_media m where m.id=p.avatar_media_id and m.owner_id=p.id and m.status='approved' and m.content is not null) as avatar_ready
    from private.social_profiles p where p.id=any(${ids})`;
  return rows.map((r) => ({
    id: String(r.id),
    handle: String(r.handle),
    displayName: String(r.display_name),
    bio: String(r.bio),
    avatarUrl: r.avatar_ready ? mediaUrl(String(r.avatar_media_id)) : null,
    isOfficial: r.is_official === true,
    visibility: r.visibility as SocialProfile["visibility"],
    status: r.status as SocialProfile["status"],
    joinedAt: iso(r.joined_at),
    followers: Number(r.followers),
    following: Number(r.following),
    isFollowing: r.is_following === true,
    followNotifications: r.follow_notifications === true,
    isMuted: r.is_muted === true,
    isBlocked: r.is_blocked === true,
    isOwn: r.id === viewer,
  }));
}
async function readCommunity<T>(
  feature: CommunityFeature,
  empty: T,
  fn: (context: Context) => Promise<T>,
): Promise<CommunityBase & T> {
  const gate = (status: CommunityBase["status"], message: string) => ({
    ...empty,
    status,
    message,
    viewer: null,
  });
  if (
    !process.env.DATABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
    return gate(
      "not_configured",
      "Community preview services are not configured. No live accounts or activity are simulated.",
    );
  try {
    const who = await identity();
    if (!who)
      return gate(
        "sign_in_required",
        "Sign in with a verified account to use the community.",
      );
    try {
      await requireCommunityAccess(feature);
    } catch {
      return gate(
        "restricted",
        "This community feature is awaiting approval for your country and state.",
      );
    }
    return (await db().begin(async (tx) => {
      await setCommunityClaims(tx, who);
      await tx`select private.community_assert_access(${who.user.id},${feature})`;
      const own =
        await tx`select id,status from private.social_profiles where user_id=${who.user.id}`;
      if (own[0]?.status === "suspended" || own[0]?.status === "deleted")
        return gate(
          "restricted",
          "Community access is restricted for this account.",
        );
      const profileId = own[0] ? String(own[0].id) : null;
      const viewer = profileId
        ? (await profiles(tx, [profileId], profileId))[0]
        : null;
      return {
        ...(await fn({ tx, who, profileId, viewer })),
        status: "ready" as const,
        message: "",
        viewer,
      };
    })) as CommunityBase & T;
  } catch {
    return gate(
      "unavailable",
      "Community data is temporarily unavailable. No activity has been fabricated.",
    );
  }
}
function toMedia(r: Row, staff = false): SocialMedia {
  return {
    id: String(r.id),
    url: r.status === "approved" || staff ? mediaUrl(String(r.id)) : null,
    alt: String(r.alt),
    width: Number(r.width),
    height: Number(r.height),
    status: r.status as SocialMedia["status"],
  };
}
async function projectPosts(
  tx: CommunityTransaction,
  rows: Row[],
  viewer: string | null,
): Promise<SocialPost[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => String(r.id));
  const comments =
    await tx`select c.* from private.social_comments c where c.post_id=any(${ids}) and private.social_profile_visible(${viewer},c.author_id,false) order by c.created_at,c.id limit 100`;
  const authors = await profiles(
    tx,
    [...new Set([...rows, ...comments].map((r) => String(r.author_id)))],
    viewer,
  );
  const byId = new Map(authors.map((a) => [a.id, a]));
  const media =
    await tx`select m.id,m.alt,m.width,m.height,m.status,link.post_id from private.social_post_media link join private.social_media m on m.id=link.media_id where link.post_id=any(${ids}) and m.status='approved' and m.content is not null order by link.position`;
  const counts = await tx`select p.id,
   (select count(*)::int from private.social_reactions r where r.post_id=p.id) as reactions,
   (select count(*)::int from private.social_comments c where c.post_id=p.id and c.deleted_at is null and c.moderation_status='visible' and private.social_profile_visible(${viewer},c.author_id,false)) as comments,
   exists(select 1 from private.social_reactions r where r.post_id=p.id and r.profile_id=${viewer}) as reacted,
   exists(select 1 from private.social_saved s where s.post_id=p.id and s.profile_id=${viewer}) as saved from private.social_posts p where p.id=any(${ids})`;
  const countsById = new Map(counts.map((r) => [String(r.id), r]));
  return rows.map((r) => {
    const count = countsById.get(String(r.id))!;
    return {
      id: String(r.id),
      author: byId.get(String(r.author_id))!,
      kind: r.kind as SocialPost["kind"],
      body:
        r.moderation_status === "visible" && !r.deleted_at
          ? String(r.body)
          : "COMMENTARY REMOVED BY MODERATION",
      sport: r.sport ? String(r.sport) : null,
      createdAt: iso(r.created_at),
      moderationStatus: r.moderation_status as SocialPost["moderationStatus"],
      claimLabel: r.claim_label as SocialPost["claimLabel"],
      officialTipId: r.official_tip_id ? String(r.official_tip_id) : null,
      communityEdgeId: r.community_edge_id ? String(r.community_edge_id) : null,
      media:
        r.moderation_status === "visible"
          ? media.filter((m) => m.post_id === r.id).map((m) => toMedia(m))
          : [],
      reactionCount: Number(count.reactions),
      commentCount: Number(count.comments),
      isReacted: count.reacted === true,
      isSaved: count.saved === true,
      comments: comments
        .filter((c) => c.post_id === r.id)
        .map((c) => ({
          id: String(c.id),
          postId: String(c.post_id),
          parentId: c.parent_id ? String(c.parent_id) : null,
          author: byId.get(String(c.author_id))!,
          body:
            c.moderation_status === "visible" && !c.deleted_at
              ? String(c.body)
              : "Comment removed",
          createdAt: iso(c.created_at),
          moderationStatus:
            c.moderation_status as SocialComment["moderationStatus"],
        })),
    };
  });
}
async function selectPosts(
  c: Context,
  options: CommunityFeedOptions = {},
  search?: string,
) {
  const { tx, profileId } = c,
    cursor = decodeSocialCursor(options.cursor),
    tab = options.tab ?? "latest",
    sports = Array.isArray(c.who.profile.sports)
      ? (c.who.profile.sports as string[])
      : [];
  const rows =
    await tx`select p.* from private.social_posts p join private.social_profiles a on a.id=p.author_id
   where private.social_post_visible(${profileId},p.id)
   and (${options.author ?? null}::text is null or a.handle=${options.author ?? null})
   and (${options.postId ?? null}::uuid is null or p.id=${options.postId ?? null})
   and (${options.officialTipId ?? null}::uuid is null or p.official_tip_id=${options.officialTipId ?? null})
   and (${options.communityEdgeId ?? null}::uuid is null or p.community_edge_id=${options.communityEdgeId ?? null})
   and (${options.sport ?? null}::text is null or p.sport=${options.sport ?? null})
   and (${search ?? null}::text is null or p.body ilike ${search ? `%${search.replace(/[\\%_]/g, "\\$&")}%` : null})
   and (${!options.saved} or exists(select 1 from private.social_saved s where s.profile_id=${profileId} and s.post_id=p.id))
   and (${tab !== "following"} or a.is_official or exists(select 1 from private.social_follows f where f.actor_id=${profileId} and f.target_id=p.author_id))
   and (${tab !== "for_you"} or a.is_official or a.id=${profileId} or p.sport=any(${sports}::text[]) or exists(select 1 from private.social_follows f where f.actor_id=${profileId} and f.target_id=p.author_id) or (${sports.length === 0} and not exists(select 1 from private.social_follows f where f.actor_id=${profileId})))
   and (${!!options.author || !!options.postId} or not exists(select 1 from private.social_mutes m where m.actor_id=${profileId} and m.target_id=p.author_id))
   and (${cursor?.createdAt ?? null}::timestamptz is null or (p.created_at,p.id)<(${cursor?.createdAt ?? null}::timestamptz,${cursor?.id ?? null}::uuid))
   order by p.created_at desc,p.id desc limit 21`;
  const page = rows.slice(0, 20),
    last = page.at(-1);
  return {
    posts: await projectPosts(tx, page, profileId),
    nextCursor:
      rows.length > 20 && last
        ? encodeSocialCursor(iso(last.created_at), String(last.id))
        : null,
  };
}
export async function communityFeed(
  options: CommunityFeedOptions = {},
): Promise<CommunityFeed> {
  return readCommunity(
    "community_social",
    {
      posts: [] as SocialPost[],
      profiles: [] as SocialProfile[],
      nextCursor: null as string | null,
    },
    async (c) => {
      const result = await selectPosts(c, options);
      const found =
        await c.tx`select id from private.social_profiles where private.social_profile_visible(${c.profileId},id,false) and id is distinct from ${c.profileId} order by is_official desc,joined_at desc,id limit 8`;
      return {
        ...result,
        profiles: await profiles(
          c.tx,
          found.map((r) => String(r.id)),
          c.profileId,
        ),
      };
    },
  );
}
export async function communityPost(id: string): Promise<CommunityFeed> {
  return communityFeed({ postId: z.string().uuid().parse(id) });
}
export async function communityProfile(
  handle?: string,
  options: { cursor?: string; saved?: boolean } = {},
): Promise<CommunityProfile> {
  return readCommunity(
    "public_profiles",
    {
      profile: null as SocialProfile | null,
      posts: [] as SocialPost[],
      nextCursor: null as string | null,
    },
    async (c) => {
      const target = handle
        ? await c.tx`select id from private.social_profiles where handle=${handle} and private.social_profile_visible(${c.profileId},id,true)`
        : c.profileId
          ? [{ id: c.profileId }]
          : [];
      if (!target.length) return { profile: null, posts: [], nextCursor: null };
      const profile = (
        await profiles(c.tx, [String(target[0].id)], c.profileId)
      )[0];
      if (options.saved && !profile.isOwn)
        return { profile, posts: [], nextCursor: null };
      return {
        profile,
        ...(await selectPosts(c, {
          author: options.saved ? undefined : profile.handle,
          cursor: options.cursor,
          saved: options.saved,
        })),
      };
    },
  );
}
export async function communitySearch(query: string): Promise<CommunitySearch> {
  return readCommunity(
    "community_social",
    { profiles: [] as SocialProfile[], posts: [] as SocialPost[] },
    async (c) => {
      const q = query.trim().slice(0, 100);
      if (q.length < 2) return { profiles: [], posts: [] };
      const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
      const rows =
        await c.tx`select id from private.social_profiles where private.social_profile_visible(${c.profileId},id,false) and (handle ilike ${pattern} or display_name ilike ${pattern}) order by is_official desc,handle limit 20`;
      return {
        profiles: await profiles(
          c.tx,
          rows.map((r) => String(r.id)),
          c.profileId,
        ),
        posts: (await selectPosts(c, {}, q)).posts,
      };
    },
  );
}
const preferences = (r: Row): NotificationPreferences => ({
  officialEdges: r.official_edges === true,
  followedMembers: r.followed_members === true,
  social: r.social === true,
  leaderboard: r.leaderboard === true,
  competitions: r.competitions === true,
  dealsMarketing: r.deals_marketing === true,
  inApp: r.in_app === true,
  email: false,
  push: false,
});
export async function communityNotifications(): Promise<CommunityNotifications> {
  return readCommunity(
    "community_social",
    {
      items: [] as CommunityNotifications["items"],
      unread: 0,
      preferences: null as NotificationPreferences | null,
    },
    async (c) => {
      if (!c.profileId) return { items: [], unread: 0, preferences: null };
      const rows =
        await c.tx`select n.id,n.type,n.title,n.href,n.created_at,n.read_at,n.group_key from private.social_notifications n where n.recipient_id=${c.profileId} and n.expires_at>now() and (n.type<>'leaderboard' or private.community_feature_allowed(${c.who.user.id},'leaderboards')) and (n.actor_id is null or private.social_profile_visible(${c.profileId},n.actor_id,false)) and (n.post_id is null or private.social_post_visible(${c.profileId},n.post_id)) order by created_at desc,id desc limit 50`;
      const unread =
        await c.tx`select count(*)::int as count from private.social_notifications n where n.recipient_id=${c.profileId} and n.read_at is null and n.expires_at>now() and (n.type<>'leaderboard' or private.community_feature_allowed(${c.who.user.id},'leaderboards')) and (n.actor_id is null or private.social_profile_visible(${c.profileId},n.actor_id,false)) and (n.post_id is null or private.social_post_visible(${c.profileId},n.post_id))`;
      const pref =
        await c.tx`select * from private.social_notification_preferences where profile_id=${c.profileId}`;
      return {
        items: rows.map((r) => ({
          id: String(r.id),
          type: String(r.type),
          title: String(r.title),
          href: String(r.href),
          createdAt: iso(r.created_at),
          readAt: r.read_at ? iso(r.read_at) : null,
          groupKey: String(r.group_key),
        })),
        unread: Number(unread[0].count),
        preferences: pref[0] ? preferences(pref[0]) : null,
      };
    },
  );
}

/** In-app only; callers use the same transaction as the originating mutation. */
export async function enqueueCommunityNotification(
  tx: CommunityTransaction,
  input: {
    recipientId: string;
    actorId?: string;
    type: string;
    postId?: string;
    title: string;
    href: string;
    dedupeKey: string;
    groupKey?: string;
  },
) {
  const category =
    input.type === "official_edge" || input.type === "edge_status"
      ? "official_edges"
      : input.type.startsWith("followed_")
        ? "followed_members"
        : input.type === "leaderboard"
          ? "leaderboard"
          : ["competition", "prize"].includes(input.type)
            ? "competitions"
            : input.type === "deal"
              ? "deals_marketing"
              : "social";
  const target =
    await tx`select p.id,p.user_id,p.status,a.timezone,pref.*,n.paused,n.quiet_start,n.quiet_end from private.social_profiles p join public.profiles a on a.id=p.user_id join private.social_notification_preferences pref on pref.profile_id=p.id left join public.notification_preferences n on n.user_id=p.user_id where p.id=${input.recipientId} and p.status='active' and a.disabled_at is null for update of p`;
  const r = target[0];
  if (
    !r ||
    !r.in_app ||
    !r[category] ||
    r.paused ||
    input.actorId === input.recipientId
  )
    return;
  const eligibility =
    await tx`select private.community_feature_allowed(${r.user_id},'community_social') and (${input.postId ?? null}::uuid is null or private.community_post_allowed(${r.user_id},${input.postId ?? null})) and (${input.type !== "leaderboard"} or private.community_feature_allowed(${r.user_id},'leaderboards')) as allowed`;
  if (!eligibility[0].allowed) return;
  if (
    input.postId &&
    !(
      await tx`select 1 from private.social_posts p where p.id=${input.postId} and private.social_profile_visible(${input.recipientId},p.author_id,false) and p.deleted_at is null and p.moderation_status='visible'`
    ).length
  )
    return;
  if (input.actorId) {
    const allowed =
      await tx`select private.social_profile_visible(${input.recipientId},${input.actorId},false) and not exists(select 1 from private.social_mutes where actor_id=${input.recipientId} and target_id=${input.actorId}) as allowed`;
    if (!allowed[0].allowed) return;
  }
  if (
    input.type === "deal" ||
    input.type === "competition" ||
    input.type === "prize"
  )
    return; // Activation is a separate reviewed future release.
  const hour = Number(
    new Intl.DateTimeFormat("en", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: String(r.timezone),
    }).format(new Date()),
  );
  const start = Number(r.quiet_start ?? 21),
    end = Number(r.quiet_end ?? 8);
  if (
    start !== end &&
    (start < end ? hour >= start && hour < end : hour >= start || hour < end)
  )
    return;
  const cap =
    await tx`select count(*)::int as count from private.social_notifications where recipient_id=${input.recipientId} and created_at>clock_timestamp()-interval '24 hours'`;
  if (Number(cap[0].count) >= 30) return;
  const inserted =
    await tx`insert into private.social_notifications(recipient_id,actor_id,type,post_id,title,href,group_key,dedupe_key) values(${input.recipientId},${input.actorId ?? null},${input.type},${input.postId ?? null},${input.title},${input.href},${input.groupKey ?? input.type},${input.dedupeKey}) on conflict(dedupe_key) do nothing returning id`;
  return inserted.length > 0;
}

/** Internal worker only. Each transaction advances at most 100 recipients of one durable job. */
export async function processCommunityNotifications(
  options: { previewOnly?: boolean } = {},
) {
  if (!process.env.DATABASE_URL) return { processed: 0, queued: 0 };
  const batchSize = options.previewOnly ? 10 : 100;
  return db().begin(async (tx) => {
    await setPreviewCommunityContext(tx);
    const jobs =
      await tx`select j.*,p.author_id,p.official_tip_id,p.community_edge_id,p.created_at post_created_at,p.deleted_at,p.moderation_status from private.social_notification_jobs j join private.social_posts p on p.id=j.post_id join private.social_profiles author on author.id=p.author_id where j.completed_at is null
      and (${!options.previewOnly} or (p.official_tip_id is null and p.community_edge_id is null and p.kind<>'official' and not author.is_official and author.status='active' and private.preview_tester_policy(author.user_id,'community_social') is not null))
      order by j.created_at,j.id limit 1 for update of j skip locked`;
    const job = jobs[0];
    if (!job) return { processed: 0, queued: 0 };
    if (
      job.deleted_at ||
      job.moderation_status !== "visible" ||
      new Date(job.created_at).getTime() < Date.now() - 7 * 86400000
    ) {
      await tx`update private.social_notification_jobs set completed_at=clock_timestamp() where id=${job.id}`;
      return { processed: 0, queued: 0 };
    }
    // An old publication must not be re-announced as a current opportunity.
    if (
      job.official_tip_id &&
      job.kind === "publication" &&
      new Date(job.post_created_at).getTime() < Date.now() - 180000
    ) {
      await tx`update private.social_notification_jobs set completed_at=clock_timestamp() where id=${job.id}`;
      return { processed: 0, queued: 0 };
    }
    const recipients =
      await tx`select p.id from private.social_profiles p join private.social_notification_preferences n on n.profile_id=p.id where p.status='active' and p.user_id is not null and p.id<>${job.author_id} and n.in_app and n.updated_at<=${job.created_at}
      and (${job.official_tip_id !== null} and n.official_edges or ${job.official_tip_id === null} and n.followed_members and exists(select 1 from private.social_follows f where f.actor_id=p.id and f.target_id=${job.author_id} and f.notifications and f.created_at<=${job.created_at}))
      and (${!options.previewOnly} or private.preview_tester_policy(p.user_id,'community_social') is not null)
      and (${job.cursor_profile_id ?? null}::uuid is null or p.id>${job.cursor_profile_id ?? null}::uuid) order by p.id limit ${batchSize + 1}`;
    const page = recipients.slice(0, batchSize);
    let queued = 0;
    for (const recipient of page) {
      const official = job.official_tip_id !== null;
      const inserted = await enqueueCommunityNotification(tx, {
        recipientId: String(recipient.id),
        actorId: String(job.author_id),
        postId: String(job.post_id),
        type: official
          ? job.kind === "status"
            ? "edge_status"
            : "official_edge"
          : job.community_edge_id
            ? "followed_edge"
            : "followed_post",
        title:
          job.kind === "status"
            ? "An Edge record has a new status or settlement."
            : official
              ? "Docked published an official Edge record. Check its current status."
              : job.community_edge_id
                ? "A member you follow recorded an Edge."
                : "A member you follow shared a post.",
        href: `/community/posts/${job.post_id}`,
        dedupeKey: `${job.dedupe_key}:${recipient.id}`,
        groupKey: job.kind === "status" ? "edge_status" : "followed_posts",
      });
      if (inserted) queued++;
    }
    await tx`update private.social_notification_jobs set cursor_profile_id=${page.at(-1)?.id ?? job.cursor_profile_id ?? null},completed_at=case when ${recipients.length <= batchSize} then clock_timestamp() else null end where id=${job.id}`;
    return { processed: page.length, queued };
  });
}

/** No ledger records are removed. Run from the protected worker, never a public request. */
export async function purgeCommunityRetention() {
  if (!process.env.DATABASE_URL) return;
  await db().begin(async (tx) => {
    await tx`update private.social_media set content=null,alt='Expired unapproved upload',status='rejected' where status='quarantine' and expires_at<=clock_timestamp() and content is not null`;
    await tx`delete from private.social_notifications where expires_at<=clock_timestamp()`;
    await tx`delete from private.social_notification_jobs where completed_at<clock_timestamp()-interval '90 days'`;
  });
}

export async function communityModeration(): Promise<CommunityModeration> {
  if (!process.env.DATABASE_URL)
    return {
      status: "not_configured",
      message: "Community moderation requires the dedicated preview database.",
      reports: [],
      media: [],
    };
  try {
    await requireRole(["owner", "admin", "editor", "auditor"]);
    const tx = db();
    const [reports, media] = await Promise.all([
      tx`select id,target_type,target_id,reason,details,status,created_at from private.social_reports order by case when status='open' then 0 else 1 end,created_at desc limit 100`,
      tx`select id,alt,width,height,status from private.social_media where status='quarantine' and content is not null and expires_at>now() order by created_at limit 50`,
    ]);
    return {
      status: "ready",
      message: "",
      reports: reports.map((r) => ({
        id: String(r.id),
        targetType: String(r.target_type),
        targetId: String(r.target_id),
        reason: String(r.reason),
        details: String(r.details),
        status: String(r.status),
        createdAt: iso(r.created_at),
      })),
      media: media.map((r) => toMedia(r, true)),
    };
  } catch {
    return {
      status: "restricted",
      message: "A permitted staff role and MFA are required.",
      reports: [],
      media: [],
    };
  }
}

export async function ownCommunityMedia() {
  return readCommunity(
    "community_social",
    { media: [] as SocialMedia[] },
    async (c) => ({
      media: c.profileId
        ? (
            await c.tx`select id,alt,width,height,status from private.social_media where owner_id=${c.profileId} and content is not null order by created_at desc limit 30`
          ).map((r) => toMedia(r))
        : [],
    }),
  );
}
export async function communityMedia(id: string) {
  z.string().uuid().parse(id);
  const who = await requireIdentity();
  return db().begin(async (tx) => {
    await setCommunityClaims(tx, who);
    // Identity already verifies email, enabled account and the live Auth session.
    const roles =
      await tx`select role from private.roles where user_id=${who.user.id}`;
    const staff = canReviewCommunityMedia(
      who.aal,
      roles.map((row) => String(row.role)),
    );
    if (!staff)
      await tx`select private.community_assert_access(${who.user.id},'community_social')`;
    const own =
      await tx`select id,status from private.social_profiles where user_id=${who.user.id}`;
    if (
      !staff &&
      own[0] &&
      ["suspended", "deleted"].includes(String(own[0].status))
    )
      throw new Error("Community access restricted");
    const viewer = own[0]?.id ?? null;
    const rows =
      await tx`select m.content,m.mime from private.social_media m where m.id=${id} and m.content is not null and (${staff} or (m.status='approved' and private.social_profile_visible(${viewer},m.owner_id,false) and (m.owner_id=${viewer} or exists(select 1 from private.social_post_media l where l.media_id=m.id and private.social_post_visible(${viewer},l.post_id)) or exists(select 1 from private.social_profiles p where p.avatar_media_id=m.id and private.social_profile_visible(${viewer},p.id,false)))))`;
    if (!rows.length) throw new Error("Media unavailable");
    return { content: rows[0].content as Buffer, mime: "image/webp" };
  });
}

export async function uploadCommunityMedia(file: File, alt: string) {
  const authenticated = await requireIdentity();
  await requireCommunityAccess("community_social");
  if (!(await rateLimit(`social:media:${authenticated.user.id}`, 8, 3600)))
    throw new Error("Media upload limit");
  if (
    file.size === 0 ||
    file.size > communityImageMaxBytes ||
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    !alt.trim() ||
    alt.length > 240 ||
    !safeSocialText(alt)
  )
    throw new Error(
      "JPEG, PNG or WebP up to 4 MB and useful alt text required",
    );
  const input = Buffer.from(await file.arrayBuffer());
  const encoded = await encodeCommunityImage(input);
  return withCommunityActor(
    "community_social",
    true,
    async (tx, who, profileId) => {
      const rows =
        await tx`insert into private.social_media(owner_id,content,sha256,mime,width,height,alt) values(${profileId},${encoded.data},${createHash("sha256").update(encoded.data).digest("hex")},'image/webp',${encoded.info.width},${encoded.info.height},${alt.trim()}) on conflict(owner_id,sha256) do update set alt=private.social_media.alt returning id,alt,width,height,status`;
      if (rows[0].status === "rejected")
        throw new Error(
          "This image was rejected or expired; upload a different image for review.",
        );
      return {
        ok: true,
        media: toMedia(rows[0]),
        message:
          rows[0].status === "approved"
            ? "Previously approved image is available. A screenshot never verifies odds or results."
            : "Image stored in private quarantine for moderation. A screenshot never verifies odds or results.",
      };
    },
  );
}

export async function exportCommunityData(userId: string) {
  const sql = db();
  const own =
    await sql`select id,handle,display_name,bio,visibility,status,joined_at from private.social_profiles where user_id=${userId}`;
  if (!own.length) return null;
  const id = String(own[0].id);
  const [
    posts,
    comments,
    follows,
    blocks,
    mutes,
    saved,
    notificationSettings,
    notifications,
    media,
    personalEdgeNotes,
  ] = await Promise.all([
    sql`select id,kind,body,sport,official_tip_id,community_edge_id,claim_label,moderation_status,created_at,deleted_at from private.social_posts where author_id=${id}`,
    sql`select id,post_id,parent_id,body,moderation_status,created_at,deleted_at from private.social_comments where author_id=${id}`,
    sql`select target_id,notifications,created_at from private.social_follows where actor_id=${id}`,
    sql`select target_id,created_at from private.social_blocks where actor_id=${id}`,
    sql`select target_id,created_at from private.social_mutes where actor_id=${id}`,
    sql`select post_id,created_at from private.social_saved where profile_id=${id}`,
    sql`select * from private.social_notification_preferences where profile_id=${id}`,
    sql`select id,type,title,href,created_at,read_at from private.social_notifications where recipient_id=${id}`,
    sql`select id,sha256,width,height,alt,status,created_at from private.social_media where owner_id=${id}`,
    sql`select n.edge_id,n.metadata,n.created_at from private.community_edge_personal_notes n join private.community_edges e on e.id=n.edge_id where e.profile_id=${id}`,
  ]);
  return {
    profile: own[0],
    posts,
    comments,
    follows,
    blocks,
    mutes,
    saved,
    notificationSettings,
    notifications,
    media,
    personalEdgeNotes,
  };
}

async function audit(
  tx: CommunityTransaction,
  actor: string,
  action: string,
  subject: string,
) {
  await tx`insert into private.audit_events(actor,action,subject) values(${actor},${action},${subject})`;
}
async function staffInTransaction(
  tx: CommunityTransaction,
  who: CommunityActor,
) {
  if (
    who.aal !== "aal2" ||
    !(
      await tx`select 1 from private.roles where user_id=${who.user.id} and role in ('owner','admin','editor')`
    ).length
  )
    throw new Error("Staff role and MFA required");
}
async function accessiblePost(
  tx: CommunityTransaction,
  viewer: string,
  id: string,
) {
  const rows =
    await tx`select p.* from private.social_posts p where p.id=${id} and private.social_post_visible(${viewer},p.id) for update`;
  if (!rows.length) throw new Error("Post unavailable");
  return rows[0];
}
export async function mutateCommunity(input: unknown) {
  const action = socialActionSchema.parse(input),
    who = await requireIdentity();
  if (
    !(await rateLimit(
      `social:${action.action}:${who.user.id}`,
      action.action === "post"
        ? 6
        : action.action === "report"
          ? 8
          : action.action === "profile"
            ? 3
            : 30,
      action.action === "profile" ? 86400 : 60,
    ))
  )
    throw new Error("Action rate limit");
  if (action.action === "profile") {
    await requireCommunityAccess("public_profiles");
    return db().begin(async (tx) => {
      await setCommunityClaims(tx, who);
      await tx`select private.community_assert_access(${who.user.id},'public_profiles')`;
      await tx`select id from public.profiles where id=${who.user.id} for update`;
      const existing =
        await tx`select id,status,avatar_media_id from private.social_profiles where user_id=${who.user.id} for update`;
      if (
        existing[0] &&
        ["suspended", "deleted"].includes(String(existing[0].status))
      )
        throw new Error("Profile restricted");
      const avatar =
        action.avatarMediaId === undefined
          ? (existing[0]?.avatar_media_id ?? null)
          : action.avatarMediaId;
      if (
        avatar &&
        (!existing[0] ||
          !(
            await tx`select 1 from private.social_media where id=${avatar} and owner_id=${existing[0].id} and status='approved' and content is not null`
          ).length)
      )
        throw new Error("Approved owned avatar required");
      const rows =
        await tx`insert into private.social_profiles(user_id,handle,display_name,bio,visibility,avatar_media_id) values(${who.user.id},${action.handle},${action.displayName},${action.bio},${action.visibility},${avatar}) on conflict(user_id) do update set handle=excluded.handle,display_name=excluded.display_name,bio=excluded.bio,visibility=excluded.visibility,avatar_media_id=excluded.avatar_media_id,updated_at=clock_timestamp() returning id`;
      await tx`insert into private.social_notification_preferences(profile_id) values(${rows[0].id}) on conflict do nothing`;
      await audit(tx, who.user.id, "social_profile_saved", String(rows[0].id));
      return {
        ok: true,
        message: "Profile saved.",
        redirect: `/profile/${action.handle}`,
      };
    });
  }
  const result = await withCommunityActor(
    "community_social",
    ![
      "save",
      "report",
      "block",
      "mute",
      "delete_post",
      "delete_comment",
      "moderate",
    ].includes(action.action),
    async (tx, actor, profileId) => {
      if (action.action === "post") {
        let authorId = profileId;
        if (action.kind === "official") {
          await staffInTransaction(tx, actor);
          authorId = OFFICIAL_PROFILE_ID;
        }
        if (
          action.sport &&
          !(await tx`select id from private.sports where id=${action.sport}`)
            .length
        )
          throw new Error("Unknown sport");
        const duplicate =
          await tx`select id,body,kind,sport,claim_label from private.social_posts where author_id=${authorId} and idempotency_key=${action.idempotencyKey}`;
        if (duplicate[0]) {
          const media =
            await tx`select media_id from private.social_post_media where post_id=${duplicate[0].id} order by position`;
          if (
            duplicate[0].body !== action.body ||
            duplicate[0].kind !== action.kind ||
            duplicate[0].sport !== (action.sport || null) ||
            JSON.stringify(media.map((m) => String(m.media_id))) !==
              JSON.stringify(action.mediaIds) ||
            duplicate[0].claim_label !==
              (action.promotional ? "promotional_price" : "social_only")
          )
            throw new Error("Idempotency conflict");
          return {
            ok: true,
            message: "Post already saved.",
            id: String(duplicate[0].id),
          };
        }
        if (
          (
            await tx`select 1 from private.social_posts where author_id=${authorId} and body=${action.body} and created_at>clock_timestamp()-interval '10 minutes'`
          ).length
        )
          throw new Error("Duplicate recent post");
        const rows =
          await tx`insert into private.social_posts(author_id,kind,body,sport,claim_label,idempotency_key) values(${authorId},${action.kind},${action.body},${action.sport || null},${action.promotional ? "promotional_price" : "social_only"},${action.idempotencyKey}) returning id`;
        const id = String(rows[0].id);
        for (const [position, mediaId] of action.mediaIds.entries())
          await tx`insert into private.social_post_media(post_id,media_id,position) values(${id},${mediaId},${position})`;
        await audit(tx, actor.user.id, "social_post_created", id);
        // The insert trigger queues bounded, durable fanout in the same transaction.
        return {
          ok: true,
          message:
            "Social post published. It does not enter verified performance.",
          id,
          redirect: `/community/posts/${id}`,
        };
      }
      if (action.action === "comment") {
        const post = await accessiblePost(tx, profileId, action.postId);
        if (post.deleted_at || post.moderation_status !== "visible")
          throw new Error("Discussion closed for removed commentary");
        const existing =
          await tx`select id,body,post_id,parent_id from private.social_comments where author_id=${profileId} and idempotency_key=${action.idempotencyKey}`;
        if (existing[0]) {
          if (
            existing[0].body !== action.body ||
            existing[0].post_id !== action.postId ||
            existing[0].parent_id !== (action.parentId ?? null)
          )
            throw new Error("Idempotency conflict");
          return {
            ok: true,
            message: "Comment already saved.",
            id: String(existing[0].id),
          };
        }
        const parent = action.parentId
          ? await tx`select author_id from private.social_comments where id=${action.parentId} and post_id=${action.postId} and deleted_at is null and moderation_status='visible' and private.social_profile_visible(${profileId},author_id,false)`
          : [];
        if (action.parentId && !parent.length)
          throw new Error("Reply target unavailable");
        if (
          (
            await tx`select 1 from private.social_comments where author_id=${profileId} and body=${action.body} and created_at>clock_timestamp()-interval '5 minutes'`
          ).length
        )
          throw new Error("Duplicate recent comment");
        const rows =
          await tx`insert into private.social_comments(post_id,author_id,parent_id,body,idempotency_key) values(${action.postId},${profileId},${action.parentId ?? null},${action.body},${action.idempotencyKey}) returning id`;
        const id = String(rows[0].id);
        await audit(tx, actor.user.id, "social_comment_created", id);
        for (const recipientId of new Set([
          String(post.author_id),
          ...parent.map((p) => String(p.author_id)),
        ]))
          await enqueueCommunityNotification(tx, {
            recipientId,
            actorId: profileId,
            type: parent.length ? "reply" : "comment",
            postId: action.postId,
            title: parent.length
              ? "A member replied in your discussion."
              : "A member commented on your post.",
            href: `/community/posts/${action.postId}`,
            dedupeKey: `comment:${id}:${recipientId}`,
          });
        return { ok: true, message: "Comment saved.", id };
      }
      if (action.action === "react" || action.action === "save") {
        const post = await accessiblePost(tx, profileId, action.postId);
        if (action.action === "react") {
          if (action.enabled) {
            const rows =
              await tx`insert into private.social_reactions(profile_id,post_id) values(${profileId},${action.postId}) on conflict do nothing returning post_id`;
            if (rows.length)
              await enqueueCommunityNotification(tx, {
                recipientId: String(post.author_id),
                actorId: profileId,
                type: "reaction",
                postId: action.postId,
                title: "A member reacted to your post.",
                href: `/community/posts/${action.postId}`,
                dedupeKey: `reaction:${profileId}:${action.postId}`,
              });
          } else
            await tx`delete from private.social_reactions where profile_id=${profileId} and post_id=${action.postId}`;
        } else if (action.enabled)
          await tx`insert into private.social_saved(profile_id,post_id) values(${profileId},${action.postId}) on conflict do nothing`;
        else
          await tx`delete from private.social_saved where profile_id=${profileId} and post_id=${action.postId}`;
        return {
          ok: true,
          message:
            action.action === "save"
              ? action.enabled
                ? "Post saved."
                : "Post removed from saved."
              : action.enabled
                ? "Reaction added."
                : "Reaction removed.",
        };
      }
      if (
        action.action === "follow" ||
        action.action === "block" ||
        action.action === "mute"
      ) {
        if (action.profileId === profileId)
          throw new Error("Choose another profile");
        const target =
          await tx`select id,status from private.social_profiles where id=${action.profileId}`;
        if (!target.length) throw new Error("Profile unavailable");
        if (action.action === "follow") {
          if (action.enabled) {
            if (
              !(
                await tx`select 1 where private.social_profile_visible(${profileId},${action.profileId},false)`
              ).length ||
              target[0].status !== "active"
            )
              throw new Error("Profile unavailable");
            const rows =
              await tx`insert into private.social_follows(actor_id,target_id,notifications) values(${profileId},${action.profileId},${action.notifications ?? false}) on conflict(actor_id,target_id) do update set notifications=case when ${action.notifications !== undefined} then excluded.notifications else private.social_follows.notifications end returning (xmax=0) created`;
            if (rows[0]?.created)
              await enqueueCommunityNotification(tx, {
                recipientId: action.profileId,
                actorId: profileId,
                type: "follower",
                title: "A member started following you.",
                href: "/profile",
                dedupeKey: `follow:${profileId}:${action.profileId}`,
              });
          } else
            await tx`delete from private.social_follows where actor_id=${profileId} and target_id=${action.profileId}`;
        } else if (action.action === "mute") {
          if (action.enabled)
            await tx`insert into private.social_mutes(actor_id,target_id) values(${profileId},${action.profileId}) on conflict do nothing`;
          else
            await tx`delete from private.social_mutes where actor_id=${profileId} and target_id=${action.profileId}`;
        } else {
          if (action.enabled) {
            await tx`insert into private.social_blocks(actor_id,target_id) values(${profileId},${action.profileId}) on conflict do nothing`;
            await tx`delete from private.social_follows where (actor_id=${profileId} and target_id=${action.profileId}) or (actor_id=${action.profileId} and target_id=${profileId})`;
            await tx`delete from private.social_notifications where (recipient_id=${profileId} and actor_id=${action.profileId}) or (recipient_id=${action.profileId} and actor_id=${profileId})`;
          } else
            await tx`delete from private.social_blocks where actor_id=${profileId} and target_id=${action.profileId}`;
        }
        await audit(
          tx,
          actor.user.id,
          `social_${action.action}_${action.enabled ? "enabled" : "disabled"}`,
          action.profileId,
        );
        return { ok: true, message: "Relationship preference saved." };
      }
      if (action.action === "delete_post") {
        const rows =
          await tx`update private.social_posts set body='',moderation_status='removed',deleted_at=coalesce(deleted_at,clock_timestamp()),updated_at=clock_timestamp() where id=${action.postId} and author_id=${profileId} returning id`;
        if (!rows.length) throw new Error("Post unavailable");
        await tx`delete from private.social_post_media where post_id=${action.postId}`;
        await audit(tx, actor.user.id, "social_post_tombstoned", action.postId);
        return {
          ok: true,
          message:
            "Social commentary removed. Any permanent Edge record remains unchanged.",
        };
      }
      if (action.action === "delete_comment") {
        const rows =
          await tx`update private.social_comments set body='',moderation_status='removed',deleted_at=coalesce(deleted_at,clock_timestamp()) where id=${action.commentId} and author_id=${profileId} returning id`;
        if (!rows.length) throw new Error("Comment unavailable");
        await audit(
          tx,
          actor.user.id,
          "social_comment_removed",
          action.commentId,
        );
        return { ok: true, message: "Comment removed." };
      }
      if (action.action === "report") {
        const targetType = action.postId
            ? "post"
            : action.commentId
              ? "comment"
              : "profile",
          targetId = (action.postId ?? action.commentId ?? action.profileId)!;
        if (targetType === "post")
          await accessiblePost(tx, profileId, targetId);
        if (
          targetType === "comment" &&
          !(
            await tx`select 1 from private.social_comments c where c.id=${targetId} and private.social_post_visible(${profileId},c.post_id)`
          ).length
        )
          throw new Error("Comment unavailable");
        if (
          targetType === "profile" &&
          !(
            await tx`select 1 from private.social_profiles where id=${targetId}`
          ).length
        )
          throw new Error("Profile unavailable");
        await tx`insert into private.social_reports(reporter_id,target_type,target_id,reason,details) values(${profileId},${targetType},${targetId},${action.reason},${action.details}) on conflict(reporter_id,target_type,target_id) do nothing`;
        await audit(tx, actor.user.id, "social_report_submitted", targetId);
        return {
          ok: true,
          message:
            "Report received for review. Reporter details remain private.",
        };
      }
      if (action.action === "moderate") {
        await staffInTransaction(tx, actor);
        if (
          action.reportId &&
          !(
            await tx`select 1 from private.social_reports where id=${action.reportId} and target_id=${action.targetId} and target_type=${action.targetType} for update`
          ).length
        )
          throw new Error("Report target mismatch");
        const allowed = {
          post: ["remove", "dismiss", "warn", "escalate"],
          comment: ["remove", "dismiss", "warn", "escalate"],
          profile: [
            "warn",
            "restrict",
            "suspend",
            "restore",
            "dismiss",
            "escalate",
          ],
          media: ["approve", "reject", "dismiss", "escalate"],
        }[action.targetType];
        if (!allowed.includes(action.decision))
          throw new Error("Invalid moderation action");
        if (action.targetType === "profile") {
          if (action.targetId === OFFICIAL_PROFILE_ID)
            throw new Error("Official identity protected");
          const rows =
            await tx`select status from private.social_profiles where id=${action.targetId} for update`;
          if (!rows.length || rows[0].status === "deleted")
            throw new Error("Profile unavailable");
          if (["restrict", "suspend", "restore"].includes(action.decision))
            await tx`update private.social_profiles set status=${action.decision === "restore" ? "active" : action.decision === "restrict" ? "restricted" : "suspended"} where id=${action.targetId}`;
        }
        if (action.targetType === "post" && action.decision === "remove") {
          const r =
            await tx`update private.social_posts set body='',moderation_status='removed',updated_at=clock_timestamp() where id=${action.targetId} returning id`;
          if (!r.length) throw new Error("Post unavailable");
          await tx`delete from private.social_post_media where post_id=${action.targetId}`;
        }
        if (action.targetType === "comment" && action.decision === "remove") {
          const r =
            await tx`update private.social_comments set body='',moderation_status='removed' where id=${action.targetId} returning id`;
          if (!r.length) throw new Error("Comment unavailable");
        }
        if (
          action.targetType === "media" &&
          ["approve", "reject"].includes(action.decision)
        ) {
          const r =
            await tx`update private.social_media set status=${action.decision === "approve" ? "approved" : "rejected"},content=case when ${action.decision === "reject"} then null else content end,reviewed_by=${actor.user.id},reviewed_at=clock_timestamp() where id=${action.targetId} and content is not null and expires_at>clock_timestamp() returning id`;
          if (!r.length) throw new Error("Media unavailable");
        }
        await tx`insert into private.social_moderation_events(actor,report_id,target_type,target_id,decision,reason) values(${actor.user.id},${action.reportId ?? null},${action.targetType},${action.targetId},${action.decision},${action.reason})`;
        if (action.reportId)
          await tx`update private.social_reports set status=${action.decision === "dismiss" ? "dismissed" : action.decision === "escalate" ? "escalated" : "actioned"},closed_at=clock_timestamp() where id=${action.reportId}`;
        await audit(tx, actor.user.id, "social_moderation", action.targetId);
        return {
          ok: true,
          message: "Moderation recorded. Permanent Edge evidence is unchanged.",
        };
      }
      throw new Error("Unsupported action");
    },
  );
  const analytics =
    action.action === "post"
      ? "post_created"
      : action.action === "comment"
        ? "comment_created"
        : action.action === "react" && action.enabled
          ? "reaction_added"
          : action.action === "follow"
            ? action.enabled
              ? "member_followed"
              : "member_unfollowed"
            : null;
  if (analytics) await recordAnalytics(who.user.id, analytics).catch(() => {});
  return result;
}

export async function mutateCommunityNotifications(input: unknown) {
  const action = notificationActionSchema.parse(input);
  return withCommunityActor(
    "community_social",
    false,
    async (tx, who, profileId) => {
      if (!(await rateLimit(`social:notifications:${who.user.id}`, 30)))
        throw new Error("Action rate limit");
      if (action.action === "read") {
        await tx`update private.social_notifications set read_at=coalesce(read_at,clock_timestamp()) where recipient_id=${profileId} and (${action.id ?? null}::uuid is null or id=${action.id ?? null})`;
        return { ok: true, message: "Notifications marked read." };
      }
      if (action.dealsMarketing)
        await tx`select private.community_assert_access(${who.user.id},'marketing')`;
      await tx`insert into private.social_notification_preferences(profile_id,official_edges,followed_members,social,leaderboard,competitions,deals_marketing,in_app) values(${profileId},${action.officialEdges},${action.followedMembers},${action.social},${action.leaderboard},${action.competitions},${action.dealsMarketing},${action.inApp}) on conflict(profile_id) do update set official_edges=excluded.official_edges,followed_members=excluded.followed_members,social=excluded.social,leaderboard=excluded.leaderboard,competitions=excluded.competitions,deals_marketing=excluded.deals_marketing,in_app=excluded.in_app,email=false,push=false,updated_at=clock_timestamp()`;
      await tx`insert into private.consent_events(user_id,purpose,granted,version,actor) values(${who.user.id},'community_marketing',${action.dealsMarketing},'phase3-2026-10',${who.user.id})`;
      await audit(
        tx,
        who.user.id,
        "social_notification_preferences",
        profileId,
      );
      return {
        ok: true,
        message:
          "In-app preferences saved. External email and push remain disabled.",
      };
    },
  );
}
