import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { moderationCaseMutation } from "../../src/core/moderation-cases";
test("case workflow inputs cannot inject actor, evidence, assets or unsupported actions", () => {
  const valid = {
    requestId: randomUUID(),
    reportId: randomUUID(),
    version: 0,
    action: "update",
    assignee: null,
    severity: "high",
    status: "investigating",
    resolution: "pending",
    reason: "Synthetic investigation",
  };
  assert.equal(moderationCaseMutation.safeParse(valid).success, true);
  for (const overrides of [
    { actor: randomUUID() },
    { action: "delete" },
    { content: "injected" },
    { severity: "highest" },
    { reason: "" },
    { version: -1 },
    { reason: "x".repeat(1001) },
  ])
    assert.equal(
      moderationCaseMutation.safeParse({ ...valid, ...overrides }).success,
      false,
    );
});
