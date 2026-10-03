import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { encodeCommunityImage } from "../../src/server/community-image";

test("community quarantine codec decodes pixels, bounds size and strips private metadata", async () => {
  const source = await sharp({
    create: { width: 2400, height: 1200, channels: 3, background: "#187b79" },
  })
    .withExif({ IFD0: { Artist: "FICTIONAL QA metadata; must be stripped" } })
    .jpeg()
    .toBuffer();
  const encoded = await encodeCommunityImage(source);
  const result = await sharp(encoded.data).metadata();
  assert.equal(result.format, "webp");
  assert.equal(result.width, 2048);
  assert.equal(result.height, 1024);
  assert.equal(result.exif, undefined);
  assert.equal(result.xmp, undefined);
  const small = await sharp({
    create: { width: 144, height: 96, channels: 3, background: "#187b79" },
  })
    .png()
    .toBuffer();
  assert.equal((await encodeCommunityImage(small)).info.width, 144);
});
test("community quarantine rejects malformed, non-raster, oversized-byte and oversized-pixel inputs", async () => {
  await assert.rejects(encodeCommunityImage(Buffer.from("not an image")));
  await assert.rejects(
    encodeCommunityImage(
      Buffer.from(
        '<svg width="1" height="1"><rect width="1" height="1"/></svg>',
      ),
    ),
  );
  await assert.rejects(encodeCommunityImage(Buffer.alloc(5 * 1024 * 1024 + 1)));
  const huge = await sharp({
    create: { width: 4001, height: 4000, channels: 3, background: "#187b79" },
  })
    .png()
    .toBuffer();
  await assert.rejects(encodeCommunityImage(huge));
});
