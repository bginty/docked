import test from "node:test";
import assert from "node:assert/strict";
import {
  collectiblePresentation,
  jerseyPresentation,
  displayCity,
} from "../../src/core/card-presentation";
import { rarityRule, rarities } from "../../src/core/card-rarity";
import { rarityPresentation, rarityStyle } from "../../src/core/rarity-theme";
import { futuristicCard } from "../fixtures/futuristic-data";
test("card presentation is immutable and preserves full names, exact serials and verified locations", () => {
  const card = Object.freeze({ ...futuristicCard });
  const p = collectiblePresentation(card);
  assert.equal(p.given, "Taylor");
  assert.equal(p.family, "McBride");
  assert.equal(p.location, "Arizona");
  assert.equal(p.serial, "#001 / 1");
  assert.equal(
    collectiblePresentation({ ...card, team: "unknown" }).location,
    "",
  );
  assert.equal(
    collectiblePresentation({ ...card, name: "Odell Beckham Jr." }).family,
    "Beckham Jr.",
  );
  assert.equal(
    collectiblePresentation({ ...card, name: "Alex Northbridge-Wellington" })
      .longName,
    true,
  );
  assert.equal(
    collectiblePresentation({ ...card, name: "Single" }).family,
    "Single",
  );
  assert.equal(
    displayCity({ sport: "nfl", team: "New York Giants" }),
    "New York",
  );
  assert.equal(
    displayCity({ sport: "nfl", team: "New England Patriots" }),
    "New England",
  );
  assert.equal(card.team, "ARI");
  assert.equal(card.verifiedJerseyNumber, 85);
});
test("all six materials retain authoritative rarity multipliers and unknown numbers remain absent", () => {
  assert.equal(rarities.length, 6);
  for (const tier of rarities) {
    assert.ok(rarityPresentation(tier).accent);
    assert.ok(rarityStyle(tier));
    assert.ok(rarityRule(tier).multiplierTenths);
  }
  for (const verifiedJerseyNumber of [undefined, null, -1, 100, 1.5, NaN])
    assert.equal(
      jerseyPresentation({ sport: "nfl", shirt: 99, verifiedJerseyNumber })
        .number,
      "—",
    );
  assert.equal(
    jerseyPresentation({ sport: "nfl", verifiedJerseyNumber: 0 }).number,
    "0",
  );
});
