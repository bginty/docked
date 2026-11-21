import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  cashWithdrawalConsentVersions,
  cashWithdrawalPolicyPublished,
} from "../../src/core/commercial-cash-presentation";
import candidate from "../../config/cash-policy-content.json";
import live from "../../config/launch-policy-content.json";
import { ReleasePolicyPage } from "../../src/components/release-policy-page";

const published = {
  APP_ENV: "production",
  DOCKED_COMMERCIAL_CASH_POLICY: "true",
  TERMS_VERSION: cashWithdrawalConsentVersions.terms,
  PRIVACY_POLICY_VERSION: cashWithdrawalConsentVersions.privacy,
};

test("cash document selection is closed by default and requires exact new consents", () => {
  assert.equal(cashWithdrawalPolicyPublished({}), false);
  assert.equal(cashWithdrawalPolicyPublished(published), true);
  for (const change of [
    { DOCKED_COMMERCIAL_CASH_POLICY: "false" },
    { DOCKED_COMMERCIAL_CASH_POLICY: undefined },
    { TERMS_VERSION: "previous-terms-version" },
    { PRIVACY_POLICY_VERSION: "previous-privacy-version" },
    { DOCKED_BETA_STAGING: "true" },
  ])
    assert.equal(
      cashWithdrawalPolicyPublished({ ...published, ...change }),
      false,
    );
});

test("payment and request closure retain published cash obligations", () => {
  assert.equal(
    cashWithdrawalPolicyPublished({
      ...published,
      DOCKED_COMMERCIAL_SERVICE: "false",
      DOCKED_COMMERCIAL_SURFACES: "false",
      DOCKED_COMMERCIAL_MARKETPLACE: "false",
      DOCKED_COMMERCIAL_WITHDRAWALS: "false",
      DOCKED_COMMERCIAL_WITHDRAWAL_PAYMENTS: "false",
    }),
    true,
  );
});

test("candidate policy IDs match required consents without replacing the live documents", () => {
  assert.equal(candidate.publication.status, "unpublished-candidate");
  assert.deepEqual(candidate.consentVersions, cashWithdrawalConsentVersions);
  assert.equal(
    candidate.documents.find((d) => d.id === "commercial-policy")?.version,
    cashWithdrawalConsentVersions.terms,
  );
  assert.equal(
    candidate.documents.find((d) => d.id === "privacy")?.version,
    cashWithdrawalConsentVersions.privacy,
  );
  assert.notEqual(
    live.documents.find((d) => d.id === "privacy")?.version,
    cashWithdrawalConsentVersions.privacy,
  );
});

test("policy renderer selects cash notices only after version-bound publication", (t) => {
  const keys = [
    "APP_ENV",
    "DOCKED_COMMERCIAL_CASH_POLICY",
    "TERMS_VERSION",
    "PRIVACY_POLICY_VERSION",
    "DOCKED_BETA_STAGING",
  ] as const;
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  t.after(() => {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });
  delete process.env.DOCKED_BETA_STAGING;
  Object.assign(process.env, published);
  process.env.DOCKED_COMMERCIAL_CASH_POLICY = "false";
  const before = renderToStaticMarkup(
    createElement(ReleasePolicyPage, { id: "commercial-policy" }),
  );
  assert.ok(!before.includes(cashWithdrawalConsentVersions.terms));
  process.env.DOCKED_COMMERCIAL_CASH_POLICY = "true";
  const after = renderToStaticMarkup(
    createElement(ReleasePolicyPage, { id: "commercial-policy" }),
  );
  assert.ok(after.includes(cashWithdrawalConsentVersions.terms));
  assert.ok(after.includes("Withdrawals from eligible sale proceeds"));
  assert.ok(!after.includes("withdrawals remain unavailable"));
});
