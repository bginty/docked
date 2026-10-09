import { DateTime } from "luxon";
import { dispatchDecision, type Preferences } from "./notifications";
import type { NotificationPreferences } from "./community-social";
import { nativeNotificationRoute, nativePushTypes } from "./native-navigation";

export type NativePushEnvelope = {
  version: 1;
  notificationId: string;
  type: (typeof nativePushTypes)[number];
  path: string;
  expiresAt: string;
};
export type NativePushContext = {
  now: string;
  environment: string;
  sendingEnabled: boolean;
  accountActive: boolean;
  deviceRevoked: boolean;
  regionAllowed: boolean;
  contentVisible: boolean;
  actorBlockedOrMuted: boolean;
  followNotifications: boolean;
  consent: boolean;
  preferences: Preferences;
  channels: NotificationPreferences;
  fresh: boolean;
  startAt?: string;
  sentToday: number;
  sentPast24Hours: number;
  globalBudgetRemaining: number;
};
/** Pure dispatch contract. Context must be reloaded server-side under the outbox
 * lease immediately before delivery, never supplied by the browser/device.
 * No adapter is configured: even an otherwise eligible job cannot be sent. */
export function planNativePush(
  envelope: NativePushEnvelope,
  context: NativePushContext,
) {
  const suppress = (reason: string) => ({
    status: "SUPPRESSED" as const,
    reason,
    payload: null,
  });
  const route = nativeNotificationRoute(envelope);
  if (
    envelope.version !== 1 ||
    !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(
      envelope.notificationId,
    ) ||
    !route
  )
    return suppress("invalid_payload");
  if (!context.accountActive || context.deviceRevoked)
    return suppress("account_or_device_revoked");
  if (
    !context.regionAllowed ||
    !context.contentVisible ||
    context.actorBlockedOrMuted
  )
    return suppress("visibility_or_region");
  if (!context.consent || !context.channels.push || context.preferences.paused)
    return suppress("consent_or_pause");
  const type = envelope.type,
    category =
      type === "official_edge" || type === "edge_status"
        ? context.channels.officialEdges
        : type === "followed_member_edge"
          ? context.channels.followedMembers
          : type === "leaderboard"
            ? context.channels.leaderboard
            : context.channels.social;
  if (
    !category ||
    (type === "followed_member_edge" && !context.followNotifications)
  )
    return suppress("category_not_opted_in");
  if (
    !Number.isFinite(context.sentPast24Hours) ||
    context.sentPast24Hours < 0 ||
    !Number.isFinite(context.globalBudgetRemaining)
  )
    return suppress("budget_unknown");
  if (context.sentPast24Hours >= 30) return suppress("social_daily_cap");
  // Official edge rules retain the existing two-per-local-day cap, freshness,
  // ten-minute event cutoff, expiry and quiet-hours policy. Social notices reuse
  // the same pause/region/expiry/budget/quiet gate after their own category check.
  const official = type === "official_edge" || type === "edge_status";
  const local = DateTime.fromISO(context.now, { zone: "utc" }).setZone(
    context.preferences.timezone,
  );
  if (
    !local.isValid ||
    ![context.preferences.quietStart, context.preferences.quietEnd].every(
      (h) => Number.isInteger(h) && h >= 0 && h <= 23,
    )
  )
    return suppress("invalid_timezone_or_quiet_window");
  const decision = dispatchDecision({
    now: context.now,
    environment: context.environment,
    sendingEnabled: context.sendingEnabled,
    consent: context.consent,
    preferences: official
      ? context.preferences
      : { ...context.preferences, education: true },
    kind: official ? "edge" : "education",
    eligible: context.regionAllowed,
    fresh: context.fresh,
    startAt: context.startAt,
    expiresAt: envelope.expiresAt,
    sentToday: context.sentToday,
    globalBudgetRemaining: context.globalBudgetRemaining,
  });
  if (decision !== "send") return suppress(decision);
  return {
    status: "NOT_CONFIGURED" as const,
    reason: "FCM_NOT_CONFIGURED",
    payload: null,
  };
}
