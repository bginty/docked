import sharp from "sharp";
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { renderPublicOfflineShell } from "./build-mobile-shell.mjs";

const pack = "public/brand";
const res = "android/app/src/main/res";
const tokens = JSON.parse(readFileSync("src/brand/brand-tokens.json", "utf8"));
const canonical = JSON.parse(
  readFileSync("src/brand/canonical-logo.json", "utf8"),
);
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

// Only contain/resize the supplied raster. Never trace, recolor, trim or redraw it.
export async function containedArtwork(
  source,
  width,
  height,
  maxWidth,
  maxHeight,
  background = transparent,
) {
  const artwork = await sharp(source)
    .resize({ width: maxWidth, height: maxHeight, fit: "inside" })
    .png()
    .toBuffer();
  return sharp({ create: { width, height, channels: 4, background } })
    .composite([{ input: artwork, gravity: "centre" }])
    .png()
    .toBuffer();
}
function save(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  if (existsSync(path) && readFileSync(path).equals(Buffer.from(data))) return;
  writeFileSync(path, data);
}
function copy(source, destination) {
  mkdirSync(dirname(destination), { recursive: true });
  if (
    existsSync(destination) &&
    readFileSync(source).equals(readFileSync(destination))
  )
    return;
  copyFileSync(source, destination);
}

export async function buildAppIcons() {
  const fantasy = process.env.FANTASY_CARDS_PREVIEW === "true";
  const master = fantasy
    ? "public/brand/docked/icons/docked-icon-512.png"
    : canonical.source;
  if (!fantasy) {
    copy(master, `public${canonical.master}`);
    save("public/offline.html", renderPublicOfflineShell());
    // Preserve the supplied exports byte-for-byte where the required size exists.
    for (const size of [192, 512])
      copy(
        `${pack}/icons/docked-app-icon-${size}.png`,
        `public/icons/docked-${size}.png`,
      );
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><image width="1024" height="1024" href="data:image/png;base64,${readFileSync(master).toString("base64")}"/></svg>`;
    save("public/icons/docked.svg", svg);
    save("src/app/icon.svg", svg);
    copy(`${pack}/icons/docked-app-icon-180.png`, "src/app/apple-icon.png");
    // An ICO container with the exact approved 32px PNG, without tracing artwork.
    const icoPng = readFileSync(`${pack}/icons/docked-app-icon-32.png`);
    const ico = Buffer.alloc(22);
    ico.writeUInt16LE(1, 2);
    ico.writeUInt16LE(1, 4);
    ico[6] = 32;
    ico[7] = 32;
    ico.writeUInt16LE(1, 10);
    ico.writeUInt16LE(32, 12);
    ico.writeUInt32LE(icoPng.length, 14);
    ico.writeUInt32LE(22, 18);
    save("public/favicon.ico", Buffer.concat([ico, icoPng]));
    const socialText = Buffer.from(
      `<svg width="1200" height="630"><rect width="1200" height="630" fill="${tokens.colors.navy}"/><text x="440" y="280" fill="white" font-family="Arial,sans-serif" font-size="94" font-weight="700">DOCKED</text><text x="444" y="350" fill="white" font-family="Arial,sans-serif" font-size="28">BUILT FOR AN EDGE</text><text x="80" y="530" fill="white" font-family="Arial,sans-serif" font-size="25">Sports analysis and community · No guaranteed returns</text></svg>`,
    );
    save(
      `public${canonical.social}`,
      await sharp(socialText)
        .composite([
          {
            input: await sharp(master).resize(280, 280).png().toBuffer(),
            left: 80,
            top: 150,
          },
        ])
        .png()
        .toBuffer(),
    );
    // The entire square master fits inside the PWA maskable safe circle.
    save(
      "public/icons/docked-maskable-512.png",
      await containedArtwork(master, 512, 512, 280, 280, tokens.colors.navy),
    );
  }
  copy(master, `${res}/drawable-nodpi/docked_launcher.png`);
  copy(master, `${res}/drawable-nodpi/docked_wordmark.png`);
  // Android foreground: approved standalone artwork in the 66/108 safe area.
  const foreground = await containedArtwork(master, 432, 432, 180, 180);
  save(`${res}/drawable-nodpi/docked_mark_raster.png`, foreground);
  // Android 12 splash: all artwork fits within the 192/288 circular safe zone.
  save(
    `${res}/drawable-nodpi/docked_splash_mark_raster.png`,
    await containedArtwork(master, 1152, 1152, 540, 540),
  );
  for (const [density, size, foregroundSize] of [
    ["mdpi", 48, 108],
    ["hdpi", 72, 162],
    ["xhdpi", 96, 216],
    ["xxhdpi", 144, 324],
    ["xxxhdpi", 192, 432],
  ]) {
    const icon = await sharp(master)
      .resize(size, size, { fit: "contain" })
      .png()
      .toBuffer();
    for (const name of ["ic_launcher", "ic_launcher_round"])
      save(`${res}/mipmap-${density}/${name}.png`, icon);
    save(
      `${res}/mipmap-${density}/ic_launcher_foreground.png`,
      await sharp(foreground).resize(foregroundSize).png().toBuffer(),
    );
  }
  for (const [folder, width, height] of [
    ["drawable", 480, 320],
    ["drawable-land-mdpi", 480, 320],
    ["drawable-land-hdpi", 800, 480],
    ["drawable-land-xhdpi", 1280, 720],
    ["drawable-land-xxhdpi", 1600, 960],
    ["drawable-land-xxxhdpi", 1920, 1280],
    ["drawable-port-mdpi", 320, 480],
    ["drawable-port-hdpi", 480, 800],
    ["drawable-port-xhdpi", 720, 1280],
    ["drawable-port-xxhdpi", 960, 1600],
    ["drawable-port-xxxhdpi", 1280, 1920],
  ]) {
    const maxWidth = Math.round(Math.min(width, height) * 0.42);
    save(
      `${res}/${folder}/splash.png`,
      await containedArtwork(
        master,
        width,
        height,
        maxWidth,
        maxWidth,
        tokens.colors.navy,
      ),
    );
  }
  save(
    `${res}/values/colors.xml`,
    `<?xml version="1.0" encoding="utf-8"?>\n<!-- Generated from src/brand/brand-tokens.json. -->\n<resources>\n    <color name="dockedBackground">${tokens.colors.navy}</color>\n    <color name="colorPrimary">${tokens.colors.blue}</color>\n    <color name="colorPrimaryDark">${tokens.colors.navy}</color>\n    <color name="colorAccent">${tokens.colors.mint}</color>\n</resources>\n`,
  );
  save(
    `${res}/values/ic_launcher_background.xml`,
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${tokens.colors.navy}</color>\n</resources>\n`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await buildAppIcons();
  console.log(
    "Generated platform sizes from the approved Edge Signal raster assets.",
  );
}
