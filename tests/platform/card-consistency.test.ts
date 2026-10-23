import { test } from "node:test";
import assert from "node:assert/strict";
import numbers from "../../config/roster-jersey-presentation-v1.json";
import { rosterCardMetadata } from "../../src/core/roster-card-metadata";
import {
  jerseyPresentation,
  displayCity,
} from "../../src/core/card-presentation";
import { teamColourCatalogue } from "../../src/core/sport-team-colours";
test("Verified number overlay preserves player, team, sport and unknown-number boundaries", () => {
  for (const [id, n] of Object.entries(numbers)) {
    assert.equal(
      jerseyPresentation({
        ...rosterCardMetadata(id, n.sport, n.team),
        sport: n.sport,
      }).number,
      n.number,
    );
    assert.deepEqual(rosterCardMetadata(id, "nrl", n.team), {});
    assert.deepEqual(rosterCardMetadata(id, n.sport, "Different team"), {});
  }
  assert.deepEqual(
    rosterCardMetadata("unmapped", "basketball", "Boston Celtics"),
    {},
  );
  assert.equal(
    jerseyPresentation({ sport: "basketball", verifiedJerseyNumber: null })
      .number,
    "—",
  );
  assert.equal(
    jerseyPresentation({
      sport: "basketball",
      verifiedJerseyNumber: 0,
      jerseyNumberText: "00",
    }).number,
    "00",
  );
  assert.equal(
    jerseyPresentation({ sport: "basketball", verifiedJerseyNumber: 0 }).number,
    "0",
  );
  assert.equal(jerseyPresentation({ sport: "nrl", shirt: 7 }).number, "—");
});
test("Every reviewed NBA AFL NRL team has a consistent label; NFL mapping remains unchanged", () => {
  for (const t of teamColourCatalogue.filter((t) => t.sport !== "football")) {
    assert.notEqual(
      displayCity({ sport: t.sport, team: t.name }),
      "Location unavailable",
    );
    assert.equal(
      displayCity({ sport: t.sport, team: t.key }),
      displayCity({ sport: t.sport, team: t.name }),
    );
  }
  assert.equal(
    displayCity({ sport: "basketball", team: "Golden State Warriors" }),
    "Golden State",
  );
  assert.equal(
    displayCity({ sport: "afl", team: "Collingwood" }),
    "Collingwood",
  );
  assert.equal(
    displayCity({ sport: "nrl", team: "Parramatta Eels" }),
    "Parramatta",
  );
  assert.equal(displayCity({ sport: "nfl", team: "HOU" }), "Houston");
});
