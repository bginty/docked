import { test } from "node:test";
import assert from "node:assert/strict";
import {
  corroborate,
  transactionAction,
  normalName,
} from "../../scripts/nfl-reconciliation-lib.mjs";
import {
  reviewTestingIdentities,
  type TestingPositionReview,
} from "../../src/server/nfl-testing-identities";

test("official name candidates require stable biographical corroboration; jersey changes do not invent another identity", () => {
  const d = {
    gsis_id: "00-0035298",
    display_name: "Scott Miller",
    college_name: "Bowling Green",
    birth_date: "1997-07-31",
    height: "69",
    weight: "174",
  };
  const r = {
    name: "Scotty Miller",
    profile: "https://www.chicagobears.com/team/players-roster/scotty-miller/",
    checkedAt: "2026-10-17T00:00:00Z",
    headers: ["Player", "#", "Pos", "HT", "WT", "Age", "Exp", "College"],
    cells: [
      "Scotty Miller",
      "82",
      "WR",
      "5-9",
      "174",
      "29",
      "8",
      "Bowling Green",
    ],
  };
  assert.equal(corroborate(d, r), true);
  assert.equal(
    corroborate({ ...d, birth_date: "1968-10-20", college_name: "UCLA" }, r),
    false,
  );
  assert.equal(corroborate({ ...d, gsis_id: "" }, r), false);
  assert.equal(
    corroborate(d, { ...r, cells: r.cells.map((c, i) => (i === 1 ? "" : c)) }),
    true,
  );
});
test("transaction review assigns the named action, not a neighbouring signing or injury", () => {
  const check = (row: string, name: string) =>
    transactionAction(row, [normalName(name)]);
  assert.equal(
    check(
      "Signed QB One. Released QB Two. Placed DT Three on injured reserve.",
      "Two",
    ),
    "released",
  );
  assert.equal(check("Signed QB One. Released QB Two.", "One"), "unresolved");
  assert.equal(
    check("Waived/Injured RB One, WR Two.", "One"),
    "reserve-review",
  );
  assert.equal(
    check("Placed QB One on Reserve/Retired.", "One"),
    "reserve-review",
  );
  assert.equal(
    check(
      "Released WR Other; TE One and TE Two waived/injured; DE Three placed on reserve.",
      "One",
    ),
    "reserve-review",
  );
  assert.equal(
    check("One (QB) waived with an injury designation.", "One"),
    "reserve-review",
  );
  assert.equal(
    check("Waived WR One. Waived/Injured WR Two.", "One"),
    "released",
  );
  assert.equal(
    check(
      "Released RB One from injured reserve with an injury settlement.",
      "One",
    ),
    "released",
  );
});
test("missing season observations remain distinct from duplicate or missing identities", () => {
  const result = reviewTestingIdentities(
    [
      { id: "new", providerId: "verified-new", position: "QB" },
      { id: "bad", providerId: "", position: "QB" },
    ],
    [],
  );
  assert.deepEqual(result.noAppearances, ["new"]);
  assert.deepEqual(result.quarantined, ["bad"]);
  assert.equal(result.approved.length, 0);
  const duplicate = reviewTestingIdentities(
    [
      { id: "a", providerId: "same", position: "QB" },
      { id: "b", providerId: "same", position: "QB" },
    ],
    [],
  );
  assert.equal(duplicate.noAppearances.length, 0);
  assert.equal(duplicate.quarantined.length, 2);
});
test("position reconciliation needs an explicit exact source/canonical/official-role review", () => {
  const p = [{ id: "docked", providerId: "stable", position: "WR" }],
    e = [{ canonical_id: "canonical", external_id: "stable", position: "CB" }];
  const review: TestingPositionReview = {
    providerId: "stable",
    canonical: "canonical",
    sourcePosition: "CB",
    fantasyPosition: "WR",
    officialPosition: "WR/CB",
    sourceUrl: "https://www.jaguars.com/team/players-roster/example",
    sourceHash: "a".repeat(64),
    reason: "Verified offensive role; offensive scoring only",
  };
  assert.deepEqual(reviewTestingIdentities(p, e).quarantined, ["docked"]);
  assert.equal(reviewTestingIdentities(p, e, [review]).approved.length, 1);
  for (const invalid of [
    { ...review, canonical: "other" },
    { ...review, officialPosition: "CB" },
    { ...review, sourcePosition: "LB" },
    { ...review, sourceHash: "" },
  ])
    assert.equal(reviewTestingIdentities(p, e, [invalid]).approved.length, 0);
  assert.equal(
    reviewTestingIdentities(p, e, [review, review]).approved.length,
    0,
  );
  assert.equal(
    reviewTestingIdentities(
      p,
      [...e, { ...e[0], external_id: "different" }],
      [review],
    ).approved.length,
    0,
  );
});
test("FB source label cannot silently change the existing fantasy RB classification", () => {
  const p = [{ id: "rb", providerId: "fb", position: "RB" }],
    e = [{ canonical_id: "fb-canonical", external_id: "fb", position: "FB" }];
  assert.equal(reviewTestingIdentities(p, e).approved.length, 0);
  const r: TestingPositionReview = {
    providerId: "fb",
    canonical: "fb-canonical",
    sourcePosition: "FB",
    fantasyPosition: "RB",
    officialPosition: "FB",
    sourceUrl: "https://www.49ers.com/team/players-roster/example",
    sourceHash: "b".repeat(64),
    reason: "Existing approved fantasy RB includes FB",
  };
  assert.equal(reviewTestingIdentities(p, e, [r]).approved[0].position, "RB");
});
