// Local review package only. No publishing, no image generation and no changes
// to original screenshots/artwork. Crops are recorded, never stretched.
import sharp from "sharp";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const out = "docs/qa/prelaunch-store-assets";
mkdirSync(out, { recursive: true });
const cards = "docs/qa/futuristic-cards/browser-1792151829916";
const social = "docs/qa/prelaunch/experience-1792153750630";
const sources = [
  {
    source: `${cards}/collection-412.png`,
    name: "phone-collection-SYNTHETIC-REVIEW.png",
    device: "Phone viewport",
    top: 0,
    maxHeight: 824,
  },
  {
    source: `${social}/post-preview-412.png`,
    name: "phone-post-preview-SYNTHETIC-REVIEW.png",
    device: "Phone viewport",
    top: 76,
    maxHeight: 824,
  },
  {
    source: `${cards}/collection-1024.png`,
    name: "tablet-collection-SYNTHETIC-REVIEW.png",
    device: "Tablet viewport",
    top: 0,
    maxHeight: 2048,
  },
  {
    source: `${cards}/detail-1024.png`,
    name: "tablet-detail-SYNTHETIC-REVIEW.png",
    device: "Tablet viewport",
    top: 0,
    maxHeight: 2048,
  },
];
const hash = (file) =>
  createHash("sha256").update(readFileSync(file)).digest("hex");
const screenshots = [];
for (const s of sources) {
  const m = await sharp(s.source).metadata();
  const crop = {
    left: 0,
    top: s.top,
    width: m.width,
    height: Math.min(s.maxHeight, m.height - s.top),
  };
  await sharp(s.source)
    .extract(crop)
    .removeAlpha()
    .png()
    .toFile(`${out}/${s.name}`);
  const result = await sharp(`${out}/${s.name}`).metadata();
  const dimensionsPass =
    Math.min(result.width, result.height) >= 320 &&
    Math.max(result.width, result.height) <= 3840 &&
    Math.max(result.width, result.height) <=
      2 * Math.min(result.width, result.height) &&
    !result.hasAlpha;
  if (!dimensionsPass) throw Error(`Invalid screenshot dimensions: ${s.name}`);
  screenshots.push({
    ...s,
    crop,
    width: result.width,
    height: result.height,
    sourceSha256: hash(s.source),
    sha256: hash(`${out}/${s.name}`),
    dimensionsPass,
    publicationReady: false,
    scope:
      "Actual rendered shared components in synthetic local browser fixtures; not native or hosted acceptance. QA navigation/data may differ from production. Do not upload as final store screenshots.",
  });
}
const iconSource = "public/brand/docked/icons/docked-icon-512.png";
copyFileSync(iconSource, `${out}/docked-icon-original-REVIEW.png`);
const icon = await sharp(iconSource).metadata();
const manifest = {
  status: "LOCAL_REVIEW_ONLY_NOT_FOR_UPLOAD",
  checkedAt: "2026-10-16",
  policySource:
    "https://support.google.com/googleplay/android-developer/answer/9866151?hl=en",
  screenshots,
  icon: {
    source: iconSource,
    file: "docked-icon-original-REVIEW.png",
    width: icon.width,
    height: icon.height,
    hasAlpha: icon.hasAlpha,
    sha256: hash(iconSource),
    changed: false,
    decision:
      "Original Docked mark retained; baked-in rounded/glowing frame and PNG format require store icon-spec review. No automatic approval.",
  },
  featureGraphic: {
    status: "PREPARED_FOR_OWNER_REVIEW",
    requiredDimensions: "1024x500",
    file: "feature-graphic-review.png",
    editableSource: "feature-graphic-review.html",
    provenance: "feature-graphic-provenance.json",
    publicationReady: false,
    decision:
      "Original CSS geometry with existing unchanged Docked wordmark and approved tagline. No fake app UI, scores, team marks or financial claims. Requires owner/store review.",
  },
  ownerComparison: {
    before: "../prelaunch-owner/before-c588d793",
    after: "../prelaunch-owner/browser-1792154014484",
    scope:
      "Owner-only synthetic evidence, excluded from customer store screenshot set.",
  },
  pending: [
    "Capture actual approved Android build",
    "Remove QA-only navigation by capturing real routes, not editing screenshots",
    "Confirm accurate enabled feature set",
    "Owner review of icon/feature graphic",
    "Play Console upload/acceptance",
    "Physical Samsung S24 testing",
  ],
};
writeFileSync(`${out}/index.json`, JSON.stringify(manifest, null, 2));
writeFileSync(
  `${out}/index.html`,
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Docked store assets — local review</title><style>body{background:#07111f;color:#eef4ff;font:16px system-ui;max-width:1200px;margin:24px auto;padding:16px}a{color:#73c5ff}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px}img{max-width:100%;height:auto}article{border:1px solid #36516c;border-radius:12px;padding:16px}strong{color:#ffd47a}</style><h1>Docked store asset review</h1><p><strong>Synthetic fixtures · local browser screenshots · not approved for upload</strong></p><p>Original artwork and rendered interface retained. Crops are recorded in <a href="index.json">the provenance index</a>. These are not physical Android screenshots. QA-only navigation and synthetic content must be replaced by genuine approved-build captures before submission.</p><div class="grid">${screenshots.map((s) => `<article><h2>${s.device}</h2><p>SYNTHETIC REVIEW · ${s.width} × ${s.height}</p><a href="${s.name}"><img src="${s.name}" alt="Synthetic Docked ${s.device.toLowerCase()} interface review"></a><p>${s.name}</p></article>`).join("")}</div><h2>Owner dashboard comparison — internal only</h2><div class="grid">${["before", "after"].map((s) => `<article><h3>${s}</h3><p>Synthetic owner fixture, not customer marketing.</p><img src="../prelaunch-owner/${s === "before" ? "before-c588d793/owner-before" : "browser-1792154014484/owner"}-1440.png" alt="${s} owner dashboard"></article>`).join("")}</div><h2>Original icon</h2><img width="256" src="docked-icon-original-REVIEW.png" alt="Original Docked card-stack D icon"><p>Unmodified. Store icon design review remains required. Feature graphic prepared below for owner review.</p><h2>Feature graphic — review only</h2><a href="feature-graphic-review.html"><img src="feature-graphic-review.png" alt="Docked: Collect. Compete. Connect. on an original navy geometric background"></a><p>1024 × 500. Existing wordmark preserved. <a href="feature-graphic-provenance.json">Provenance</a>. Not published or store-approved.</p></html>`,
);
console.log(
  JSON.stringify({
    out,
    screenshots: screenshots.length,
    dimensionsPass: true,
    publicationReady: false,
  }),
);
