import assert from "node:assert/strict";
import test from "node:test";
import { cinemaV2Eligible } from "../../src/components/pack-cinema-v2-model";

test("V2 requires design-preview opt-in and one of the two approved prototype rarities", () => {
  for (const sport of ["nfl", "afl", "nrl"]) {
    for (const tier of ["LEGENDARY", "ICON"]) {
      assert.equal(cinemaV2Eligible(true, true, sport, tier), true);
      assert.equal(cinemaV2Eligible(false, true, sport, tier), false);
      assert.equal(cinemaV2Eligible(undefined, true, sport, tier), false);
      assert.equal(cinemaV2Eligible(true, false, sport, tier), false);
    }
    for (const tier of ["CORE", "RARE", "ELITE", "ULTRA_RARE"])
      assert.equal(cinemaV2Eligible(true, true, sport, tier), false);
  }
  for (const sport of ["basketball", "nba", "nbl", "", undefined])
    assert.equal(cinemaV2Eligible(true, true, sport, "ICON"), false);
});
