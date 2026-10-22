import { test } from "node:test";
import assert from "node:assert/strict";
import {
  teamColourCatalogue,
  teamColours,
} from "../../src/core/sport-team-colours";
import {
  jerseyPresentation,
  displayCity,
} from "../../src/core/card-presentation";

test("all team palettes resolve by stable identity without alias collisions", () => {
  const counts = { afl: 18, nrl: 17, basketball: 30, football: 23 };
  for (const [sport, count] of Object.entries(counts)) {
    assert.equal(
      teamColourCatalogue.filter((t) => t.sport === sport).length,
      count,
    );
  }
  const seen = new Set<string>();
  for (const team of teamColourCatalogue) {
    assert.match(team.primary, /^#[0-9a-f]{6}$/);
    assert.match(team.accent, /^#[0-9a-f]{6}$/);
    assert.notEqual(team.primary, team.accent);
    for (const alias of [team.id, team.key, team.name, ...team.aliases]) {
      const identity = `${team.sport}:${alias.toLowerCase()}`;
      assert.equal(seen.has(identity), false, identity);
      seen.add(identity);
      assert.equal(
        teamColours(team.sport, ` ${alias.toUpperCase()} `)?.id,
        team.id,
      );
      const p = jerseyPresentation({ sport: team.sport, team: alias });
      assert.equal(p.primary, team.primary);
      assert.equal(p.accent, team.accent);
      assert.equal(p.number, "—");
    }
  }
});

test("colours never use city, fuzzy name, numeric provider ID or another sport", () => {
  for (const team of [
    "Los Angeles",
    "Manchester",
    "London",
    "123",
    "Unknown",
    "Arsenal QA",
  ]) {
    for (const sport of ["afl", "nrl", "basketball", "football"]) {
      assert.equal(teamColours(sport, team), undefined);
    }
  }
  assert.equal(teamColours("football", "LAL"), undefined);
  assert.notEqual(
    teamColours("afl", "BRI")?.primary,
    teamColours("nrl", "BRI")?.primary,
  );
  assert.notEqual(
    teamColours("football", "MCI")?.primary,
    teamColours("football", "MUN")?.primary,
  );
  assert.notEqual(
    teamColours("basketball", "LAL")?.primary,
    teamColours("basketball", "LAC")?.primary,
  );
  assert.equal(
    displayCity({ sport: "football", team: "ARS" }),
    "Location unavailable",
  );
});

test("saved palettes and player identity remain unchanged; retained clubs still render", () => {
  const card = Object.freeze({
    sport: "football",
    team: "Arsenal",
    colour: "#123456",
    accentColour: "#abcdef",
    verifiedJerseyNumber: 7,
  });
  assert.deepEqual(jerseyPresentation(card), {
    primary: "#123456",
    accent: "#abcdef",
    number: "7",
  });
  assert.equal(
    jerseyPresentation({ ...card, accentColour: undefined }).accent,
    "#9fc7e2",
  );
  assert.equal(
    jerseyPresentation({ sport: "football", team: "WHU" }).primary,
    "#7a263a",
  );
  assert.equal(
    jerseyPresentation({ sport: "nfl", team: "KC" }).primary,
    "#e31837",
  );
  assert.equal(
    jerseyPresentation({ sport: "nfl", team: "CAR" }).primary,
    "#0085ca",
  );
  assert.equal(
    jerseyPresentation({ sport: "afl", team: "CAR" }).primary,
    "#031a29",
  );
});
