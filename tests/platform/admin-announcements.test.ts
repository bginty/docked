import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { announcementMutation } from "../../src/core/admin-announcements";
test("announcement requests are bounded and cannot request delivery or claim an actor", () => {
  const valid = {
    requestId: randomUUID(),
    id: randomUUID(),
    action: "create",
    version: 0,
    title: " Draft ",
    body: " Message ",
    audience: "admitted",
    reason: " Prepare ",
  };
  assert.equal(announcementMutation.parse(valid).title, "Draft");
  for (const overrides of [
    { actor: randomUUID() },
    { action: "send" },
    { audience: "all" },
    { version: -1 },
    { body: "x".repeat(3001) },
    { title: " " },
    { requestId: "x" },
    { reason: "" },
  ]) {
    assert.equal(
      announcementMutation.safeParse({ ...valid, ...overrides }).success,
      false,
    );
  }
});
