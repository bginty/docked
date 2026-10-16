import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { moderationRetentionMutation } from "../../src/core/moderation-retention";
test("retention API never accepts retain, actor, unspecific erase or stale zero versions", () => {
  const value = {
    requestId: randomUUID(),
    targetType: "post",
    targetId: randomUUID(),
    version: 1,
    action: "review",
    reason: "Review synthetic incident evidence",
    confirmation: "",
  };
  assert.ok(moderationRetentionMutation.safeParse(value).success);
  for (const change of [
    { actor: randomUUID() },
    { action: "retain" },
    { action: "erase" },
    { version: 0 },
    { reason: "short" },
  ])
    assert.equal(
      moderationRetentionMutation.safeParse({ ...value, ...change }).success,
      false,
    );
  assert.ok(
    moderationRetentionMutation.safeParse({
      ...value,
      action: "erase",
      confirmation: "ERASE",
    }).success,
  );
});
