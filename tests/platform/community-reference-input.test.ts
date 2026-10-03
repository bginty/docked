import {
  communityReferenceDraftSchema,
  communitySubmitSchema,
} from "../../src/core/community-reference-input";
import { test } from "node:test";
import assert from "node:assert/strict";
test("market-reference API input rejects all competitive price/source overrides", () => {
  const valid = {
    marketId: "fixture-market",
    selection: "Fictional A",
    reviewToken: "a".repeat(64),
    confirmedPermanent: true,
    idempotencyKey: "11111111-1111-4111-8111-111111111111",
  };
  assert.equal(communitySubmitSchema.safeParse(valid).success, true);
  for (const key of [
    "odds",
    "price",
    "snapshotId",
    "reference",
    "marketReference",
    "bookmaker",
    "standardUnits",
    "verificationRule",
  ])
    assert.equal(
      communitySubmitSchema.safeParse({ ...valid, [key]: "999" }).success,
      false,
      key,
    );
  assert.equal(
    communityReferenceDraftSchema.safeParse({
      marketId: "m",
      selection: "A",
      odds: "9",
    }).success,
    false,
  );
  const personal = communitySubmitSchema.parse({
    ...valid,
    personalBookmaker: "Claimed book",
    personalPrice: "50.00",
    personalPromotional: true,
  });
  assert.equal(personal.personalPrice, "50.00");
  assert.equal("odds" in personal, false);
  for (const value of ["NaN", "Infinity", "0", "1", "1001", "-2"])
    assert.equal(
      communitySubmitSchema.safeParse({ ...valid, personalPrice: value })
        .success,
      false,
    );
});
