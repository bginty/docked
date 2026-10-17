import { test } from "node:test";
import assert from "node:assert/strict";
import { nflEconomyCatalogue } from "../../src/core/economy-catalogue";
const rows = Array.from({ length: 128 }, (_, i) => ({
  gsis_id: `00-${String(i).padStart(7, "0")}`,
  full_name: `Synthetic ${i}`,
  position: i % 5 ? "QB" : "K",
  team: `T${i % 32}`,
  status: "ACT",
  week: "6",
}));
const at = "2026-10-12T00:00:00Z";
test("current roster mapping preserves established identities and excludes unsupported kickers", () => {
  const p = nflEconomyCatalogue(
    [{ id: "existing-identity", provider_id: rows[1].gsis_id }],
    rows,
    at,
    "raw",
  );
  assert.equal(p[0].id, "existing-identity");
  assert.equal(p[0].position, "QB");
  assert.ok(p.every((player) => player.position !== "K"));
  const changed = rows.map((r) => ({
    ...r,
    team: r.team === "T1" ? "T2" : r.team === "T2" ? "T1" : r.team,
  }));
  assert.deepEqual(
    nflEconomyCatalogue([], rows, at, "raw").map((p) => p.id),
    nflEconomyCatalogue([], changed, at, "raw2").map((p) => p.id),
  );
});
test("conflicting latest roster fails closed; old records cannot override current status", () => {
  assert.throws(
    () =>
      nflEconomyCatalogue(
        [],
        rows.concat({ ...rows[1], status: "RET" }),
        at,
        "raw",
      ),
    /Conflicting/,
  );
  const p = nflEconomyCatalogue(
    [],
    rows.concat({ ...rows[0], week: "5", status: "RET" }),
    at,
    "raw",
  );
  assert.equal(p[0].status, "active");
  assert.throws(
    () => nflEconomyCatalogue([], rows.slice(0, 20), at, "raw"),
    /Complete/,
  );
});
