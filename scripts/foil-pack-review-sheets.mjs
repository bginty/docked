import sharp from "sharp";
import { resolve } from "node:path";

// Mechanical contact sheets of the actual assets and unaltered browser captures.
// No generated UI, retouching, cropping, or replacement content.
const output = resolve("docs/qa/foil-pack-review-20261107");
async function sheet(name, files, labels, width, height) {
  const margin = 18;
  const titleHeight = 44;
  const layers = [];
  for (let index = 0; index < files.length; index++) {
    const left = margin + index * (width + margin);
    layers.push({
      input: Buffer.from(
        `<svg width="${width}" height="${titleHeight}" xmlns="http://www.w3.org/2000/svg"><text x="${width / 2}" y="26" text-anchor="middle" fill="#e6f4ff" font-size="17" font-family="Arial, sans-serif" font-weight="bold">${labels[index]}</text></svg>`,
      ),
      left,
      top: margin,
    });
    layers.push({
      input: await sharp(files[index])
        .resize(width, height, {
          fit: "contain",
          background: "#080e1c",
        })
        .png()
        .toBuffer(),
      left,
      top: margin + titleHeight,
    });
  }
  await sharp({
    create: {
      width: width * files.length + margin * (files.length + 1),
      height: height + titleHeight + margin * 2,
      channels: 4,
      background: "#080e1c",
    },
  })
    .composite(layers)
    .png()
    .toFile(resolve(output, name));
}
await sheet(
  "finished-packs.png",
  [
    "public/brand/docked/packs/foil-v1/standard-afl-9-800.webp",
    "public/brand/docked/packs/foil-v1/premium-nrl-9-800.webp",
  ],
  ["STANDARD · AFL · 9 CARDS", "PREMIUM · NRL · 9 CARDS"],
  400,
  600,
);
await sheet(
  "mobile-store-review.png",
  [
    resolve(output, "chrome-afl-store.jpg"),
    resolve(output, "chrome-nrl-store.jpg"),
  ],
  ["ACTUAL STORE · AFL STANDARD", "ACTUAL STORE · NRL PREMIUM"],
  390,
  844,
);
await sheet(
  "enlarged-opening-review.png",
  [
    resolve(output, "chrome-afl-enlarged.jpg"),
    resolve(output, "chrome-nrl-enlarged.jpg"),
  ],
  ["BEFORE OPENING · AFL", "BEFORE OPENING · NRL"],
  390,
  844,
);
console.log(
  "Created three review sheets from original assets and browser captures.",
);
