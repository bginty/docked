import { test } from "node:test";
import assert from "node:assert/strict";
import { aflConfiguration } from "../../src/core/sport-configuration";
import { autoSelect } from "../../src/core/lineup-auto-select";
import { sevenIssues } from "../../src/core/nfl-seven";
import { sandboxConfig } from "../fixtures/multi-sport-db";
test("AFL uses exactly 6/8/6/2, optimiser fills 22 without permutation explosion", () => {
  const cfg = sandboxConfig();
  assert.deepEqual(
    aflConfiguration.groups.map((g) => g.slots.length),
    [6, 8, 6, 2],
  );
  const cards = cfg.slots.flatMap((s, i) =>
    [0, 1, 2].map((v) => ({
      id: `${i}:${v}`,
      player_id: `p${i}`,
      tier: v === 0 ? "CORE" : "RARE",
      position: s.positions[0],
      status: "active",
      listed: false,
      value: v === 0 ? i * 100 : i * 100 + 50,
    })),
  );
  const start = performance.now();
  const r = autoSelect(cards, "SALARY_CAP", [], cfg);
  assert.equal(r.picks.length, 22);
  assert.deepEqual(r.missing, []);
  assert.equal(
    sevenIssues("SALARY_CAP", r.picks, cards, true, cfg).errors.length,
    0,
  );
  assert.ok(
    performance.now() - start < 15000,
    "22-slot optimisation must stay bounded",
  );
  assert.equal(
    new Set(r.picks.map((p) => cards.find((c) => c.id === p.card)!.player_id))
      .size,
    22,
  );
  const missing = autoSelect(
    cards.filter((c) => c.position !== "RUC"),
    "OPEN",
    [],
    cfg,
  );
  assert.deepEqual(missing.missing, ["RUCK1", "RUCK2"]);
  assert.equal(aflConfiguration.publicEnabled, false);
  assert.equal(aflConfiguration.salaryCap, null);
});
