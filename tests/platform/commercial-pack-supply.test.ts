import test from "node:test";
import assert from "node:assert/strict";
import { hasRequiredPackSupply } from "../../src/core/commercial-pack-supply";
import {
  commercialPack,
  commercialSports,
} from "../../src/core/commercial-billing";
import { paidPackOffers } from "../../src/core/paid-pack-catalogue";

test("all sport/size variants require distinct supply for every positive-weight rarity", () => {
  for (const sport of commercialSports)
    for (const offer of paidPackOffers) {
      const p = commercialPack(sport, offer.type, offer.cards);
      const supply = Object.entries(p.weights).map(([rarity, weight]) => ({
        rarity,
        players: weight ? offer.cards : 0,
      }));
      const unchanged = structuredClone(p);
      assert.equal(hasRequiredPackSupply(p, supply), true);
      for (const exhausted of supply.filter(
        (s) => p.weights[s.rarity as keyof typeof p.weights] > 0,
      )) {
        assert.equal(
          hasRequiredPackSupply(
            p,
            supply.map((s) =>
              s.rarity === exhausted.rarity
                ? { ...s, players: offer.cards - 1 }
                : s,
            ),
          ),
          false,
        );
      }
      assert.deepEqual(p, unchanged);
    }
});

test("missing, fractional or invalid supply cannot satisfy a required rarity", () => {
  const p = commercialPack("afl", "PREMIUM", 1);
  const supply = [
    { rarity: "ULTRA_RARE", players: 1 },
    { rarity: "LEGENDARY", players: 1 },
  ];
  assert.equal(hasRequiredPackSupply(p, supply), false);
  for (const players of [-1, 0.5, NaN, Infinity])
    assert.equal(
      hasRequiredPackSupply(p, [...supply, { rarity: "ICON", players }]),
      false,
    );
  assert.equal(
    hasRequiredPackSupply(p, [...supply, { rarity: "ICON", players: 1 }]),
    true,
  );
});
