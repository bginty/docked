import { z } from "zod";

export const OFFICIAL_PROFILE_ID = "00000000-0000-4000-8000-000000000001";
/** Privileged case review is separate from public community-region activation. */
export function canReviewCommunityMedia(aal: string, databaseRoles: string[]) {
  return (
    aal === "aal2" &&
    databaseRoles.some((role) =>
      ["owner", "admin", "editor", "auditor"].includes(role),
    )
  );
}
export type CommunityStatus =
  | "ready"
  | "not_configured"
  | "sign_in_required"
  | "restricted"
  | "unavailable";
export type SocialProfile = {
  id: string;
  handle: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  isOfficial: boolean;
  visibility: "members" | "private";
  status: "active" | "restricted" | "suspended" | "deleted";
  joinedAt: string;
  followers: number;
  following: number;
  isFollowing: boolean;
  followNotifications?: boolean;
  isMuted: boolean;
  isBlocked: boolean;
  isOwn: boolean;
};
export type SocialMedia = {
  id: string;
  url: string | null;
  alt: string;
  width: number;
  height: number;
  status: "quarantine" | "approved" | "rejected";
};
export type SocialComment = {
  id: string;
  postId: string;
  parentId: string | null;
  author: SocialProfile;
  body: string;
  createdAt: string;
  moderationStatus: "visible" | "removed" | "review";
};
export type SocialPost = {
  id: string;
  author: SocialProfile;
  kind:
    | "discussion"
    | "analysis"
    | "question"
    | "celebration"
    | "edge"
    | "official";
  body: string;
  sport: string | null;
  createdAt: string;
  moderationStatus: "visible" | "removed" | "review";
  claimLabel: "social_only" | "promotional_price";
  officialTipId: string | null;
  communityEdgeId: string | null;
  media: SocialMedia[];
  reactionCount: number;
  commentCount: number;
  isReacted: boolean;
  isSaved: boolean;
  comments: SocialComment[];
};
export type SocialNotification = {
  id: string;
  type: string;
  title: string;
  href: string;
  createdAt: string;
  readAt: string | null;
  groupKey: string;
};
export type NotificationPreferences = {
  researchUpdates?: boolean;
  lineupUpdates?: boolean;
  teamUpdates?: boolean;
  officialEdges: boolean;
  followedMembers: boolean;
  social: boolean;
  leaderboard: boolean;
  competitions: boolean;
  dealsMarketing: boolean;
  inApp: boolean;
  email: boolean;
  push: boolean;
};
export type SocialReport = {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  details: string;
  status: string;
  createdAt: string;
};
export type CommunityBase = {
  status: CommunityStatus;
  message: string;
  viewer: SocialProfile | null;
};
export type CommunityFeed = CommunityBase & {
  posts: SocialPost[];
  profiles: SocialProfile[];
  nextCursor: string | null;
};
export type CommunityProfile = CommunityBase & {
  profile: SocialProfile | null;
  posts: SocialPost[];
  nextCursor: string | null;
};
export type CommunitySearch = CommunityBase & {
  profiles: SocialProfile[];
  posts: SocialPost[];
};
export type CommunityNotifications = CommunityBase & {
  items: SocialNotification[];
  unread: number;
  preferences: NotificationPreferences | null;
};
export type CommunityModeration = {
  status: CommunityStatus;
  message: string;
  reports: SocialReport[];
  media: SocialMedia[];
};
export type CommunityFeedOptions = {
  tab?: "for_you" | "following" | "latest";
  sport?: string;
  cursor?: string;
  author?: string;
  postId?: string;
  officialTipId?: string;
  communityEdgeId?: string;
  saved?: boolean;
};

