import test from "node:test";
import assert from "node:assert/strict";
import { nrlJersey, nrlJerseys } from "../../src/core/nrl-jerseys";
import { teamColourCatalogue } from "../../src/core/sport-team-colours";
import { jerseyPresentation } from "../../src/core/card-presentation";
test("17 NRL identities and aliases resolve original palettes; Redcliffe is not a team and numbers require evidence", () => {
  const teams = teamColourCatalogue.filter((t) => t.sport === "nrl");
  assert.equal(teams.length, 17);
  assert.equal(Object.keys(nrlJerseys).length, 17);
  for (const t of teams)
    for (const alias of [t.id, t.key, t.name, ...t.aliases])
      assert.equal(nrlJersey(alias)?.key, t.key);
  assert.equal(nrlJersey("Redcliffe"), undefined);
  assert.equal(nrlJersey("Dolphins")?.key, "DOL");
  assert.notDeepEqual(nrlJersey("BRI"), nrlJersey("MAN"));
  for (const n of [1, 9, 13, 23])
    assert.equal(
      jerseyPresentation({ sport: "nrl", verifiedJerseyNumber: n }).number,
      String(n),
    );
  assert.equal(jerseyPresentation({ sport: "nrl", shirt: 23 }).number, "—");
});
