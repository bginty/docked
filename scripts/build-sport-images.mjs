import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, realpath, writeFile, lstat } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Reuse the lockfile-pinned Sharp supplied by Next; no separate installation.
const require = createRequire(import.meta.url);
const nextRequire = createRequire(require.resolve("next/package.json"));
const sharp = nextRequire("sharp");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mastersDirectory = path.join(root, "public", "images", "sports");
const derivativeDirectory = path.join(mastersDirectory, "responsive");
const registryDirectory = path.join(root, "src", "content");
const requestedWidths = [320, 480, 640, 960, 1280];
const quality = 75;
const checkOnly = process.argv.includes("--check");
assert(
  process.argv.slice(2).every((arg) => arg === "--check"),
  "Only --check is supported",
);
const hash = (buffer) => createHash("sha256").update(buffer).digest("hex");
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const canonical = (value) =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, canonical(value[key])]),
        )
      : value;

async function exactWrite(directory, filename, buffer) {
  assert(/^[a-z0-9][a-z0-9.-]*$/.test(filename), "Invalid output filename");
  const target = path.join(directory, filename);
  assert.equal(
    path.dirname(target),
    directory,
    "Output must stay in its exact directory",
  );
  assert.equal(
    await realpath(directory),
    directory,
    "Output directory must not redirect through a link",
  );
  const existing = await lstat(target).catch((error) => {
    if (error.code !== "ENOENT") throw error;
    return null;
  });
  assert(
    !existing || existing.isFile(),
    "Output must be a regular file, never a link",
  );
  await writeFile(target, buffer);
}

const sourceManifestBytes = await readFile(
  path.join(mastersDirectory, "manifest.json"),
);
const sourceManifest = JSON.parse(sourceManifestBytes);
assert(
  Array.isArray(sourceManifest.assets) && sourceManifest.assets.length === 12,
  "Expected 12 approved masters",
);
const assets = [...sourceManifest.assets].sort((a, b) =>
  a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
);
assert.equal(
  new Set(assets.map((asset) => asset.slug)).size,
  assets.length,
  "Duplicate master slug",
);

// Validate every source before writing anything; recorded masters are immutable inputs.
const masters = [];
for (const asset of assets) {
  assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(asset.slug), "Invalid master slug");
  assert.equal(
    asset.path,
    `/images/sports/${asset.slug}.webp`,
    "Unexpected master path",
  );
  const bytes = await readFile(
    path.join(mastersDirectory, `${asset.slug}.webp`),
  );
  assert.equal(
    hash(bytes),
    asset.sha256,
    `Master hash mismatch: ${asset.slug}`,
  );
  assert.equal(
    bytes.length,
    asset.bytes,
    `Master size mismatch: ${asset.slug}`,
  );
  const metadata = await sharp(bytes, { failOn: "warning" }).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, asset.width);
  assert.equal(metadata.height, asset.height);
  await sharp(bytes, { failOn: "warning" }).raw().toBuffer();
  masters.push({ asset, bytes });
}

const sizes = {};
const derivatives = [];
if (!checkOnly) await mkdir(derivativeDirectory, { recursive: true });
for (const { asset, bytes } of masters) {
  const widths = requestedWidths.filter((width) => width < asset.width);
  sizes[asset.path] = { width: asset.width, widths: [...widths, asset.width] };
  for (const width of widths) {
    const filename = `${asset.slug}-${width}.webp`;
    const outputPath = path.join(derivativeDirectory, filename);
    const output = checkOnly
      ? await readFile(outputPath)
      : await sharp(bytes, { failOn: "warning" })
          .resize({ width, withoutEnlargement: true })
          .webp({ quality, effort: 6 })
          .toBuffer();
    const metadata = await sharp(output, { failOn: "warning" }).metadata();
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, width);
    assert(
      Math.abs(metadata.height - (asset.height * width) / asset.width) <= 1,
      "Aspect ratio exceeds one-pixel rounding tolerance",
    );
    await sharp(output, { failOn: "warning" }).raw().toBuffer();
    if (!checkOnly) await exactWrite(derivativeDirectory, filename, output);
    derivatives.push({
      path: `/images/sports/responsive/${filename}`,
      master: asset.path,
      masterSha256: asset.sha256,
      width,
      height: metadata.height,
      bytes: output.length,
      sha256: hash(output),
      quality,
    });
  }
}

const manifest = {
  version: 1,
  sourceManifest: "/images/sports/manifest.json",
  sourceManifestSha256: hash(JSON.stringify(canonical(sourceManifest))),
  sourceManifestHashEncoding:
    "UTF-8 canonical JSON: recursively sorted object keys, original array order, no whitespace",
  transformation:
    "Aspect-preserving downscale and WebP encoding only; no crop, recolour, compositing or upscaling",
  provenance:
    "Every derivative inherits its master photograph licence or AI-generated origin, credit and usage notes",
  encoder: {
    sharp: sharp.versions.sharp,
    libvips: sharp.versions.vips,
    webp: sharp.versions.webp,
    quality,
    effort: 6,
  },
  derivatives,
};
if (checkOnly) {
  assert.deepEqual(
    JSON.parse(
      await readFile(
        path.join(registryDirectory, "sport-image-sizes.json"),
        "utf8",
      ),
    ),
    sizes,
    "Size registry differs",
  );
  assert.deepEqual(
    JSON.parse(
      await readFile(
        path.join(mastersDirectory, "responsive-manifest.json"),
        "utf8",
      ),
    ),
    manifest,
    "Derivative manifest/hash differs",
  );
} else {
  await exactWrite(registryDirectory, "sport-image-sizes.json", json(sizes));
  await exactWrite(
    mastersDirectory,
    "responsive-manifest.json",
    json(manifest),
  );
}
// The original manifest and all masters must still match after generation.
assert.deepEqual(
  await readFile(path.join(mastersDirectory, "manifest.json")),
  sourceManifestBytes,
);
for (const { asset } of masters)
  assert.equal(
    hash(await readFile(path.join(mastersDirectory, `${asset.slug}.webp`))),
    asset.sha256,
  );
console.log(
  `${checkOnly ? "Verified" : "Generated and verified"} ${derivatives.length} responsive images from ${masters.length} unchanged masters.`,
);
