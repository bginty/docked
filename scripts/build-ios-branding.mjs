import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";
import { containedArtwork } from "./build-app-icons.mjs";
const navy = JSON.parse(readFileSync("src/brand/brand-tokens.json", "utf8"))
  .colors.navy;
const source = "public/brand/docked/icons/docked-icon-512.png";
const assets = "ios/App/App/Assets.xcassets";
// Preserve supplied artwork. No tracing, recolouring or new brand design.
await sharp(source)
  .resize(1024, 1024, { fit: "contain", background: navy })
  .flatten({ background: navy })
  .png()
  .toFile(`${assets}/AppIcon.appiconset/AppIcon-512@2x.png`);
for (const suffix of ["", "-1", "-2"]) {
  writeFileSync(
    `${assets}/Splash.imageset/splash-2732x2732${suffix}.png`,
    await containedArtwork(source, 2732, 2732, 800, 800, navy),
  );
}
console.log(
  "iOS branding generated from approved Docked artwork; Xcode rendering still requires verification.",
);
