import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";

const output = "artifacts/playstore";
const canonical = JSON.parse(
  readFileSync("src/brand/canonical-logo.json", "utf8"),
);
const brand = JSON.parse(readFileSync("src/brand/brand-tokens.json", "utf8"));
mkdirSync(output, { recursive: true });
// Platform composition only: exact master art is resized, never redrawn/recoloured.
const text = Buffer.from(
  `<svg width="1024" height="500"><rect width="1024" height="500" fill="${brand.colors.navy}"/><text x="352" y="208" fill="white" font-family="Arial,sans-serif" font-size="76" font-weight="700">DOCKED</text><text x="356" y="268" fill="white" font-family="Arial,sans-serif" font-size="27">Sports intelligence.</text><text x="356" y="311" fill="white" font-family="Arial,sans-serif" font-size="27">Community. Transparent records.</text><text x="80" y="445" fill="${brand.colors.coolGray}" font-family="Arial,sans-serif" font-size="19">PREVIEW · Informational analysis. No guaranteed returns.</text></svg>`,
);
const feature = await sharp(text)
  .composite([
    {
      input: await sharp(canonical.source)
        .resize(224, 224, { fit: "contain" })
        .png()
        .toBuffer(),
      top: 120,
      left: 80,
    },
  ])
  .flatten({ background: brand.colors.navy })
  .removeAlpha()
  .png()
  .toBuffer();
const icon = readFileSync("public/brand/icons/docked-app-icon-512.png");
const raw = await sharp(icon).ensureAlpha().raw().toBuffer();
for (let index = 3; index < raw.length; index += 4)
  if (raw[index] !== 255)
    throw new Error(
      "Play icon requires an opaque approved source; do not silently alter the master.",
    );
writeFileSync(`${output}/docked-preview-feature-1024x500.png`, feature);
writeFileSync(`${output}/docked-preview-icon-512.png`, icon);
const files = [];
for (const [name, bytes] of [
  ["docked-preview-feature-1024x500.png", feature],
  ["docked-preview-icon-512.png", icon],
]) {
  const metadata = await sharp(bytes).metadata();
  files.push({
    path: `${output}/${name}`,
    bytes: bytes.length,
    width: metadata.width,
    height: metadata.height,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    opaque: true,
  });
}
writeFileSync(
  `${output}/manifest.json`,
  JSON.stringify(
    {
      status: "DRAFT_OWNER_REVIEW_REQUIRED",
      purpose: "Google Play closed testing only; no upload performed",
      master: canonical.source,
      masterSha256: createHash("sha256")
        .update(readFileSync(canonical.source))
        .digest("hex"),
      files,
    },
    null,
    2,
  ) + "\n",
);
console.log("Prepared two opaque draft Play assets and public hash manifest.");
