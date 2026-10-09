import { test } from "node:test";
import assert from "node:assert/strict";
import {
  planNativePush,
  type NativePushContext,
  type NativePushEnvelope,
} from "../../src/core/native-push";
const id = "00000000-0000-4000-8000-000000000222";
const envelope: NativePushEnvelope = {
  version: 1,
  notificationId: id,
  type: "official_edge",
  path: `/tips/${id}`,
  expiresAt: "2026-10-03T08:10:00Z",
};
const context: NativePushContext = {
  now: "2026-10-03T08:00:00Z",
  environment: "production",
  sendingEnabled: true,
  accountActive: true,
  deviceRevoked: false,
  regionAllowed: true,
  contentVisible: true,
  actorBlockedOrMuted: false,
  followNotifications: true,
  consent: true,
  preferences: {
    timezone: "Australia/Sydney",
    paused: false,
    digest: "off",
    edgeAlerts: true,
    education: false,
    quietStart: 21,
    quietEnd: 8,
  },
  channels: {
    officialEdges: true,
    followedMembers: true,
    social: true,
    leaderboard: true,
    competitions: false,
    dealsMarketing: false,
    inApp: true,
    email: false,
    push: true,
  },
  fresh: true,
  startAt: "2026-10-03T10:00:00Z",
  sentToday: 0,
  sentPast24Hours: 0,
  globalBudgetRemaining: 100,
};
test("native push contract remains NOT_CONFIGURED even after every real dispatch gate would pass", () => {
  assert.deepEqual(planNativePush(envelope, context), {
    status: "NOT_CONFIGURED",
    reason: "FCM_NOT_CONFIGURED",
    payload: null,
  });
  for (const change of [
    { accountActive: false },
    { deviceRevoked: true },
    { regionAllowed: false },
    { contentVisible: false },
    { actorBlockedOrMuted: true },
    { consent: false },
    { sentToday: 2 },
    { sentPast24Hours: 30 },
    { globalBudgetRemaining: NaN },
    { fresh: false },
    { startAt: "2026-10-03T08:05:00Z" },
    { environment: "preview" },
    { sendingEnabled: false },
    { preferences: { ...context.preferences, paused: true } },
    { channels: { ...context.channels, push: false } },
  ]) {
    assert.equal(
      planNativePush(envelope, { ...context, ...change }).status,
      "SUPPRESSED",
    );
  }
});
test("native social push respects per-follow opt-in, quiet hours, expiry and allowlisted paths", () => {
  const followed = {
    ...envelope,
    type: "followed_member_edge" as const,
    path: `/community/edges/${id}`,
  };
  assert.equal(
    planNativePush(followed, { ...context, followNotifications: false }).reason,
    "category_not_opted_in",
  );
  assert.equal(
    planNativePush(envelope, {
      ...context,
      preferences: { ...context.preferences, timezone: "invalid" },
    }).status,
    "SUPPRESSED",
  );
  assert.equal(
    planNativePush({ ...envelope, path: "/admin" }, context).reason,
    "invalid_payload",
  );
  assert.equal(
    planNativePush({ ...envelope, expiresAt: "invalid" }, context).reason,
    "expired",
  );
  assert.equal(
    planNativePush(
      { ...followed, expiresAt: "2026-10-03T14:00:00Z" },
      { ...context, now: "2026-10-03T12:00:00Z" },
    ).reason,
    "defer_quiet_hours",
  );
});
