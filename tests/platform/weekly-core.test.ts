import { test } from "node:test";
import assert from "node:assert/strict";
import { weeklyCountdown, weeklyCorePolicy } from "../../src/core/weekly-core";
import { privateAccountSummary } from "../../src/core/profile-overview";
test("weekly policy and server-time countdown: no browser weekday reset or negative timer", () => {
  assert.equal(weeklyCorePolicy.cards, 4);
  assert.equal(weeklyCorePolicy.price, 0);
  assert.equal(weeklyCorePolicy.periodSeconds, 7 * 24 * 60 * 60);
  assert.deepEqual(weeklyCorePolicy.positions, ["QB", "RB", "WR", "TE"]);
  const now = Date.parse("2026-10-03T02:00:00Z");
  assert.equal(
    weeklyCountdown(new Date(now + 604800000).toISOString(), now),
    "7d 0h 0m",
  );
  assert.match(
    weeklyCountdown(new Date(now).toISOString(), now + 1),
    /Checking/,
  );
  assert.match(weeklyCountdown(undefined, now), /Checking/);
});
test("account summary masks address and does not invent verification", () => {
  assert.deepEqual(
    privateAccountSummary({
      email: "tester@example.test",
      email_confirmed_at: null,
    }),
    { maskedEmail: "t••••@example.test", emailVerified: false },
  );
  assert.equal(
    privateAccountSummary({ email: "tester@example.test" }).emailVerified,
    null,
  );
  assert.equal(
    privateAccountSummary({ email: "broken", email_confirmed_at: "2026-10-01" })
      .emailVerified,
    null,
  );
  assert.equal(
    privateAccountSummary({
      email: "tester@example.test",
      email_confirmed_at: "2026-10-01",
    }).emailVerified,
    true,
  );
});
