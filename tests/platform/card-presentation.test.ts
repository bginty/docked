import { test } from "node:test";
import assert from "node:assert/strict";
import {
  jerseyPresentation,
  fullTeamName,
  displayCity,
} from "../../src/core/card-presentation";
test("NFL legacy placeholder numbers are never presented as verified jerseys", () => {
  assert.equal(
    jerseyPresentation({ sport: "nfl", team: "KC", shirt: 1 }).number,
    "—",
  );
  assert.equal(
    jerseyPresentation({ sport: "nfl", team: "KC", verifiedJerseyNumber: 0 })
      .number,
    "0",
  );
  assert.equal(
    jerseyPresentation({ sport: "nfl", verifiedJerseyNumber: 100 }).number,
    "—",
  );
  assert.equal(
    jerseyPresentation({ sport: "nfl", verifiedJerseyNumber: NaN }).number,
    "—",
  );
});
test("new-sport names and cities use frozen metadata and two unbranded colours", () => {
  for (const sport of ["afl", "nrl", "basketball", "football"]) {
    const card = {
      sport,
      team: "fixture-club",
      city: "Sydney",
      colour: "#123456",
      accentColour: "#abcdef",
      verifiedJerseyNumber: 7,
    };
    assert.equal(displayCity(card), "Sydney");
    assert.equal(
      displayCity({ sport, team: "Sydney fictional club" }),
      "Location unavailable",
    );
    assert.deepEqual(jerseyPresentation(card), {
      primary: "#123456",
      accent: "#abcdef",
      number: "7",
    });
    assert.equal(
      jerseyPresentation({
        ...card,
        accentColour: "url(https://example.invalid)",
      }).accent,
      "#9fc7e2",
    );
  }
  assert.equal(
    displayCity({ sport: "nfl", team: "KC", city: "wrong" }),
    "Kansas City",
  );
});
test("current-team presentation has a stable fallback and does not modify card identity", () => {
  const card = {
    sport: "nfl",
    team: "NYG",
    shirt: 1,
    id: "owned",
    serial: 17,
    edition_team: "KC",
  };
  const before = structuredClone(card);
  assert.notEqual(
    jerseyPresentation(card).primary,
    jerseyPresentation({ ...card, team: "KC" }).primary,
  );
  assert.deepEqual(
    jerseyPresentation({ sport: "nfl", team: "unknown" }),
    jerseyPresentation({ sport: "nfl" }),
  );
  assert.deepEqual(card, before);
  assert.equal(
    jerseyPresentation({ sport: "football", shirt: 12 }).number,
    "12",
  );
});

test("full NFL team names preserve unknown data without inventing a club", () => {
  assert.equal(
    fullTeamName({ sport: "nfl", team: "PIT" }),
    "Pittsburgh Steelers",
  );
  assert.equal(fullTeamName({ sport: "nfl", team: "NYG" }), "New York Giants");
  assert.equal(
    fullTeamName({ sport: "nfl", team: "UNKNOWN" }),
    "Team unavailable",
  );
});
