import test from "node:test";
import assert from "node:assert/strict";
import {
  workspaceSport,
  privateSportWorkspace,
} from "../../src/core/workspace-sport";

test("explicit sport overrides saved preference, including returning to NFL", () => {
  for (const sport of ["nfl", "basketball", "afl", "nrl", "football"]) {
    assert.equal(workspaceSport(sport, "basketball"), sport);
    assert.equal(workspaceSport(undefined, sport), sport);
  }
  assert.equal(workspaceSport(undefined, undefined), "nfl");
  assert.equal(workspaceSport(["afl"], "nrl"), "nrl");
  assert.equal(workspaceSport("invalid", "invalid"), "nfl");
  assert.equal(workspaceSport("__proto__", {}), "nfl");
});

test("only private Play, Cards and Packs use gated client loading; NFL and shared wallet retain server loading", () => {
  for (const sport of ["basketball", "afl", "nrl"]) {
    for (const surface of ["play", "cards", "packs"])
      assert(privateSportWorkspace(surface, sport));
    for (const surface of ["wallet", "profile", "social"])
      assert.equal(privateSportWorkspace(surface, sport), false);
  }
  for (const sport of ["nfl", "football", "invalid"]) {
    for (const surface of ["play", "cards", "packs"])
      assert.equal(privateSportWorkspace(surface, sport), false);
  }
});
