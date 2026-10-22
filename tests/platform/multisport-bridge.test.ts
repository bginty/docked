import test from "node:test";
import assert from "node:assert/strict";
import {
  mapRawScoringInput,
  type RawGame,
} from "../../src/core/multisport-ingestion";
import { scorePlayer } from "../../src/core/scoring-v1";
import { sportEventRules } from "../../src/core/sport-event-rules";
import {
  reconcileCatalogueIdentity,
  cursorSequence,
} from "../../src/core/multisport-delivery";
const row: RawGame = {
  sport: "epl",
  fixture_id: "qa:f",
  player_id: "qa:p",
  revision: 1,
  synthetic: false,
  usable: true,
  participation: "played",
  stats: {
    goals: 1,
    assists: 0,
    saves: 0,
    penalty_saves: 0,
    penalties_missed: 0,
    yellow_cards: 0,
    own_goals: 0,
  },
  current_fields: {
    goals: true,
    assists: true,
    saves: true,
    penalty_saves: true,
    penalties_missed: true,
    yellow_cards: true,
    own_goals: true,
  },
};
test("EPL existing rules require ordered events, not rounded minutes", () => {
  assert.equal(mapRawScoringInput(row, "qa:p").availability, "pending");
  const input = {
    ...row,
    scoring_evidence: {
      version: "docked-epl-ordered-events-v1",
      assistDefinition: "docked-epl-assist-v1",
      dismissal: "none",
      onPitch: {
        intervals: [
          {
            enterOrder: 0,
            leaveOrder: 20,
            regulationSeconds: 3600,
            playedSeconds: 3660,
          },
        ],
        concededGoalOrders: [21],
      },
    },
  };
  const result = mapRawScoringInput(input, "qa:p");
  assert.equal(result.availability, "complete");
  assert.equal(
    scorePlayer(sportEventRules("epl"), "DEF", result.stats).centipoints,
    1200,
  );
  assert.equal(
    mapRawScoringInput(
      {
        ...input,
        scoring_evidence: {
          ...input.scoring_evidence,
          assistDefinition: "unreviewed",
        },
      },
      "qa:p",
    ).availability,
    "pending",
  );
  assert.equal(
    mapRawScoringInput(
      { ...input, current_fields: { ...row.current_fields, goals: false } },
      "qa:p",
    ).availability,
    "pending",
  );
});
test("confirmed DNP distinct from unknown, removed and missing fields", () => {
  assert.equal(
    mapRawScoringInput({ ...row, participation: "dnp" }, "qa:p").availability,
    "pending",
  );
  assert.equal(
    mapRawScoringInput(
      { ...row, participation: "dnp", stats: {}, current_fields: {} },
      "qa:p",
    ).availability,
    "confirmed-dnp",
  );
  assert.equal(
    mapRawScoringInput({ ...row, participation: "dnp", usable: false }, "qa:p")
      .availability,
    "pending",
  );
  assert.equal(
    mapRawScoringInput({ ...row, removed: true }, "qa:p").availability,
    "pending",
  );
});
test("legacy EPL mapping uses explicit identity and never authorises reissuance", () => {
  const catalogue = [{ id: "existing", sport: "football" }];
  assert.equal(
    reconcileCatalogueIdentity("epl", "source", null, catalogue, []).status,
    "review-required",
  );
  assert.deepEqual(
    reconcileCatalogueIdentity("epl", "source", "existing", catalogue, []),
    { status: "mapped", playerId: "existing", issuanceAllowed: false },
  );
  assert.throws(() =>
    reconcileCatalogueIdentity("nba", "source", "existing", catalogue, []),
  );
  assert.throws(() =>
    reconcileCatalogueIdentity("epl", "new", "existing", catalogue, [
      { canonical: "other", dockedId: "existing" },
    ]),
  );
  assert.throws(() => cursorSequence("dataset:nba:4", "dataset", "epl"));
});