const forbiddenControls =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/u;
export function safeSocialText(text: string) {
  return !forbiddenControls.test(text);
}
export function protectedIdentity(value: string) {
  const simplified = value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[оο]/gu, "o")
    .replace(/[сϲ]/gu, "c")
    .replace(/[еε]/gu, "e")
    .replace(/ԁ/gu, "d")
    .replace(/κ/gu, "k")
    .replace(
      /[013457]/g,
      (v) =>
        ({ "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t" })[v]!,
    )
    .replace(/[^a-z]/g, "");
  return (
    (/[a-z]/i.test(value) &&
      /[\p{Script=Cyrillic}\p{Script=Greek}]/u.test(value)) ||
    simplified.includes("docked") ||
    /(?:official|administrator|moderator|support|admin)/.test(simplified) ||
    /[✓✔☑✅\u202a-\u202e\u2060-\u206f\u200b-\u200f]/u.test(value)
  );
}
export const socialHandle = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(24)
  .regex(/^[a-z][a-z0-9_]*$/)
  .refine(
    (v) =>
      !protectedIdentity(v) &&
      ![
        "api",
        "settings",
        "deleted",
        "system",
        "help",
        "login",
        "signup",
        "me",
      ].includes(v),
    "Reserved handle",
  );
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine(safeSocialText, "Unsupported control characters");
const uuid = z.string().uuid();
export const socialActionSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("profile"),
      handle: socialHandle,
      displayName: text(60)
        .min(1)
        .refine((v) => !protectedIdentity(v), "Reserved identity"),
      bio: text(280),
      visibility: z.enum(["members", "private"]),
      avatarMediaId: uuid.nullable().optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("post"),
      kind: z.enum([
        "discussion",
        "analysis",
        "question",
        "celebration",
        "official",
      ]),
      body: text(4000).min(1),
      sport: text(60).optional(),
      mediaIds: z.array(uuid).max(4).default([]),
      promotional: z.boolean().default(false),
      idempotencyKey: uuid,
    })
    .strict(),
  z
    .object({
      action: z.literal("comment"),
      postId: uuid,
      parentId: uuid.nullable().optional(),
      body: text(1000).min(1),
      idempotencyKey: uuid,
    })
    .strict(),
  ...(["react", "save"] as const).map((action) =>
    z
      .object({ action: z.literal(action), postId: uuid, enabled: z.boolean() })
      .strict(),
  ),
  z
    .object({
      action: z.literal("follow"),
      profileId: uuid,
      enabled: z.boolean(),
      notifications: z.boolean().optional(),
    })
    .strict(),
  ...(["mute", "block"] as const).map((action) =>
    z
      .object({
        action: z.literal(action),
        profileId: uuid,
        enabled: z.boolean(),
      })
      .strict(),
  ),
  z.object({ action: z.literal("delete_post"), postId: uuid }).strict(),
  z.object({ action: z.literal("delete_comment"), commentId: uuid }).strict(),
  z
    .object({
      action: z.literal("report"),
      postId: uuid.optional(),
      profileId: uuid.optional(),
      commentId: uuid.optional(),
      reason: z.enum([
        "spam",
        "harassment",
        "impersonation",
        "privacy",
        "scam",
        "affiliate_spam",
        "misleading_odds",
        "other",
      ]),
      details: text(1000),
    })
    .strict()
    .refine(
      (v) => [v.postId, v.profileId, v.commentId].filter(Boolean).length === 1,
      "One report target required",
    ),
  z
    .object({
      action: z.literal("moderate"),
      reportId: uuid.optional(),
      targetType: z.enum(["post", "comment", "profile", "media"]),
      targetId: uuid,
      decision: z.enum([
        "dismiss",
        "remove",
        "warn",
        "restrict",
        "suspend",
        "restore",
        "escalate",
        "approve",
        "reject",
      ]),
      reason: text(1000).min(12),
    })
    .strict(),
]);
export const notificationActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("read"), id: uuid.optional() }).strict(),
  z
    .object({
      action: z.literal("preferences"),
      officialEdges: z.boolean(),
      researchUpdates: z.boolean().default(false),
      lineupUpdates: z.boolean().default(false),
      teamUpdates: z.boolean().default(false),
      followedMembers: z.boolean(),
      social: z.boolean(),
      leaderboard: z.boolean(),
      competitions: z.boolean(),
      dealsMarketing: z.boolean(),
      inApp: z.boolean(),
      email: z.literal(false),
      push: z.literal(false),
    })
    .strict(),
]);
export function encodeSocialCursor(createdAt: string, id: string) {
  return `${createdAt}|${id}`;
}
export function decodeSocialCursor(value?: string) {
  if (!value) return null;
  const [createdAt, id, extra] = value.split("|");
  if (
    extra ||
    !z.string().datetime({ offset: true }).safeParse(createdAt).success ||
    !uuid.safeParse(id).success
  )
    throw new Error("Invalid cursor");
  return { createdAt, id };
}

/** Bound the actual streamed bytes, including requests without Content-Length. */
export async function boundedCommunityBody(request: Request, limit: number) {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new Error("Request too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(size);
  let position = 0;
  for (const chunk of chunks) {
    result.set(chunk, position);
    position += chunk.byteLength;
  }
  return result;
}
