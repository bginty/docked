import test from "node:test";
import assert from "node:assert/strict";
import {
  dormantCommercialPool,
  reconcileExcludedTestSupply,
  validateDormantCommercialPool,
} from "../../src/core/commercial-pool-plan";
const player = {
  id: "0058d801-be72-4ba3-ad83-1325b2e8bcfc",
  sport: "afl",
  provider: "wikimedia",
  providerId: "afl:Q20675978",
  snapshot: {
    name: "Ben Keays",
    team: "Adelaide",
    position: "MID",
    season: "2026",
    verifiedJerseyNumber: null,
    colour: "#002b5c",
    status: "active",
    synthetic: false,
  },
  eligiblePositions: ["MID", "FWD"],
  source: {
    url: "https://en.wikipedia.org/wiki/List_of_current_AFL_team_squads?oldid=1346217714",
    hash: "a".repeat(64),
    checkedAt: "2026-10-22T22:17:12.912Z",
    license: "CC-BY-SA-4.0",
    verification: "roster-and-profile-agreement",
    permanentIssuanceEligible: false,
  },
};
test("dormant real roster definitions retain identity, eligibility and source without approval", () => {
  const rows = dormantCommercialPool([player]);
  assert.equal(rows.length, 5);
  assert(!rows.some((r) => r.rarity === "CORE"));
  assert.deepEqual(
    rows.map((r) => r.lifetime_cap),
    [5000, 2500, 400, 50, 1],
  );
  assert(
    rows.every(
      (r) =>
        r.issued === 0 &&
        r.legacy_issued === 0 &&
        !r.approved &&
        !r.snapshot.synthetic,
    ),
  );
  assert.deepEqual(rows[0].snapshot.eligiblePositions, ["MID", "FWD"]);
  assert.deepEqual(dormantCommercialPool([player]), rows);
});
test("dormant import validation rejects bad immutable rows before SQL", () => {
  const rows = dormantCommercialPool([player]);
  validateDormantCommercialPool(rows);
  validateDormantCommercialPool([rows[0]]);
  assert.throws(() => validateDormantCommercialPool([]), /Non-empty/);
  assert.throws(
    () => validateDormantCommercialPool([rows[0], rows[0]]),
    /Duplicate/,
  );
  for (const change of [
    { lifetime_cap: rows[0].lifetime_cap + 1 },
    { approved: true },
    { issued: 1 },
    { legacy_issued: 1 },
    { rights_reference: "unreviewed replacement" },
    { id: "0058d801-be72-4ba3-ad83-1325b2e8bcfc" },
    { rarity: "CORE" },
    { unreviewedExtra: true },
  ])
    assert.throws(
      () => validateDormantCommercialPool([{ ...rows[0], ...change } as never]),
      /differs/,
    );
  assert.throws(
    () =>
      validateDormantCommercialPool([
        rows[0],
        {
          ...rows[1],
          snapshot: { ...rows[1].snapshot, team: "A different team" },
        },
      ]),
    /differs between rarities/,
  );
  assert.throws(() =>
    validateDormantCommercialPool([
      {
        ...rows[0],
        snapshot: { ...rows[0].snapshot, synthetic: true },
      } as never,
    ]),
  );
});
test("duplicate aliases, synthetic identities, NBA and silent eligibility changes fail closed", () => {
  assert.throws(() => dormantCommercialPool([player, player]), /Duplicate/);
  assert.throws(() =>
    dormantCommercialPool([
      { ...player, snapshot: { ...player.snapshot, synthetic: true } },
    ]),
  );
  assert.throws(() =>
    dormantCommercialPool([{ ...player, sport: "basketball" }]),
  );
  assert.throws(
    () => dormantCommercialPool([{ ...player, eligiblePositions: ["FWD"] }]),
    /eligibility/,
  );
});
test("saved TEST_ONLY allocations cannot authorize a zero lifetime baseline", () => {
  assert.equal(
    reconcileExcludedTestSupply([
      { sport: "nfl", rarity: "ICON", instances: 2, matchedTestReceipts: 2 },
    ]).commercialBaseline,
    null,
  );
  assert.throws(
    () =>
      reconcileExcludedTestSupply([
        { sport: "nfl", rarity: "ICON", instances: 2, matchedTestReceipts: 1 },
      ]),
    /Unclassified/,
  );
});
