import test from "node:test";
import assert from "node:assert/strict";
import { postBetaOwnerDestination } from "../../src/core/post-beta-owner";
import { rejectedSessionCookies } from "../../src/core/rejected-session-cookies";
import { memberReturnPath } from "../../src/core/member-access-recovery";
import { nativeSessionDestination } from "../../src/core/native-navigation";

test("both retained Owner roles land on Commercial operations and preserve individual MFA", () => {
  for (const label of ["Founder", "Barry"]) {
    assert.equal(
      postBetaOwnerDestination({ postBetaOwner: true, aal: "aal2" }),
      "/admin/operations",
      label,
    );
    assert.equal(
      postBetaOwnerDestination({ postBetaOwner: true, aal: "aal1" }),
      "/mfa?next=%2Fadmin%2Foperations",
      label,
    );
    for (const next of [
      "/fantasy/play",
      "/fantasy/cards",
      "/fantasy/test-wallet",
      "https://evil.invalid/admin",
      "//evil.invalid",
      "/admin/../fantasy/play",
    ])
      assert.equal(
        postBetaOwnerDestination({ postBetaOwner: true, aal: "aal2" }, next),
        "/admin/operations",
      );
    assert.equal(
      postBetaOwnerDestination(
        { postBetaOwner: true, aal: "aal2" },
        "/admin/commercial-billing",
      ),
      "/admin/commercial-billing",
    );
  }
  assert.equal(postBetaOwnerDestination(null), null);
  assert.equal(
    postBetaOwnerDestination({ postBetaOwner: false, aal: "aal2" }),
    null,
  );
});

test("incidents survive login/MFA return validation without widening external redirects", () => {
  assert.equal(memberReturnPath("/admin/operations"), "/admin/operations");
  for (const aal of ["aal1", "aal2"]) {
    const destination = postBetaOwnerDestination(
      { postBetaOwner: true, aal },
      "/admin/incidents",
    );
    assert.equal(
      destination,
      aal === "aal2" ? "/admin/incidents" : "/mfa?next=%2Fadmin%2Fincidents",
    );
  }
  assert.equal(memberReturnPath("/admin/incidents"), "/admin/incidents");
  for (const path of [
    "/admin/unknown",
    "/admin/../../app",
    "//admin/incidents",
    "https://docked.com.au/admin/incidents",
  ])
    assert.equal(memberReturnPath(path), null);
});

test("pack awards retain their customer selection through Owner login and MFA", () => {
  const next = "/admin/pack-awards?member=20000000-0000-4000-8000-000000000001";
  assert.equal(memberReturnPath(next), next);
  assert.equal(
    postBetaOwnerDestination({ postBetaOwner: true, aal: "aal2" }, next),
    next,
  );
  assert.equal(
    postBetaOwnerDestination({ postBetaOwner: true, aal: "aal1" }, next),
    `/mfa?next=${encodeURIComponent(next)}`,
  );
  assert.equal(memberReturnPath("/admin/pack-awards/enable"), null);
});

test("roster filters survive Owner login and MFA without adding mutation routes", () => {
  const next = "/admin/rosters?sport=afl&club=ADE&page=2";
  assert.equal(memberReturnPath(next), next);
  assert.equal(
    postBetaOwnerDestination({ postBetaOwner: true, aal: "aal2" }, next),
    next,
  );
  assert.equal(
    postBetaOwnerDestination({ postBetaOwner: true, aal: "aal1" }, next),
    `/mfa?next=${encodeURIComponent(next)}`,
  );
  assert.equal(memberReturnPath("/admin/rosters/activate"), null);
});

test("invalid refresh clears only this project's session chunks, retaining PKCE and unrelated cookies", () => {
  const key = "sb-fixture-auth-token";
  const names = [
    key,
    key + ".0",
    key + ".1",
    key + "-code-verifier",
    "sb-other-auth-token",
    key + ".not-a-chunk",
    "preference",
  ];
  for (const error of [
    { status: 400, code: "refresh_token_not_found" },
    { status: 400, name: "AuthSessionMissingError" },
    { status: 401, code: "session_not_found" },
  ])
    assert.deepEqual(
      rejectedSessionCookies(error, names, "https://fixture.supabase.co"),
      names.slice(0, 3),
    );
  for (const error of [
    null,
    Error("network"),
    { status: 429, code: "refresh_token_not_found" },
    { status: 503, code: "session_not_found" },
    { status: 403, code: "insufficient_aal" },
    { status: 400, code: "validation_failed" },
    { name: "AuthRetryableFetchError", status: 400, code: "session_not_found" },
  ])
    assert.deepEqual(
      rejectedSessionCookies(error, names, "https://fixture.supabase.co"),
      [],
    );
});

test("native resume returns retained Owners to Commercial operations without interrupting MFA or restarting gameplay", () => {
  const owner = {
    authenticated: true,
    onboardingRequired: true,
    ownerAccess: true,
  };
  assert.equal(
    nativeSessionDestination(200, owner, "/fantasy/play"),
    "/admin/operations",
  );
  assert.equal(nativeSessionDestination(200, owner, "/admin/incidents"), null);
  assert.equal(nativeSessionDestination(200, owner, "/mfa"), null);
  assert.equal(nativeSessionDestination(200, owner, "/app/login"), null);
  assert.equal(nativeSessionDestination(503, owner, "/fantasy/play"), null);
  assert.equal(
    nativeSessionDestination(
      200,
      { authenticated: false, ownerAccess: true },
      "/fantasy/play",
    ),
    "/app/login",
  );
});
