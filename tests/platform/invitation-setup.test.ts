import { test } from "node:test";
import assert from "node:assert/strict";
import {
  invitationSetup,
  verifiedInvitedUser,
} from "../../src/core/invitation-setup";
test("invited setup requires every explicit policy choice and validated profile fields", () => {
  const input = {
    username: "InvitedMember",
    country: "AU",
    state: "VIC",
    age: true,
    terms: true,
    privacy: true,
  };
  assert.equal(invitationSetup.safeParse(input).success, true);
  for (const field of Object.keys(input))
    assert.equal(
      invitationSetup.safeParse({ ...input, [field]: undefined }).success,
      false,
    );
  for (const field of ["age", "terms", "privacy"])
    assert.equal(
      invitationSetup.safeParse({ ...input, [field]: false }).success,
      false,
    );
  assert.equal(
    invitationSetup.safeParse({ ...input, username: "<script>" }).success,
    false,
  );
  assert.equal(
    invitationSetup.safeParse({ ...input, country: "ANY" }).success,
    false,
  );
  const parsed = invitationSetup.parse({
    ...input,
    role: "owner",
    balance: 100000,
    user_id: "someone-else",
  });
  assert.equal("role" in parsed, false);
  assert.equal("user_id" in parsed, false);
  assert.equal(parsed.marketing, undefined);
});
test("only an Auth-confirmed invited nonanonymous identity can begin invited setup", () => {
  const user = {
    invited_at: "2026-10-08T00:00:00Z",
    email_confirmed_at: "2026-10-08T00:01:00Z",
  };
  assert.equal(verifiedInvitedUser(user), true);
  assert.equal(verifiedInvitedUser(null), false);
  assert.equal(verifiedInvitedUser({ ...user, invited_at: undefined }), false);
  assert.equal(
    verifiedInvitedUser({ ...user, email_confirmed_at: undefined }),
    false,
  );
  assert.equal(verifiedInvitedUser({ ...user, is_anonymous: true }), false);
  assert.equal(
    verifiedInvitedUser({
      ...user,
      app_metadata: { preview_invitation_confirmed: true },
    }),
    false,
  );
  assert.equal(
    verifiedInvitedUser({
      ...user,
      app_metadata: { email_ownership_verified: false },
    }),
    false,
  );
});
