import test from "node:test";
import assert from "node:assert/strict";
import { aflJersey, aflJerseys } from "../../src/core/afl-jerseys";
import { teamColourCatalogue } from "../../src/core/sport-team-colours";
import { jerseyPresentation } from "../../src/core/card-presentation";
test("18 approved AFL templates resolve stable keys and explicit aliases without ambiguous identity matching", () => {
  const teams = teamColourCatalogue.filter((t) => t.sport === "afl");
  assert.equal(Object.keys(aflJerseys).length, 18);
  assert.equal(teams.length, 18);
  assert.deepEqual(
    teams
      .filter((t) => aflJersey(t.key)?.wedge)
      .map((t) => t.key)
      .sort(),
    ["ADE", "BRI", "GWS", "POR", "STK", "WBD"].sort(),
  );
  for (const t of teams)
    for (const alias of [t.id, t.key, t.name, ...t.aliases])
      assert.equal(aflJersey(alias)?.key, t.key);
  assert.equal(aflJersey("Melbourne suburbs"), undefined);
  assert.equal(aflJersey("afl:unknown"), undefined);
  assert.equal(aflJersey("BRI")?.upper, "#0646bb");
  assert.equal(aflJersey("STK")?.upper, "#111214");
  for (const n of [0, 1, 9, 23, 99])
    assert.equal(
      jerseyPresentation({ sport: "afl", verifiedJerseyNumber: n }).number,
      String(n),
    );
  assert.equal(jerseyPresentation({ sport: "afl", shirt: 23 }).number, "—");
  assert.equal(jerseyPresentation({ sport: "nrl", shirt: 1 }).number, "—");
  assert.deepEqual(
    jerseyPresentation({ sport: "nfl", team: "HOU", verifiedJerseyNumber: 5 }),
    { primary: "#03202f", accent: "#a71930", number: "5" },
  );
});
