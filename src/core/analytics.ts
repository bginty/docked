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
] as const;
export type AnalyticsEvent = (typeof analyticsEvents)[number];
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
  return null;
}
