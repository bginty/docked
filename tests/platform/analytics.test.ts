import test from "node:test";
import assert from "node:assert/strict";
import {
  analyticsInput,
  analyticsEvents,
  pageEvent,
  clientAnalyticsAllowed,
  serverAnalyticsEvents,
} from "../../src/core/analytics";
test("analytics accepts the finite taxonomy and rejects sensitive free-form payloads", () => {
  assert.ok(analyticsEvents.includes("feed_viewed"));
  assert.equal(
    analyticsInput.safeParse({ event: "edge_viewed" }).success,
    false,
  );
  for (const event of analyticsEvents)
    assert.ok(analyticsInput.safeParse({ event }).success);
  for (const extra of [
    { password: "secret" },
    { stake: 100 },
    { url: "https://example.test/?email=private" },
  ])
    assert.equal(
      analyticsInput.safeParse({ event: "feed_viewed", ...extra }).success,
      false,
    );
  assert.equal(pageEvent("/auth/callback"), null);
  assert.equal(pageEvent("/learn/probability"), null);
});

test("browser telemetry cannot forge successful community or account actions", () => {
  for (const event of serverAnalyticsEvents)
    assert.equal(clientAnalyticsAllowed(event), false);
  assert.equal(clientAnalyticsAllowed("feed_viewed"), true);
  assert.equal(clientAnalyticsAllowed("comment_created"), false);
});
