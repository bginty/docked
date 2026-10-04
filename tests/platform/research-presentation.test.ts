import { test } from "node:test";
import assert from "node:assert/strict";
import { approvedResearchFile } from "../../src/core/research-presentation";
import type {
  MatchResearchFile,
  PublicResearchFact,
} from "../../src/core/research-engine";
const fact = (
  id: string,
  type: PublicResearchFact["type"],
): PublicResearchFact => ({
  id,
  type,
  teamId: "Fictional Team",
  playerId: "fictional-player",
  value: { status: "OUT", reason: "INJURY" },
  confidence: "CONFIRMED",
  status: "VERIFIED",
  sourceLabel: "Fictional",
  sourceUrl: "https://example.invalid/fact",
  sourcePublishedAt: null,
  sourceObservedAt: "2026-10-04T00:00:00Z",
  ingestedAt: "2026-10-04T00:00:00Z",
  effectiveAt: "2026-10-04T00:00:00Z",
  expiresAt: "2026-10-05T00:00:00Z",
  corroboratingIds: [id, "unpublished-corroboration"],
  conflictingIds: [],
});
const file: MatchResearchFile = {
  schemaVersion: "match-research-v1",
  event: {
    eventId: "fictional-event",
    competitionId: "soccer_epl",
    homeTeam: "Fictional Team",
    awayTeam: "Opponent",
    homeTeamId: "Fictional Team",
    awayTeamId: "Opponent",
    startAt: "2026-10-05T00:00:00Z",
    venue: null,
    status: "scheduled",
  },
  asOfTime: "2026-10-04T00:00:00Z",
  policyVersion: "fixture",
  status: "READY",
  missing: [],
  sections: [
    {
      key: "PLAYER_AVAILABILITY",
      status: "AVAILABLE",
      facts: [fact("reviewed", "PLAYER_INJURY")],
    },
    {
      key: "CONFIRMED_LINEUP",
      status: "AVAILABLE",
      facts: [fact("unpublished", "CONFIRMED_LINEUP")],
    },
  ],
  modelStatus: "NOT_CONFIGURED",
  marketStatus: "SEPARATE_MARKET_DATA",
  factIds: ["reviewed", "unpublished"],
  snapshotHash: "a".repeat(64),
};
test("approved projection hides all unpublished identities and recomputes visible availability without claiming complete research", () => {
  const result = approvedResearchFile(
    file,
    ["reviewed"],
    ["PLAYER_INJURY", "CONFIRMED_LINEUP"],
    "content",
    "snapshot",
  )!;
  assert.equal(result.status, "PARTIAL");
  assert.deepEqual(result.factIds, ["reviewed"]);
  assert.equal(result.sections[1].status, "DATA_NOT_AVAILABLE");
  assert.deepEqual(result.missing, ["CONFIRMED_LINEUP"]);
  assert.deepEqual(result.sections[0].facts[0].corroboratingIds, ["reviewed"]);
  assert.ok(!JSON.stringify(result).includes("unpublished"));
  assert.notEqual(result.snapshotHash, file.snapshotHash);
});
test("new current conflict, correction or withdrawn fact cannot survive an old editorial approval", () => {
  assert.equal(
    approvedResearchFile(
      { ...file, sections: [] },
      ["reviewed"],
      [],
      "content",
      "snapshot",
    ),
    null,
  );
  assert.equal(
    approvedResearchFile(
      {
        ...file,
        sections: [
          {
            ...file.sections[0],
            facts: [
              {
                ...fact("reviewed", "PLAYER_INJURY"),
                status: "CONFLICTING_EVIDENCE",
              },
            ],
          },
        ],
      },
      ["reviewed"],
      [],
      "content",
      "snapshot",
    ),
    null,
  );
});
