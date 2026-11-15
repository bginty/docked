import { test } from "node:test";
import assert from "node:assert/strict";
import { invitationSetup } from "../../src/core/invitation-setup";
import {
  namedTesterConsentMatches,
  namedTesterNoticeVersion,
} from "../../src/core/named-private-tester";
const setup = {
  country: "US",
  state: "CA",
  version: namedTesterNoticeVersion,
} as const;
const form = {
  username: "BrentonTest",
  country: "US",
  state: "CA",
  age: true,
  terms: true,
  privacy: true,
  betaRules: true,
  namedTesterRules: true,
  namedTesterVersion: namedTesterNoticeVersion,
};
test("named testing requires separate current own consent and exact real region", () => {
  assert(namedTesterConsentMatches(setup, invitationSetup.parse(form)));
  assert(!namedTesterConsentMatches(null, form));
  for (const bad of [
    { country: "AU", state: "NSW" },
    { state: "NY" },
    { namedTesterRules: false },
    { namedTesterRules: undefined },
    { namedTesterVersion: "old-version" },
  ])
    assert(!namedTesterConsentMatches(setup, { ...form, ...bad }));
  for (const field of ["age", "terms", "privacy"])
    assert(!invitationSetup.safeParse({ ...form, [field]: false }).success);
  const parsed = invitationSetup.parse({
    ...form,
    userId: "other",
    role: "owner",
    credits: 100000,
    founderAttested: true,
  });
  for (const key of ["userId", "role", "credits", "founderAttested"])
    assert(!(key in parsed));
});
