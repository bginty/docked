// Offline paid-packs-only wording. Published policy and runtime are untouched.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
const dir = "docs/qa/final-release-decision-20261117/";
const prior = JSON.parse(
  readFileSync(
    "docs/qa/v31-revenue-launch-20261113/launch-wording.NOT-APPROVED.json",
    "utf8",
  ),
);
const source = readFileSync(prior.source),
  policy = JSON.parse(source);
const hash = (b) => createHash("sha256").update(b).digest("hex");
assert.equal(hash(source), prior.sourceSha256, "Policy source drift");
const changes = prior.replacements.map((r) => ({ ...r }));
for (const r of changes) {
  if (r.document === "commercial-policy" && r.field === "status")
    r.text =
      "Australian adult release with Google Play credit purchases and paid Standard and Premium card packs. Marketplace buying, selling, trading and swaps remain disabled. Competitions, prizes and withdrawals remain unavailable.";
  if (
    r.document === "commercial-policy" &&
    r.section === "Packs and marketplace"
  )
    r.text =
      "Standard and Premium packs follow the prices, contents and rarity probabilities shown before purchase and in the Purchases and refunds notice. Successful fulfilment records all cards and their serials atomically. Opening the reveal displays cards already allocated to the account; a retry does not create extra copies.\n\nMarketplace buying, selling, trading, swaps and offers are disabled at this release. There is no cash withdrawal, peer-to-peer cash transfer or card export outside Docked. No resale value, financial return or future marketplace availability is promised.";
  if (
    r.document === "refund-policy" &&
    r.section === "Approved paid-release products"
  )
    r.text = r.text.replace(
      "with no bonus credits.",
      "with no bonus credits. These Australian dollar prices include 10% GST; no extra GST is added at checkout. No separate charge is made when freely granted test credits are issued.",
    );
  const d = policy.documents.find((d) => d.id === r.document),
    before = r.field
      ? d[r.field]
      : d.sections.find((s) => s.title === r.section);
  assert.equal(hash(JSON.stringify(before)), r.expectedBeforeSha256);
}
writeFileSync(
  dir + "commercial-wording.PROPOSED.json",
  JSON.stringify(
    {
      ...prior,
      approved: false,
      purpose:
        "Final paid-pack launch proposal, no marketplace. Apply only under final exact public-runtime/launch approval; do not reapprove existing phone disclosures.",
      requiresMarketplaceGateForMarketplaceStatus: false,
      requiresUpdatedGoogleReviewAssessment: false,
      googleReviewAssessment:
        "No Android binary, data-category or phone-disclosure change in these availability/price/pack amendments. Existing ready-to-publish v31 and phone Data Safety retained; reassess only if actual submission changes.",
      replacements: changes,
    },
    null,
    2,
  ) + "\n",
);
writeFileSync(
  dir + "COMMERCIAL_WORDING.txt",
  "PROPOSED, NOT PUBLISHED. Existing phone privacy text and Data Safety remain unchanged.\nNew commercial consent version/date must be frozen in the release package; copying old consents does not accept new notices.\n\n" +
    changes
      .map(
        (r) => `${r.document} — ${r.title ?? r.section ?? r.field}\n${r.text}`,
      )
      .join("\n\n") +
    "\n",
);
console.log(
  JSON.stringify({
    changes: changes.length,
    productionWrites: 0,
    marketplace: "disabled",
    phonePrivacy: "unchanged",
  }),
);
