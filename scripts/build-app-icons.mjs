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

const res = "android/app/src/main/res";
const tokens = JSON.parse(readFileSync("src/brand/brand-tokens.json", "utf8"));
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
  const liveBeta = process.env.CAPACITOR_LIVE_BETA === "true";
  const fantasy = true;
  if (fantasy && !liveBeta)
    save("public/brand/docked/offline.html", renderPublicOfflineShell());
  const master = "public/brand/docked/icons/docked-icon-512.png";

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
    "Generated platform sizes from the supplied fantasy card raster assets.",
  );
}
