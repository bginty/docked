import test from "node:test";
import assert from "node:assert/strict";
import { drawPackRarity } from "../../src/core/card-economy";
import { packOdds } from "../../src/core/pack-odds";
import { paidPackOffers } from "../../src/core/paid-pack-catalogue";
import { storePackFixture } from "../fixtures/store-pack-lifecycle";

for (const sport of ["nfl", "afl", "nrl"] as const) {
  test(`${sport}: all six product disclosures match every possible server rarity draw`, () => {
    const economy = storePackFixture(sport).economy!;
    const products = economy.activeProductVersions!.map(
      (id) => economy.products[id],
    );
    assert.equal(products.length, 6);
    for (const offer of paidPackOffers) {
      const product = products.find(
        (p) => p.type === offer.type && p.cards === offer.cards,
      )!;
      assert.equal(product.priceCredits, offer.priceCredits);
      assert.equal(product.sport, sport);
      assert.deepEqual(product.guaranteedSlots, {});
      const disclosure = packOdds(product);
      assert.equal(
        disclosure.rows.reduce((n, row) => n + row.percent, 0),
        100,
      );
      // Exhaust the RNG domain, rather than trusting a flaky sampling tolerance.
      for (let slot = 0; slot < product.cards; slot++) {
        const counts: Record<string, number> = {};
        for (let draw = 0; draw < 10000; draw++) {
          const rarity = drawPackRarity(product, slot, (max) => {
            assert.equal(max, 10000);
            return draw;
          });
          counts[rarity] = (counts[rarity] ?? 0) + 1;
        }
        assert.equal(counts.CORE, undefined);
        assert.deepEqual(
          counts,
          Object.fromEntries(
            disclosure.rows.map((row) => [
              row.rarity,
              Math.round(row.percent * 100),
            ]),
          ),
        );
        if (offer.type === "PREMIUM") {
          assert.equal(counts.RARE, undefined);
          assert.equal(counts.ELITE, undefined);
          assert.match(disclosure.guarantee!, /Ultra Rare or better/);
        }
      }
    }
  });
}
