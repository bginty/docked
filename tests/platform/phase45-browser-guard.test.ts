import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateFixture,
  allowedRequest,
  origin,
  projectRef,
  organizationId,
  type RequestScope,
} from "../hosted/phase45/guard";
const now = Date.parse("2026-10-03T12:00:00Z"),
  runId = "10000000-0000-4000-8000-000000000001";
function fixture() {
  return {
    projectRef,
    organizationId,
    origin,
    qaFixture: true,
    runId,
    createdAt: new Date(now - 1000).toISOString(),
    expiresAt: new Date(now + 3600000).toISOString(),
    accounts: (["qa-a", "qa-b", "seed-a", "seed-b"] as const).map(
      (kind, i) => ({
        kind,
        email: `docked-preview-phase45-${kind}-${runId}@example.invalid`,
        password: "FICTIONAL-guard-input-".repeat(3),
        invitationCode: "FICTIONAL-invitation-".repeat(3),
        invitationId: `20000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
        username: `demo_${kind.replace("-", "")}_${runId.slice(0, 8)}`,
        displayName:
          kind === "seed-a"
            ? "DEMO Harbour Tester"
            : kind === "seed-b"
              ? "DEMO Court Tester"
              : `DEMO ${kind.toUpperCase()}`,
        disposable: kind.startsWith("qa-"),
      }),
    ),
  };
}
test("hosted beta accepts only its fresh exact invited roster and labelled seed identities", () => {
  assert.equal(validateFixture(fixture(), now).accounts.length, 4);
  for (const changed of [
    { ...fixture(), projectRef: "unrelated" },
    { ...fixture(), origin: "https://docked.com.au" },
    { ...fixture(), expiresAt: new Date(now).toISOString() },
    {
      ...fixture(),
      accounts: fixture().accounts.map((a, i) =>
        i
          ? a
          : {
              ...a,
              email: "docked-preview-s24-tester-20261003@example.invalid",
            },
      ),
    },
    {
      ...fixture(),
      accounts: fixture().accounts.map((a, i) =>
        i === 2 ? { ...a, disposable: true } : a,
      ),
    },
    {
      ...fixture(),
      accounts: fixture().accounts.map((a, i) =>
        i === 2 ? { ...a, displayName: "Genuine sport expert" } : a,
      ),
    },
  ])
    assert.throws(() => validateFixture(changed, now));
});
test("hosted beta browser requests cannot target owners, external hosts, real ledgers or seed deletion", () => {
  const f = validateFixture(fixture(), now),
    scope: RequestScope = {
      account: f.accounts[0],
      profileIds: new Set(["known-profile"]),
      postIds: new Set(["known-post"]),
      commentIds: new Set(["known-comment"]),
      reviewIds: new Set(["known-review"]),
    };
  const post = (path: string, input: unknown, s = scope) =>
    allowedRequest(origin + path, "POST", JSON.stringify(input), s);
  assert.equal(allowedRequest(origin + "/edges", "GET", null, scope), true);
  assert.equal(
    post("/api/auth", {
      action: "login",
      email: scope.account.email,
      password: scope.account.password,
    }),
    true,
  );
  assert.equal(
    post("/api/community", {
      action: "follow",
      profileId: "known-profile",
      enabled: true,
    }),
    true,
  );
  assert.equal(
    post("/api/community", {
      action: "post",
      body: "[PREVIEW TEST POST] labelled local test",
    }),
    true,
  );
  assert.equal(
    post("/api/preview-edges", {
      action: "submit",
      reviewId: "known-review",
      confirmed: true,
    }),
    true,
  );
  for (const [path, input] of [
    [
      "/api/community",
      { action: "follow", profileId: "owner-id", enabled: true },
    ],
    ["/api/community", { action: "post", body: "A real winning tip" }],
    [
      "/api/community",
      {
        action: "report",
        postId: "owner-post",
        reason: "other",
        details: "[PREVIEW TEST REPORT] denied",
      },
    ],
    ["/api/community-edges", { action: "submit" }],
    ["/api/member", { action: "delete" }],
    [
      "/api/preview-edges",
      { action: "submit", reviewId: "unknown-review", confirmed: true },
    ],
    ["/api/admin/community", { action: "moderate" }],
  ] as const)
    assert.equal(post(path, input), false);
  assert.equal(
    post(
      "/api/member",
      { action: "delete" },
      { ...scope, account: f.accounts[1] },
    ),
    true,
  );
  assert.equal(
    post(
      "/api/member",
      { action: "delete" },
      { ...scope, account: f.accounts[2] },
    ),
    false,
  );
  assert.equal(
    allowedRequest("https://docked.com.au/api/community", "GET", null, scope),
    false,
  );
  assert.equal(
    allowedRequest(
      origin +
        "/app/login?password=" +
        encodeURIComponent(scope.account.password),
      "GET",
      null,
      scope,
    ),
    false,
  );
});
