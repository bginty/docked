import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { avatarRegion } from "../../src/core/avatar-crop";
import {
  encodeCommunityAvatar,
  avatarThumbnail,
} from "../../src/server/community-image";
import { communityImageMaxBytes } from "../../src/core/community-media";

test("avatar crop stays within decoded image for every position and zoom", () => {
  for (const [w, h] of [
    [640, 320],
    [320, 640],
    [400, 400],
  ])
    for (const x of [0, 0.5, 1])
      for (const y of [0, 0.5, 1])
        for (const zoom of [1, 2, 3]) {
          const r = avatarRegion(w, h, { x, y, zoom });
          assert.equal(r.width, r.height);
          assert.ok(r.left >= 0 && r.top >= 0);
          assert.ok(r.left + r.width <= w && r.top + r.height <= h);
        }
  assert.deepEqual(avatarRegion(640, 320, { x: 1, y: 0, zoom: 2 }), {
    left: 480,
    top: 0,
    width: 160,
    height: 160,
  });
  for (const crop of [
    { x: -1, y: 0, zoom: 1 },
    { x: 0, y: 2, zoom: 1 },
    { x: 0, y: 0, zoom: 0 },
    { x: 0, y: 0, zoom: 4 },
    { x: 0, y: 0, zoom: 1, approved: true },
  ])
    assert.throws(() => avatarRegion(400, 400, crop));
  assert.throws(() => avatarRegion(1, 1, { x: 0, y: 0, zoom: 1 }));
});
test("JPEG PNG WebP avatar crops become bounded metadata-free 256px WebP", async () => {
  for (const format of ["jpeg", "png", "webp"] as const) {
    const input = await sharp({
      create: { width: 600, height: 400, channels: 3, background: "#1258a0" },
    })
      .withExif({ IFD0: { Artist: "Local fixture metadata" } })
      .toFormat(format)
      .toBuffer();
    const out = await encodeCommunityAvatar(input, { x: 1, y: 1, zoom: 2 });
    const m = await sharp(out.data).metadata();
    assert.equal(m.width, 256);
    assert.equal(m.height, 256);
    assert.equal(m.format, "webp");
    assert.equal(m.exif, undefined);
    assert.equal(
      (await sharp(await avatarThumbnail(input)).metadata()).width,
      256,
    );
  }
});
test("avatar crop rejects malformed files, SVG, excessive pixels/bytes and animation", async () => {
  for (const input of [
    Buffer.from("invalid"),
    Buffer.from('<svg width="100" height="100"></svg>'),
    Buffer.alloc(communityImageMaxBytes + 1),
  ])
    await assert.rejects(
      encodeCommunityAvatar(input, { x: 0.5, y: 0.5, zoom: 1 }),
    );
  const huge = await sharp({
    create: { width: 4001, height: 4000, channels: 3, background: "#000" },
  })
    .png()
    .toBuffer();
  await assert.rejects(
    encodeCommunityAvatar(huge, { x: 0.5, y: 0.5, zoom: 1 }),
  );
  const frames = Buffer.concat([
    Buffer.alloc(100 * 100 * 3, 32),
    Buffer.alloc(100 * 100 * 3, 200),
  ]);
  const animated = await sharp(frames, {
    raw: { width: 100, height: 200, channels: 3, pageHeight: 100 },
  })
    .webp({ loop: 0, delay: [100, 100] })
    .toBuffer();
  assert.equal((await sharp(animated).metadata()).pages, 2);
  await assert.rejects(
    encodeCommunityAvatar(animated, { x: 0.5, y: 0.5, zoom: 1 }),
  );
});
