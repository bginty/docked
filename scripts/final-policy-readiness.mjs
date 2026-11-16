/** Public GETs plus local proposal rendering; never publishes or submits policy. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
const dir = "docs/qa/final-commercial-20261116/";
const hash = (b) => createHash("sha256").update(b).digest("hex");
const draft = JSON.parse(
  readFileSync(
    "docs/qa/v31-revenue-launch-20261113/launch-wording.NOT-APPROVED.json",
  ),
);
const policy = JSON.parse(readFileSync("config/launch-policy-content.json"));
const replacements = draft.replacements.map((r) => {
  const doc = policy.documents.find((d) => d.id === r.document);
  assert(doc);
  const old = r.field
    ? doc[r.field]
    : doc.sections.find((s) => s.title === r.section);
  return {
    ...r,
    applicableBefore:
      old !== undefined && hash(JSON.stringify(old)) === r.expectedBeforeSha256,
  };
});
const observations = [];
for (const route of [
  "/privacy",
  "/refund-policy",
  "/commercial-policy",
  "/account-deletion",
]) {
  const response = await fetch("https://docked.com.au" + route, {
    signal: AbortSignal.timeout(30000),
  });
  assert.equal(response.status, 200, route);
  const html = await response.text();
  observations.push({
    route,
    status: response.status,
    htmlSha256: hash(html),
    phonePrivacyVersion: html.includes("2026-11-11-privacy-phone-v4"),
    twilioMention: html.includes("Twilio"),
    phoneMention: /phone|mobile/i.test(html),
    overseasMention: /overseas|international|United States/i.test(html),
    commercialAvailabilityStillConditional:
      /disabled|unavailable|before.*launch|approval|not.*activated/i.test(html),
  });
}
writeFileSync(
  dir + "policy-readiness.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      method: "Public GET and local prepared-text comparison only",
      observations,
      replacementsApplicable: replacements.every((r) => r.applicableBefore),
      policySourceSha256: hash(
        readFileSync("config/launch-policy-content.json"),
      ),
      existingDraftSha256: hash(
        readFileSync(
          "docs/qa/v31-revenue-launch-20261113/launch-wording.NOT-APPROVED.json",
        ),
      ),
      phonePrivacyAlreadyApproved: true,
      commercialWordingApproved: false,
      productionWrites: 0,
      googleSubmissions: 0,
    },
    null,
    2,
  ) + "\n",
  { flag: "wx" },
);
const rendered = [
  "DOCKED — EXISTING COMMERCIAL WORDING FOR FINAL REVIEW",
  "No publication or activation. Phone privacy approval is preserved and not requested again.",
  "The final marketplace status must match the separate marketplace decision; conditional description is not acceptance.",
  "A new effective commercial consent version/date must be bound to the final public runtime package.",
  "",
];
for (const r of replacements)
  rendered.push(
    r.document + " — " + (r.title || r.section || r.field),
    r.text,
    "",
  );
if (existsSync(dir + "COMMERCIAL_WORDING_PROPOSAL.txt"))
  assert.equal(
    readFileSync(dir + "COMMERCIAL_WORDING_PROPOSAL.txt", "utf8"),
    rendered.join("\n"),
  );
else
  writeFileSync(dir + "COMMERCIAL_WORDING_PROPOSAL.txt", rendered.join("\n"), {
    flag: "wx",
  });
console.log(
  JSON.stringify({
    routes: observations.length,
    replacements: replacements.length,
    replacementsApplicable: replacements.every((r) => r.applicableBefore),
    publication: false,
  }),
);
