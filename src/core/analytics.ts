import { z } from "zod";

export const analyticsEvents = [
  "landing_view",
  "signup_started",
  "signup_completed",
  "email_verified",
  "onboarding_completed",
  "sport_selected",
  "alert_enabled",
  "alert_disabled",
  "digest_enabled",
  "digest_disabled",
  "share_clicked",
  "feed_viewed",
  "post_started",
  "post_created",
  "member_followed",
  "member_unfollowed",
  "reaction_added",
  "comment_created",
  "profile_viewed",
  "member_discovery_viewed",
  "notifications_viewed",
  "notification_opened",
  "competition_viewed",
] as const;
export type AnalyticsEvent = (typeof analyticsEvents)[number];
export const serverAnalyticsEvents: readonly AnalyticsEvent[] = [
  "signup_completed",
  "email_verified",
  "onboarding_completed",
  "alert_enabled",
  "alert_disabled",
  "digest_enabled",
  "digest_disabled",
  "sport_selected",
  "post_created",
  "member_followed",
  "member_unfollowed",
  "reaction_added",
  "comment_created",
  "notification_opened",
];
export function clientAnalyticsAllowed(event: AnalyticsEvent) {
  return !serverAnalyticsEvents.includes(event);
}
export const analyticsInput = z
  .object({
    event: z.enum(analyticsEvents),
    channel: z.enum(["direct", "search", "referral", "digest"]).optional(),
  })
  .strict();
export function pageEvent(path: string): AnalyticsEvent | null {
  if (path === "/") return "landing_view";
  if (path === "/join") return "signup_started";
  if (["/home", "/community", "/feed", "/fantasy/social"].includes(path))
    return "feed_viewed";
  if (path === "/compose") return "post_started";
  if (path === "/profile" || path.startsWith("/profile/"))
    return "profile_viewed";
  if (path === "/search") return "member_discovery_viewed";
  if (path === "/notifications") return "notifications_viewed";
  if (path === "/competitions") return "competition_viewed";
  return null;
}
