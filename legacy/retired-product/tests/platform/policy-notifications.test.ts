import { test } from "node:test";
import assert from "node:assert/strict";
import { eligible, boardState, type RegionPolicy } from "../../src/core/policy";
import {
  dispatchDecision,
  localDay,
  dueSlot,
  editorialSchedules,
  nextScheduleAt,
} from "../../src/core/notifications";
import { config } from "../../src/server/config";
const policy: RegionPolicy = {
  country: "AU",
  state: "VIC",
  approved: true,
  minimumAge: 18,
  features: ["tips", "communications"],
  operators: ["fictional"],
  evidence: "fictional test review",
  version: "test",
  effectiveFrom: "2026-01-01",
  effectiveTo: "2027-01-01",
  reviewAt: "2026-12-01",
};
test("durable next-run follows local DST and disabled schedules stay off", () => {
  assert.equal(
    nextScheduleAt(editorialSchedules[0], "2026-10-03T22:00:00Z"),
    "2026-10-04T20:30:00.000Z",
  );
  assert.equal(
    nextScheduleAt(editorialSchedules[2], "2026-10-02T00:00:00Z"),
    null,
  );
});
test("effective dated policy restricts unknown, expired and mismatched jurisdictions", () => {
  const loc = { country: "AU", state: "VIC", ageAttested: true };
  assert.equal(eligible(policy, loc, "tips", "2026-10-02", "fictional"), true);
  assert.equal(eligible(null, loc, "tips", "2026-10-02"), false);
  assert.equal(eligible(policy, loc, "tips", "2027-01-01"), false);
  assert.equal(
    eligible(policy, { ...loc, state: "NSW" }, "tips", "2026-10-02"),
    false,
  );
  assert.equal(eligible(policy, loc, "tips", "2026-12-02"), false);
});
test("unavailable feed is not no-edge", () => {
  assert.equal(
    boardState({ region: true, strategy: true, feed: false, publication: true })
      .code,
    "feed_unavailable",
  );
  assert.equal(
    boardState({ region: true, strategy: true, feed: true, publication: true })
      .code,
    "no_edge",
  );
});
const input = () => ({
  now: "2026-10-02T02:00:00Z",
  environment: "production",
  sendingEnabled: true,
  consent: true,
  preferences: {
    timezone: "Australia/Melbourne",
    paused: false,
    digest: "weekly" as const,
    edgeAlerts: true,
    education: false,
    quietStart: 21,
    quietEnd: 8,
  },
  kind: "edge" as const,
  eligible: true,
  fresh: true,
  startAt: "2026-10-02T10:00:00Z",
  expiresAt: "2026-10-02T02:03:00Z",
  sentToday: 0,
  globalBudgetRemaining: 100,
});
test("dispatch checks consent, preview, daily cap, current edge and expiry", () => {
  assert.equal(dispatchDecision(input()), "send");
  assert.equal(
    dispatchDecision({ ...input(), consent: false }),
    "consent_or_pause",
  );
  assert.equal(
    dispatchDecision({ ...input(), environment: "preview" }),
    "preview_or_sending_paused",
  );
  assert.equal(dispatchDecision({ ...input(), sentToday: 2 }), "daily_cap");
  assert.equal(dispatchDecision({ ...input(), fresh: false }), "edge_invalid");
  assert.equal(
    dispatchDecision({ ...input(), expiresAt: "2026-10-02T01:00Z" }),
    "expired",
  );
});
test("quiet hours discard edges and IANA handling follows DST", () => {
  assert.equal(
    dispatchDecision({
      ...input(),
      now: "2026-10-02T12:00Z",
      expiresAt: "2026-10-02T12:03Z",
      startAt: "2026-10-02T14:00Z",
    }),
    "discard_quiet_hours",
  );
  assert.equal(
    localDay("2026-10-03T14:30Z", "Australia/Melbourne"),
    "2026-10-04",
  );
  assert.ok(dueSlot(editorialSchedules[0], "2026-10-02T21:30:00Z"));
  assert.ok(dueSlot(editorialSchedules[0], "2026-10-04T20:30:00Z"));
});
test("production refuses demo, preview credentials and automatic monetisation", () => {
  assert.throws(() => config({ APP_ENV: "production", DEMO_MODE: "true" }));
  assert.throws(() => config({ PAID_PLANS_ENABLED: "true" }));
  assert.equal(
    config({ APP_ENV: "preview", SENDING_ENABLED: "true" }).sending,
    false,
  );
});
