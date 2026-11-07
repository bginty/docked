import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";

const source = "design/foil-pack-rollout";
const target = "public/brand/docked/packs/foil-v2";
const catalogue = JSON.parse(
  await readFile(source + "/catalogue-inventory.json", "utf8"),
);
const variants = [
  ...catalogue.paid.map((p) => ({
    sport: p.sport,
    tier: p.tier,
    count: Number(p.cards),
  })),
  ...catalogue.starter.map((p) => ({
    sport: p.sport,
    tier: "STARTER",
    count: p.cards,
  })),
];
if (variants.length !== 21)
  throw Error("Review catalogue coverage before building");
await mkdir(target, { recursive: true });
const inventory = [];
for (const v of variants) {
  const filename = `${v.tier.toLowerCase()}-${v.sport}-${v.count}`;
  const master = await readFile(`${source}/${filename}-master.png`);
  const meta = await sharp(master).metadata();
  const stats = await sharp(master).stats();
  if (meta.width !== 1024 || meta.height !== 1536 || !meta.hasAlpha)
    throw Error(`Invalid artwork dimensions/alpha: ${filename}`);
  const files = [];
  for (const width of [240, 480, 800]) {
    const path = `${target}/${filename}-${width}.webp`;
    // Resampling/compression only: no re-lettering, cropping or alpha removal.
    await sharp(master)
      .resize({ width })
      .webp({ quality: 86, alphaQuality: 100, effort: 4 })
      .toFile(path);
    const bytes = (await stat(path)).size;
    const saved = await readFile(path);
    files.push({
      path,
      width,
      height: width * 1.5,
      bytes,
      sha256: createHash("sha256").update(saved).digest("hex"),
    });
  }
  inventory.push({
    ...v,
    key: `${v.tier}:${v.sport}:${v.count}`,
    masterSha256: createHash("sha256").update(master).digest("hex"),
    alphaMin: stats.channels[3].min,
    alphaMax: stats.channels[3].max,
    files,
  });
  console.log(filename);
}
await writeFile(
  source + "/asset-inventory.json",
  JSON.stringify(inventory, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      variants: inventory.length,
      images: inventory.flatMap((v) => v.files).length,
      totalBytes: inventory
        .flatMap((v) => v.files)
        .reduce((sum, f) => sum + f.bytes, 0),
      alphaMin: inventory.map((v) => [v.key, v.alphaMin]),
      mobileMaxBytes: Math.max(...inventory.map((v) => v.files[0].bytes)),
    },
    null,
    2,
  ),
);
