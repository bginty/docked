import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const output = path.join(root, "docs/ops-launch-20261105");
const canonical = (s) => s.replace(/\r\n/g, "\n");
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const sourcePath = "config/launch-policy-content.json";
const rendererPath = "src/components/release-policy-page.tsx";
const beforeText = canonical(fs.readFileSync(sourcePath, "utf8"));
const source = JSON.parse(beforeText);
assert.equal(source.version, "2026-11-02-release-preparation-v2");
assert.equal(
  sha(beforeText),
  "9655ebb36bd5410ff07e18001d26c999ab51d4f85345252aab9ca9b293e89b93",
);
const proposed = structuredClone(source);
const privacyIndex = proposed.documents.findIndex((d) => d.id === "privacy");
const privacy = proposed.documents[privacyIndex];
const section = privacy.sections.find(
  (s) => s.title === "Device information and analytics",
);
const firstParagraph = section.text.split("\n\n")[0];
section.text = [
  firstParagraph,
  "The app has no advertising SDK. Android and Google Play may provide operating-system diagnostics under their own settings.",
  "The Android app also includes Google Play Billing Library. When the library is initialised or used, it sends billing-operation results, technical app/device information and a per-session identifier to Google for billing reliability, performance improvement and error support. This automatic SDK processing can occur without a completed purchase. It is separate from Docked's optional usage analytics and is not disabled by that analytics preference. Google handles this information under its own privacy terms.",
  "Optional media selection and notification preferences follow device permissions and application controls. Contacts, microphone and location access are not required to buy a pack. We do not use identity documents or purchase tokens in Docked's optional usage analytics.",
].join("\n\n");
proposed.documents[privacyIndex] = {
  id: privacy.id,
  title: privacy.title,
  version: "2026-11-06-privacy-sdk-v3",
  date: "6 November 2026",
  status: privacy.status,
  sections: privacy.sections,
};
const proposedText = JSON.stringify(proposed, null, 2) + "\n";
const renderer = canonical(fs.readFileSync(rendererPath, "utf8"));
const marker = '  if (!document) throw new Error("Unknown policy document");\n';
assert.ok(renderer.includes(marker));
const rendererProposed = renderer
  .replace(
    marker,
    marker +
      '  const version =\n    "version" in document && typeof document.version === "string"\n      ? document.version\n      : policies.version;\n  const date =\n    "date" in document && typeof document.date === "string"\n      ? document.date\n      : policies.date;\n',
  )
  .replace(
    "Published {policies.date} · Version {policies.version}",
    "Published {date} · Version {version}",
  );
assert.notEqual(renderer, rendererProposed);
const draftConfigPath = path.join(
  output,
  "launch-policy-content.sdk-clarification.proposed.json",
);
const draftRendererPath = path.join(
  output,
  "release-policy-page.sdk-clarification.proposed.tsx.txt",
);
fs.writeFileSync(draftConfigPath, proposedText);
fs.writeFileSync(draftRendererPath, rendererProposed);

const diffFor = (livePath, draftPath) => {
  const result = spawnSync(
    "git",
    ["diff", "--no-index", "--no-ext-diff", "--", livePath, draftPath],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 1, result.stderr);
  return result.stdout
    .replace(/^diff --git .*$/m, `diff --git a/${livePath} b/${livePath}`)
    .replace(/^--- .*$/m, `--- a/${livePath}`)
    .replace(/^\+\+\+ .*$/m, `+++ b/${livePath}`);
};
const patch =
  diffFor(sourcePath, draftConfigPath) +
  diffFor(rendererPath, draftRendererPath);
fs.writeFileSync(
  path.join(output, "privacy-sdk-clarification.proposed.patch"),
  patch,
);
const unchanged = source.documents
  .filter((d) => d.id !== "privacy")
  .map((d) => {
    assert.deepEqual(
      proposed.documents.find((p) => p.id === d.id),
      d,
    );
    return {
      id: d.id,
      canonicalDocumentSha256: sha(JSON.stringify(d)),
      version: source.version,
      changed: false,
    };
  });
assert.equal(proposed.version, source.version);
assert.equal(proposed.date, source.date);
const otherSections = source.documents[privacyIndex].sections.filter(
  (s) => s.title !== "Device information and analytics",
);
for (const original of otherSections)
  assert.deepEqual(
    proposed.documents[privacyIndex].sections.find(
      (s) => s.title === original.title,
    ),
    original,
  );
const review = {
  preparedAt: new Date().toISOString(),
  status:
    "DRAFT_ONLY_AWAITING_OWNER_WORDING_PUBLICATION_AND_PROSPECTIVE_PRIVACY_BINDING_APPROVAL",
  published: false,
  environmentChanged: false,
  databaseChanged: false,
  existingApprovalReused:
    "v2 commercial model, all unchanged wording and Terms adoption; no new business-model approval sought",
  proposedPrivacyVersion: proposed.documents[privacyIndex].version,
  sourcePacketSha256: sha(beforeText),
  proposedPacketSha256: sha(proposedText),
  proposedPrivacyDocumentSha256: sha(
    JSON.stringify(proposed.documents[privacyIndex]),
  ),
  proposedRendererSha256: sha(rendererProposed),
  proposedPatchSha256: sha(patch),
  checks: {
    unchangedPacketDefaultVersion: true,
    unchangedTermsRefundRetention: true,
    onlyOnePrivacySectionChanged: true,
    noHistoricalConsentRewrites: true,
  },
  unchangedDocuments: unchanged,
  publicationFiles: [sourcePath, rendererPath],
  proposedFutureBindings: {
    TERMS_VERSION: source.version,
    PRIVACY_POLICY_VERSION: proposed.documents[privacyIndex].version,
    "public_gameplay.policy.terms_version": source.version,
    "public_gameplay.policy.privacy_version":
      proposed.documents[privacyIndex].version,
    registration:
      "remains disabled; this approval/publication does not activate it",
    existingConsents:
      "remain unchanged; members who need public access must accept the new privacy version through normal onboarding",
    betaConsents: "existing beta policy versions remain unchanged",
  },
  rollback:
    "Restore the prior policy/renderer deployment and prospective privacy binding together; keep both version texts and all original acceptance events. Publication rollback does not erase consents or enable registration/payments.",
};
fs.writeFileSync(
  path.join(output, "SDK_PRIVACY_WORDING_REVIEW.json"),
  JSON.stringify(review, null, 2) + "\n",
);
console.log(JSON.stringify(review, null, 2));
