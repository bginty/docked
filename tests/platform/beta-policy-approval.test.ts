import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { betaPolicyVersions } from "../../src/core/hosted-beta.mjs";

test("approved beta content preserves all seven owner-approved hashes and closed external gates", () => {
  const read = (file: string) => JSON.parse(readFileSync(file, "utf8"));
  const root = "docs/policies/2026-10-09-beta-rc2/";
  const approval = read(root + "owner-approval.json");
  const content = read("config/beta-policy-content.json");
  assert.equal(
    approval.sourceCommit,
    "da3b48a2a6235d1f7592047dd00724586cbb6c0e",
  );
  assert.equal(content.documents.length, 7);
  for (const doc of content.documents) {
    const original = readFileSync(root + doc.id + ".md", "utf8");
    assert.equal(doc.text, original);
    assert.equal(
      createHash("sha256").update(original).digest("hex"),
      approval.documents.find((d: { id: string }) => d.id === doc.id).sha256,
    );
  }
  assert.deepEqual(betaPolicyVersions(), approval.versions);
  const runtime = read("config/hosted-beta.json");
  assert.equal(runtime.externalActivationApproved, false);
  assert.equal(runtime.hostedAcceptance, null);
  assert.equal(approval.scope.publicRegistrationAuthorized, false);
  assert.equal(approval.scope.productionPromotionAuthorized, false);
});
