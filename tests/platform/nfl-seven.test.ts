import { test } from "node:test";
import assert from "node:assert/strict";
import {
  nflSeven,
  salary,
  sevenIssues,
  sevenRules,
} from "../../src/core/nfl-seven";
import { rarityPoints, rarities, rarityRule } from "../../src/core/card-rarity";
import { fantasyProductionAction } from "../../src/core/fantasy-production";
import { randomUUID } from "node:crypto";
const inventory = nflSeven.slots.map((s, i) => ({
  id: String(i),
  player_id: `player-${i}`,
  tier: "CORE",
  position: s.positions[0],
  status: "active",
  listed: false,
}));
const picks = nflSeven.slots.map((s, i) => ({ slot: s.id, card: String(i) }));
test("mandatory seven slots, no kicker or DST; drafts incomplete but entries complete", () => {
  assert.deepEqual(
    nflSeven.slots.map((s) => s.id),
    ["QB1", "RB1", "RB2", "WR1", "WR2", "TE1", "FLEX1"],
  );
  assert.deepEqual(nflSeven.slots.at(-1)?.positions, ["RB", "WR", "TE"]);
  assert.deepEqual(sevenRules().slots, nflSeven.slots);
  assert.equal(
    sevenIssues("OPEN", picks.slice(0, 6), inventory, false).errors.length,
    0,
  );
  assert.ok(
    sevenIssues("OPEN", picks.slice(0, 6), inventory, true).errors.length,
  );
  for (const position of ["K", "DST", "DEF"])
    assert.ok(
      sevenIssues(
        "OPEN",
        picks,
        inventory.map((c, i) => (i ? c : { ...c, position })),
        true,
      ).errors.length,
    );
});
test("salaries, exact cap, overcap, outgoing salary subtraction, Open ignores salary", () => {
  assert.deepEqual(
    rarities.map((r) => salary(r)),
    [500000, 600000, 650000, 700000, 800000, 800000],
  );
  assert.equal(
    sevenIssues("SALARY_CAP", picks, inventory, true).total,
    3500000,
  );
  const exact = inventory.map((c, i) => ({
    ...c,
    tier: ["ICON", "ICON", "ICON", "CORE", "CORE", "CORE", "CORE"][i],
  }));
  assert.equal(sevenIssues("SALARY_CAP", picks, exact, true).total, 4400000);
  assert.equal(sevenIssues("SALARY_CAP", picks, exact, true).errors.length, 0);
  exact[6].tier = "RARE";
  assert.ok(sevenIssues("SALARY_CAP", picks, exact, true).errors.length);
  assert.equal(
    sevenIssues("SALARY_CAP", picks.slice(0, 6), exact).errors.length,
    0,
  );
  const max = inventory.map((c) => ({ ...c, tier: "ICON" }));
  assert.equal(sevenIssues("OPEN", picks, max, true).errors.length, 0);
  assert.equal(sevenIssues("OPEN", picks, max, true).total, 5600000);
  const replacement = { ...inventory[6], id: "replacement", tier: "CORE" };
  assert.equal(
    sevenIssues(
      "SALARY_CAP",
      [...picks.slice(0, 6), { slot: "FLEX1", card: replacement.id }],
      [...exact, replacement],
      true,
    ).total,
    4400000,
  );
});
test("duplicate permanent identity, owner inventory and slot eligibility", () => {
  assert.ok(
    sevenIssues(
      "OPEN",
      picks,
      inventory.map((c, i) =>
        i === 6 ? { ...c, canonical_player_id: inventory[1].player_id } : c,
      ),
      true,
    ).errors.length,
  );
  assert.ok(sevenIssues("OPEN", picks, inventory.slice(1), true).errors.length);
  assert.ok(
    sevenIssues(
      "OPEN",
      [{ slot: "FLEX1", card: "0" }, ...picks.slice(1)],
      inventory,
      true,
    ).errors.length,
  );
});
test("all six multipliers include negative scores and half-away rounding", () => {
  assert.deepEqual(
    rarities.map((r) => rarityPoints(2400, rarityRule(r).multiplierTenths)),
    [2400, 2640, 2880, 3120, 3360, 3600],
  );
  assert.equal(rarityPoints(-5, 15), -8);
  assert.equal(rarityPoints(5, 15), 8);
});
test("API accepts only slot/card/version; cannot forge salary, owner, kickoff, rarity or multiplier", () => {
  const request = {
    action: "seven_draft",
    request_id: randomUUID(),
    payload: {
      competition_id: randomUUID(),
      revision: 0,
      selections: [{ slot: "QB1", card: randomUUID() }],
    },
  };
  assert.ok(fantasyProductionAction.safeParse(request).success);
  for (const field of ["salary", "owner", "kickoff", "rarity", "multiplier"])
    assert.ok(
      !fantasyProductionAction.safeParse({
        ...request,
        payload: {
          ...request.payload,
          selections: [{ ...request.payload.selections[0], [field]: 0 }],
        },
      }).success,
    );
});
