import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { previewOwnerAuth } from "../../src/core/preview-owner-auth";
import {
  previewOwnerMatches,
  previewParticipantMatches,
} from "../../src/core/preview-owner";
const env = {
  DOCKED_PREVIEW_OWNER_ID: "local-fixture-owner",
  DOCKED_PREVIEW_OWNER_EMAIL: "support@docked.com.au",
};
const owner = {
  id: env.DOCKED_PREVIEW_OWNER_ID,
  email: env.DOCKED_PREVIEW_OWNER_EMAIL,
  email_confirmed_at: "2026-10-01",
  is_anonymous: false,
};
function fixture(
  user: typeof owner | null = owner,
  currentLevel = "aal1",
  nextLevel = "aal1",
) {
  const calls: string[] = [];
  const auth = {
    getUser: async () => ({ data: { user }, error: null }),
    signInWithPassword: async () => {
      calls.push("login");
      return { data: { user }, error: null };
    },
    signOut: async () => {
      calls.push("logout");
      return { error: null };
    },
    updateUser: async () => {
      calls.push("password");
      return { data: { user }, error: null };
    },
    mfa: {
      getAuthenticatorAssuranceLevel: async () => ({
        data: { currentLevel, nextLevel },
        error: null,
      }),
      listFactors: async () => ({ data: { all: [] }, error: null }),
    },
  } as unknown as SupabaseClient["auth"];
  return { auth, calls };
}
test("owner bootstrap pins verified identity, not metadata or email alone", () => {
  assert.equal(previewOwnerMatches(owner, env), true);
  for (const user of [
    null,
    { ...owner, id: "another" },
    { ...owner, email: "member@example.test" },
    { ...owner, email_confirmed_at: "" },
    { ...owner, is_anonymous: true },
  ])
    assert.equal(previewOwnerMatches(user, env), false);
  assert.equal(
    previewOwnerMatches(owner, {
      ...env,
      DOCKED_PREVIEW_OWNER_EMAIL: "member@example.test",
    }),
    false,
  );
});
test("closed bootstrap denies signup/recovery and ordinary-member login before calling provider", async () => {
  const f = fixture();
  for (const action of ["signup", "recover", "resend", "login"])
    assert.ok(
      "error" in
        (await previewOwnerAuth(
          f.auth,
          {
            action,
            email: "member@example.test",
            password: "local-only-fixture",
          },
          env,
        )),
    );
  assert.deepEqual(f.calls, []);
});
test("wrong ID with owner email cannot gain a setup session", async () => {
  const f = fixture({ ...owner, id: "another" });
  assert.ok(
    "error" in
      (await previewOwnerAuth(
        f.auth,
        { action: "login", email: owner.email, password: "local-only-fixture" },
        env,
      )),
  );
  assert.deepEqual(f.calls, ["login", "logout"]);
});
test("only confirmed exact owner can set initial password; later resets require existing MFA", async () => {
  const denied = fixture(null);
  assert.ok(
    "error" in
      (await previewOwnerAuth(
        denied.auth,
        { action: "reset", password: "local-only-fixture" },
        env,
      )),
  );
  assert.deepEqual(denied.calls, []);
  const first = fixture();
  assert.equal(
    (
      await previewOwnerAuth(
        first.auth,
        { action: "reset", password: "local-only-fixture" },
        env,
      )
    ).redirect,
    "/mfa",
  );
  assert.deepEqual(first.calls, ["password"]);
  const existing = fixture(owner, "aal1", "aal2");
  assert.equal(
    (
      await previewOwnerAuth(
        existing.auth,
        { action: "reset", password: "local-only-fixture" },
        env,
      )
    ).redirect,
    "/mfa?next=/app/reset-password",
  );
  assert.deepEqual(existing.calls, []);
});
test("owner MFA confirmation returns only to setup or permitted password page, not arbitrary URLs", async () => {
  const f = fixture(owner, "aal2", "aal2");
  assert.equal(
    (
      await previewOwnerAuth(
        f.auth,
        { action: "mfa_status", next: "https://bad.invalid" },
        env,
      )
    ).redirect,
    "/app/preview-owner",
  );
  assert.equal(
    (
      await previewOwnerAuth(
        f.auth,
        { action: "mfa_status", next: "/app/reset-password" },
        env,
      )
    ).redirect,
    "/app/reset-password",
  );
});

test("explicit laboratory tester authenticates only into MFA and the sandbox", async () => {
  const tester = {
    ...owner,
    id: "fixture-tester",
    email: "tester@example.test",
  };
  const configured = {
    ...env,
    DOCKED_PRIVATE_PREVIEW: "true",
    DOCKED_MULTI_SPORT_SANDBOX: "true",
    DOCKED_PREVIEW_TESTER_ID: tester.id,
    DOCKED_PREVIEW_TESTER_EMAIL: tester.email,
  };
  assert.equal(previewOwnerMatches(tester, configured), false);
  assert.equal(previewParticipantMatches(tester, configured), true);
  for (const user of [
    { ...tester, id: "other" },
    { ...tester, email_confirmed_at: "" },
    { ...tester, is_anonymous: true },
  ])
    assert.equal(previewParticipantMatches(user, configured), false);
  assert.equal(
    previewParticipantMatches(tester, {
      ...configured,
      DOCKED_MULTI_SPORT_SANDBOX: "false",
    }),
    false,
  );
  const f = fixture(tester, "aal2", "aal2");
  assert.equal(
    (
      await previewOwnerAuth(
        f.auth,
        {
          action: "login",
          email: tester.email,
          password: "local-fixture-only",
        },
        configured,
      )
    ).redirect,
    "/mfa",
  );
  assert.equal(
    (
      await previewOwnerAuth(
        f.auth,
        { action: "mfa_status", next: "/admin/operations" },
        configured,
      )
    ).redirect,
    "/app/sports-preview",
  );
  assert.ok(
    (await previewOwnerAuth(f.auth, { action: "signup" }, configured)).error,
  );
});
