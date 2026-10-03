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
  assert.equal(analyticsEvents.length, 37);
  for (const event of analyticsEvents)
    assert.ok(analyticsInput.safeParse({ event }).success);
  for (const extra of [
    { password: "secret" },
    { stake: 100 },
    { url: "https://example.test/?email=private" },
  ])
    assert.equal(
      analyticsInput.safeParse({ event: "edge_viewed", ...extra }).success,
      false,
    );
  assert.equal(pageEvent("/auth/callback"), null);
  assert.equal(pageEvent("/learn/probability"), "article_viewed");
});

test("browser telemetry cannot forge successful community or account actions", () => {
  for (const event of serverAnalyticsEvents)
    assert.equal(clientAnalyticsAllowed(event), false);
  assert.equal(clientAnalyticsAllowed("feed_viewed"), true);
  assert.equal(clientAnalyticsAllowed("community_edge_started"), true);
  assert.equal(clientAnalyticsAllowed("community_edge_submitted"), false);
  assert.equal(clientAnalyticsAllowed("comment_created"), false);
});
