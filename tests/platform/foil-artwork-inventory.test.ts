import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import sharp, { type Metadata } from "sharp";
import {
  finishedFoilPack,
  foilArtworkVariants,
} from "../../src/core/foil-pack-artwork";
import catalogue from "../../design/foil-pack-rollout/catalogue-inventory.json";
import assets from "../../design/foil-pack-rollout/asset-inventory.json";

test("Production catalogue coverage includes all 18 paid and three existing Starter variants", async () => {
  const expected = [
    ...catalogue.paid.map((p) => `${p.tier}:${p.sport}:${p.cards}`),
    ...catalogue.starter.map((p) => `STARTER:${p.sport}:4`),
  ].sort();
  assert.deepEqual(assets.map((a) => a.key).sort(), expected);
  assert.equal(new Set(expected).size, 21);
  for (const v of foilArtworkVariants) {
    const asset = finishedFoilPack({
      name: v.tier,
      sport: v.sport,
      count: v.count,
      premium: v.tier === "PREMIUM",
      core: v.tier === "STARTER",
    });
    assert.ok(asset);
    for (const width of [240, 480, 800]) {
      const bytes: Buffer = await readFile(
        "public" + asset.src.replace("-800.webp", `-${width}.webp`),
      );
      const meta: Metadata = await sharp(bytes).metadata();
      assert.equal(meta.width, width);
      assert.equal(meta.height, width * 1.5);
      assert.equal(meta.hasAlpha, true);
      assert.ok(
        bytes.length <
          (width === 240 ? 40000 : width === 480 ? 130000 : 300000),
      );
    }
  }
});

test("artwork never invents unavailable sizes or changes hidden NBA", () => {
  for (const sport of ["basketball", "nba", "unknown"])
    assert.equal(
      finishedFoilPack({ name: "Premium", sport, count: 9, premium: true }),
      null,
    );
  for (const count of [0, 2, 4, 7, 10])
    assert.equal(
      finishedFoilPack({ name: "Standard", sport: "nfl", count }),
      null,
    );
  assert.equal(
    finishedFoilPack({ name: "Starter", sport: "afl", count: 9, core: true }),
    null,
  );
  assert.equal(finishedFoilPack({ name: "Unknown historical pack" }), null);
});
