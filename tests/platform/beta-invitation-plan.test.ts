import { test } from "node:test";
import assert from "node:assert/strict";
import { planBetaInvitations } from "../../src/core/beta-invitation-plan";

test("beta roster permits one Australian member plus the separate designated owner without enabling sends", () => {
  const plan = planBetaInvitations(
    Array.from({ length: 1 }, (_, i) => ({
      email: `Tester${i}@example.invalid`,
      country: "AU",
    })),
  );
  assert.equal(plan.testers.length, 1);
  assert.ok(plan.testers.every((row) => row.role === "member"));
  assert.equal(plan.testers[0].email, "tester0@example.invalid");
  assert.equal(plan.status, "prepared-not-authorized-for-sending");
  assert.equal(plan.publicRegistration, false);
});
test("beta roster rejects excess capacity, duplicates, owner reuse, overseas entries and role injection", () => {
  for (const input of [
    Array.from({ length: 2 }, (_, i) => ({
      email: `tester${i}@example.invalid`,
      country: "AU",
    })),
    [
      { email: "a@example.invalid", country: "AU" },
      { email: " A@example.invalid ", country: "AU" },
    ],
    [{ email: "Support@docked.com.au", country: "AU" }],
    [{ email: "a@example.invalid", country: "NZ" }],
    [{ email: "a@example.invalid", country: "AU", role: "owner" }],
    [{ email: "invalid", country: "AU" }],
  ])
    assert.throws(() => planBetaInvitations(input));
});
