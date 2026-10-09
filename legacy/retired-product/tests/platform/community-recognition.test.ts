import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TrendingEdges, WeeklyEdge } from "../../src/components/edge-discovery";
import type { CommunityRecognition } from "../../src/server/community-recognition";
import {
  rankCommunityRecognition,
  completedRecognitionWeek,
  recognitionEngagement,
  type RecognitionCandidate,
} from "../../src/core/community-recognition";

const now = "2026-10-05T12:00:00Z";
function candidate(id = "a", weekly = false): RecognitionCandidate {
  const submittedAt = weekly ? "2026-10-01T10:00:00Z" : "2026-10-05T10:00:00Z";
  return {
    edge: {
      id,
      profileId: `author-${id}`,
      handle: `member_${id}`,
      displayName: "DEMO test only",
      event: "Test event",
      sport: "football",
      competition: "test",
      market: "Test result",
      selection: "Test selection",
      submittedAt,
      startAt: weekly ? "2026-10-01T18:00:00Z" : "2026-10-05T18:00:00Z",
      odds: "2.50",
      result: weekly ? "WON" : "PENDING",
      settledAt: weekly ? "2026-10-01T21:00:00Z" : null,
    },
    authorJoinedAt: "2026-01-01T00:00:00Z",
    eligible: true,
    verifiedStandardReference: true,
    evidenceMode: "current",
    promotional: false,
    integrityClear: true,
    viewerVisible: true,
    settledSample: 20,
    activeDays: 7,
    engagements: [1, 2, 3].map((n) => ({
      actorId: `person-${n}`,
      kind: "reaction",
      joinedAt: "2026-01-01T00:00:00Z",
      createdAt: new Date(Date.parse(submittedAt) + n * 120000).toISOString(),
      eligible: true,
    })),
  };
}
test("recognition uses completed UTC weeks and never awards pending, losing, void or low-sample records", () => {
  assert.deepEqual(completedRecognitionWeek(now), {
    start: "2026-09-28T00:00:00.000Z",
    end: "2026-10-05T00:00:00.000Z",
  });
  const c = candidate("a", true);
  assert.equal(
    rankCommunityRecognition([c], now).weeklyWinner?.netUnits,
    "1.5000",
  );
  for (const result of [
    "PENDING",
    "LOST",
    "VOID",
    "DISPUTED",
    "MANUAL_REVIEW",
  ] as const)
    assert.equal(
      rankCommunityRecognition([{ ...c, edge: { ...c.edge, result } }], now)
        .weeklyWinner,
      null,
    );
  for (const patch of [
    { settledSample: 19 },
    { activeDays: 6 },
    { integrityClear: false },
    { promotional: true },
    { evidenceMode: "research" as const },
    { verifiedStandardReference: false },
    { eligible: false },
  ])
    assert.equal(
      rankCommunityRecognition([{ ...c, ...patch }], now).weeklyWinner,
      null,
    );
});
test("engagement deduplicates people, excludes self, young/ineligible accounts and future observations", () => {
  const c = candidate();
  c.engagements.push(
    ...Array.from({ length: 30 }, () => c.engagements[0]),
    { ...c.engagements[0], actorId: c.edge.profileId },
    { ...c.engagements[0], actorId: "young", joinedAt: "2026-10-05T00:00:00Z" },
    { ...c.engagements[0], actorId: "blocked", eligible: false },
    {
      ...c.engagements[0],
      actorId: "future",
      createdAt: "2026-10-06T00:00:00Z",
    },
  );
  assert.equal(recognitionEngagement(c, now).uniqueMembers, 3);
  assert.equal(
    rankCommunityRecognition([c], now).trending[0].uniqueReactions,
    3,
  );
  c.authorJoinedAt = "2026-10-01T00:00:00Z";
  assert.equal(rankCommunityRecognition([c], now).trending.length, 0);
});
test("sliding burst detection crosses minute boundaries and holds recognition", () => {
  const c = candidate();
  c.engagements = Array.from({ length: 8 }, (_, i) => ({
    actorId: `p${i}`,
    kind: "reaction",
    joinedAt: "2026-01-01T00:00:00Z",
    createdAt: new Date(
      Date.parse("2026-10-05T11:00:56Z") + i * 1000,
    ).toISOString(),
    eligible: true,
  }));
  const ranked = rankCommunityRecognition([c], now);
  assert.deepEqual(ranked.reviewEdgeIds, ["a"]);
  assert.equal(ranked.trending.length, 0);
});
test("viewer-blocked engagement does not trend while the global weekly decision stays stable", () => {
  const pending = candidate();
  pending.engagements[0].viewerVisible = false;
  assert.equal(rankCommunityRecognition([pending], now).trending.length, 0);
  const weekly = candidate("weekly", true);
  weekly.engagements[0].viewerVisible = false;
  assert.equal(
    rankCommunityRecognition([weekly], now).canonicalWeeklyWinner?.edge.id,
    "weekly",
  );
});
test("weekly ranking is not a longshot prize; blocked winner is withheld rather than replaced", () => {
  const a = candidate("a", true),
    b = candidate("b", true);
  a.edge.odds = "4.0";
  b.edge.odds = "501.0";
  assert.equal(
    rankCommunityRecognition([b, a], now).weeklyWinner?.edge.id,
    "a",
  );
  a.viewerVisible = false;
  const hidden = rankCommunityRecognition([a, b], now);
  assert.equal(hidden.weeklyWinner, null);
  assert.equal(hidden.weeklyWithheld, true);
  assert.equal(hidden.canonicalWeeklyWinner?.edge.id, "a");
});
test("weekly ranking ignores after-week engagement and rejects invalid/duplicate canonical data", () => {
  const c = candidate("a", true);
  c.engagements[0].createdAt = now;
  assert.equal(rankCommunityRecognition([c], now).weeklyWinner, null);
  assert.throws(() => rankCommunityRecognition([c, c], now), /Duplicate/);
  assert.throws(() => rankCommunityRecognition([], "invalid"), /valid/);
  c.edge.odds = "NaN";
  assert.equal(rankCommunityRecognition([c], now).weeklyWinner, null);
});

test("trending caps eligible records at three and renders unique likes as interest, never quality", () => {
  const ranked = rankCommunityRecognition(
    ["d", "b", "a", "c"].map((id) => candidate(id)),
    now,
  );
  assert.equal(ranked.trending.length, 3);
  assert.deepEqual(
    ranked.trending.map((item) => item.edge.id),
    ["a", "b", "c"],
  );
  const data: CommunityRecognition = {
    status: "READY",
    message: "",
    ruleVersion: "test-only-v1",
    asOf: now,
    trending: ranked.trending,
    weekly: {
      ...completedRecognitionWeek(now),
      status: "NO_QUALIFIER",
      winner: null,
      snapshotId: null,
    },
  };
  const html = renderToStaticMarkup(createElement(TrendingEdges, { data }));
  assert.equal((html.match(/Eligible likes/g) ?? []).length, 3);
  assert.match(html, /Likes measure interest, not probability or quality/);
  assert.match(html, /seven-day account age/);
  assert.match(html, /suspicious bursts are excluded/);
  assert.match(
    renderToStaticMarkup(createElement(WeeklyEdge, { data })),
    /No qualifying Edge this week yet\./,
  );
});
