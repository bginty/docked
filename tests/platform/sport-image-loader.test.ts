import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { sportImageLoader } from "../../src/core/sport-image-loader";
import imageSizes from "../../src/content/sport-image-sizes.json";

test("registered sport photos select the next generated size and fall back to their native asset", () => {
  const registrations = Object.entries(imageSizes);
  assert.ok(registrations.length >= 12);
  for (const [src, asset] of registrations) {
    const sizes = [...new Set([...asset.widths, asset.width])].sort(
      (a, b) => a - b,
    );
    for (const requested of [1, ...sizes, ...sizes.map((size) => size + 1)]) {
      const selected = sizes.find((size) => size >= requested) ?? asset.width;
      const expected =
        selected === asset.width
          ? src
          : src.replace(/\/([^/]+)\.webp$/, `/responsive/$1-${selected}.webp`);
      const result = sportImageLoader({ src, width: requested });
      assert.equal(result, expected, `${src} at ${requested}px`);
      assert.ok(
        existsSync(path.join(process.cwd(), "public", result)),
        `Generated image exists: ${result}`,
      );
      assert.ok(!result.includes("/_next/image"));
    }
    assert.equal(sportImageLoader({ src, width: asset.width }), src);
    assert.equal(sportImageLoader({ src, width: asset.width * 4 }), src);
  }
});

test("sport image loading rejects remote, unregistered, transformed and traversal sources", () => {
  for (const src of [
    "https://example.com/photo.webp",
    "//example.com/photo.webp",
    "data:image/webp;base64,abc",
    "/images/sports/unregistered.webp",
    "/images/sports/../football.webp",
    "/images/sports/%2e%2e/football.webp",
    "/images/sports/football.webp?width=320",
    "/images/sports/football.webp#fragment",
    "/images/sports/responsive/football-320.webp",
    "__proto__",
  ]) {
    assert.throws(
      () => sportImageLoader({ src, width: 320 }),
      /registered local asset/,
      src,
    );
  }
});

test("sport image loading rejects invalid dimensions instead of constructing invalid URLs", () => {
  const src = Object.keys(imageSizes)[0];
  assert.ok(src);
  for (const width of [
    0,
    -1,
    1.5,
    NaN,
    Infinity,
    -Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    "640" as unknown as number,
  ]) {
    assert.throws(
      () => sportImageLoader({ src, width }),
      /positive safe integer/,
    );
  }
});
