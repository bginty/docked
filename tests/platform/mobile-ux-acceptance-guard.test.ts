import test from "node:test";
import assert from "node:assert/strict";
import {
  allowedRequest,
  validateFixture,
  projectRef,
  organizationId,
  origin,
} from "../hosted/mobile-ux/guard";

const now = Date.parse("2026-10-03T12:00:00.000Z");
const runId = "06e6e734-ec48-4152-b352-8cd664c47d72";
const good = () => ({
  projectRef,
  organizationId,
  origin,
  qaFixture: true,
  disposable: true,
  runId,
  createdAt: new Date(now - 60000).toISOString(),
  expiresAt: new Date(now + 3600000).toISOString(),
  member: {
    id: "c452d775-6d92-45cb-b393-18ad4c19448d",
    email: `docked-preview-mobile-ux-${runId}@example.invalid`,
    password: "a".repeat(40) + "Aa1!",
  },
});

test("mobile UX fixture binds the fresh disposable identity, project, origin and expiry", () => {
  assert.equal(validateFixture(good(), now).runId, runId);
  for (const mutate of [
    (v: ReturnType<typeof good>) => {
      v.member.email = "docked-preview-s24-tester-20261003@example.invalid";
    },
    (v: ReturnType<typeof good>) => {
      v.member.email = "docked-preview-qa-a-20261003@example.invalid";
    },
    (v: ReturnType<typeof good>) => {
      v.origin = "https://docked.com.au";
    },
    (v: ReturnType<typeof good>) => {
      v.projectRef = "unrelated";
    },
    (v: ReturnType<typeof good>) => {
      v.organizationId = "unrelated";
    },
    (v: ReturnType<typeof good>) => {
      v.qaFixture = false;
    },
    (v: ReturnType<typeof good>) => {
      v.disposable = false;
    },
    (v: ReturnType<typeof good>) => {
      v.member.password = "[ERASED]";
    },
    (v: ReturnType<typeof good>) => {
      v.createdAt = new Date(now + 60000).toISOString();
    },
    (v: ReturnType<typeof good>) => {
      v.expiresAt = new Date(now - 1).toISOString();
    },
    (v: ReturnType<typeof good>) => {
      v.expiresAt = new Date(now + 86400000).toISOString();
    },
  ]) {
    const value = good();
    mutate(value);
    assert.throws(() => validateFixture(value, now));
  }
});

test("mobile UX browser permits only exact-origin reads and ordinary auth actions", () => {
  assert.equal(allowedRequest(`${origin}/points`, "GET", null), true);
  assert.equal(
    allowedRequest(`${origin}/api/community?view=feed`, "GET", null),
    true,
  );
  for (const action of ["login", "logout"])
    assert.equal(
      allowedRequest(`${origin}/api/auth`, "POST", JSON.stringify({ action })),
      true,
    );
  for (const [url, method, body] of [
    ["https://docked.com.au/points", "GET", null],
    [`${origin}/login?password=fictional`, "GET", null],
    [`${origin}/login?EMAIL=fictional`, "GET", null],
    [`${origin}/points?refresh_token=fictional`, "GET", null],
    [`${origin}/api/community`, "POST", '{"action":"post"}'],
    [`${origin}/api/auth`, "POST", '{"action":"signup"}'],
    [`${origin}/api/auth`, "POST", '{"action":"recover"}'],
    [`${origin}/api/auth`, "DELETE", null],
    [`${origin}/api/auth`, "POST", "malformed"],
  ] as const)
    assert.equal(allowedRequest(url, method, body), false);
});
