import assert from "node:assert/strict";
import test from "node:test";
import {
  cinemaEligible,
  cinemaProfiles,
} from "../../src/components/pack-cinema-v2-model";
test("all six receipt tiers use V3 for NFL/AFL/NRL; hidden sports stay unchanged", () => {
  for (const sport of ["nfl", "afl", "nrl"])
    for (const tier of Object.keys(cinemaProfiles))
      assert.equal(cinemaEligible(sport, tier), true);
  for (const sport of ["basketball", "nba", "nbl", "", undefined])
    assert.equal(cinemaEligible(sport, "ICON"), false);
  for (const tier of ["constructor", "unknown", undefined])
    assert.equal(cinemaEligible("afl", tier), false);
  const profiles = Object.values(cinemaProfiles);
  for (let i = 1; i < profiles.length; i++) {
    assert(profiles[i].particles > profiles[i - 1].particles);
    assert(profiles[i].rings > profiles[i - 1].rings);
    assert(
      profiles[i].timing.rarity + profiles[i].timing.flip >
        profiles[i - 1].timing.rarity + profiles[i - 1].timing.flip,
    );
  }
  assert.equal(cinemaProfiles.LEGENDARY.particles, 155);
  assert.equal(cinemaProfiles.ICON.particles, 210);
});
