import { z } from "zod";

export const analyticsEvents = [
  "landing_view",
  "signup_started",
  "signup_completed",
  "email_verified",
  "onboarding_completed",
  "sport_selected",
  "bookmaker_selected",
  "edge_viewed",
  "tip_saved",
  "methodology_viewed",
  "results_viewed",
  "alert_enabled",
  "alert_disabled",
  "digest_enabled",
  "digest_disabled",
  "article_viewed",
  "share_clicked",
  "feed_viewed",
  "post_started",
  "post_created",
  "community_edge_started",
  "community_edge_submitted",
  "community_edge_rejected",
  "community_price_moved",
  "community_promo_excluded",
  "member_followed",
  "member_unfollowed",
  "reaction_added",
  "comment_created",
  "profile_viewed",
  "leaderboard_viewed",
  "member_discovery_viewed",
  "notifications_viewed",
  "notification_opened",
  "pro_viewed",
  "competition_viewed",
  "deal_viewed",
] as const;
export type AnalyticsEvent = (typeof analyticsEvents)[number];
export const serverAnalyticsEvents: readonly AnalyticsEvent[] = [
  "signup_completed",
  "email_verified",
  "onboarding_completed",
  "tip_saved",
  "alert_enabled",
  "alert_disabled",
  "digest_enabled",
  "digest_disabled",
  "sport_selected",
  "bookmaker_selected",
  "post_created",
  "community_edge_submitted",
  "community_edge_rejected",
  "community_price_moved",
  "community_promo_excluded",
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
  if (path === "/methodology") return "methodology_viewed";
  if (path === "/results") return "results_viewed";
  if (path === "/edges" || path.startsWith("/tips/")) return "edge_viewed";
  if (path.startsWith("/learn/")) return "article_viewed";
  if (path === "/home" || path === "/community") return "feed_viewed";
  if (path === "/compose") return "post_started";
  if (path === "/top-docked") return "leaderboard_viewed";
  if (path === "/profile" || path.startsWith("/profile/"))
    return "profile_viewed";
  if (path === "/search") return "member_discovery_viewed";
  if (path === "/notifications") return "notifications_viewed";
  if (path === "/membership") return "pro_viewed";
  if (path === "/competitions") return "competition_viewed";
  if (path === "/deals") return "deal_viewed";
  return null;
}
