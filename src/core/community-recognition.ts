import Decimal from "decimal.js";

/** Discovery rules are deliberately independent from Top Docked performance. */
export const recognitionRuleV1 = Object.freeze({
  version: "community-recognition-v1",
  minimumAccountAgeDays: 7,
  minimumEngagers: 3,
  burstMembers: 8,
  burstSeconds: 60,
  trendingHalfLifeHours: 24,
  weeklySettledSample: 20,
  weeklyActiveDays: 7,
  weeklyReturnTieBreakCap: "3",
});
export type RecognitionEdge = {
  id: string;
  profileId: string;
  handle: string;
  displayName: string;
  event: string;
  sport: string;
  competition: string;
  market: string;
  selection: string;
  submittedAt: string;
  startAt: string;
  odds: string;
  result: "PENDING" | "WON" | "LOST" | "VOID" | "DISPUTED" | "MANUAL_REVIEW";
  settledAt: string | null;
};
export type RecognitionEngagement = {
  actorId: string;
  kind: "reaction" | "comment";
  createdAt: string;
  joinedAt: string;
  eligible: boolean;
  viewerVisible?: boolean;
};
export type RecognitionCandidate = {
  edge: RecognitionEdge;
  authorJoinedAt: string;
  eligible: boolean;
  verifiedStandardReference: boolean;
  evidenceMode: "current" | "research";
  promotional: boolean;
  integrityClear: boolean;
  viewerVisible: boolean;
  settledSample: number;
  activeDays: number;
  engagements: RecognitionEngagement[];
};
export type RecognizedEdge = {
  edge: RecognitionEdge;
  uniqueMembers: number;
  uniqueReactions: number;
  uniqueCommenters: number;
  score: number;
  netUnits: string | null;
};
const day = 86_400_000;
const valid = (value: string) => Number.isFinite(Date.parse(value));
function mature(joined: string, at: number) {
  return (
    valid(joined) &&
    at - Date.parse(joined) >= recognitionRuleV1.minimumAccountAgeDays * day
  );
}
export function completedRecognitionWeek(asOf: string) {
  if (!valid(asOf))
    throw Error("Recognition requires a valid observation time");
  const end = new Date(asOf);
  end.setUTCHours(0, 0, 0, 0);
  end.setUTCDate(end.getUTCDate() - ((end.getUTCDay() + 6) % 7));
  return {
    start: new Date(end.getTime() - 7 * day).toISOString(),
    end: end.toISOString(),
  };
}
export function recognitionEngagement(
  candidate: RecognitionCandidate,
  asOf: string,
  respectViewer = false,
) {
  const at = Date.parse(asOf),
    first = new Map<string, number>();
  const reactions = new Set<string>(),
    comments = new Set<string>();
  for (const e of candidate.engagements) {
    const time = Date.parse(e.createdAt);
    if (
      !e.eligible ||
      (respectViewer && e.viewerVisible === false) ||
      e.actorId === candidate.edge.profileId ||
      !Number.isFinite(time) ||
      time >= at ||
      time < Date.parse(candidate.edge.submittedAt) ||
      !mature(e.joinedAt, time)
    )
      continue;
    first.set(e.actorId, Math.min(first.get(e.actorId) ?? Infinity, time));
    (e.kind === "reaction" ? reactions : comments).add(e.actorId);
  }
  // A sliding window catches bursts across minute boundaries; repeated comments add no actors.
  const times = [...first.values()].sort((a, b) => a - b);
  let left = 0,
    burst = false;
  for (let right = 0; right < times.length; right++) {
    while (times[right] - times[left] > recognitionRuleV1.burstSeconds * 1000)
      left++;
    if (right - left + 1 >= recognitionRuleV1.burstMembers) burst = true;
  }
  return {
    uniqueMembers: first.size,
    uniqueReactions: reactions.size,
    uniqueCommenters: comments.size,
    burst,
  };
}
function eligible(c: RecognitionCandidate, at: number) {
  return (
    c.eligible &&
    c.verifiedStandardReference &&
    c.evidenceMode === "current" &&
    !c.promotional &&
    c.integrityClear &&
    valid(c.edge.submittedAt) &&
    valid(c.edge.startAt) &&
    Date.parse(c.edge.submittedAt) < Date.parse(c.edge.startAt) &&
    Date.parse(c.edge.submittedAt) < at &&
    mature(c.authorJoinedAt, Date.parse(c.edge.submittedAt)) &&
    /^[0-9]+(\.[0-9]+)?$/.test(c.edge.odds) &&
    new Decimal(c.edge.odds).gt(1) &&
    new Decimal(c.edge.odds).lte(1000)
  );
}
export function rankCommunityRecognition(
  candidates: RecognitionCandidate[],
  asOf: string,
) {
  if (!valid(asOf))
    throw Error("Recognition requires a valid observation time");
  if (new Set(candidates.map((c) => c.edge.id)).size !== candidates.length)
    throw Error("Duplicate canonical Edge");
  const at = Date.parse(asOf),
    week = completedRecognitionWeek(asOf);
  const trending: RecognizedEdge[] = [],
    weekly: RecognizedEdge[] = [],
    reviewEdgeIds: string[] = [];
  for (const c of candidates) {
    if (!eligible(c, at)) continue;
    const globalInterest = recognitionEngagement(c, asOf);
    const interest = recognitionEngagement(c, asOf, true);
    if (globalInterest.burst) reviewEdgeIds.push(c.edge.id);
    if (
      !globalInterest.burst &&
      interest.uniqueMembers >= recognitionRuleV1.minimumEngagers &&
      c.viewerVisible &&
      c.edge.result === "PENDING" &&
      Date.parse(c.edge.startAt) > at
    ) {
      const ageHours = (at - Date.parse(c.edge.submittedAt)) / 3_600_000;
      const score =
        (4 * interest.uniqueMembers +
          2 * interest.uniqueCommenters +
          interest.uniqueReactions) /
        2 ** (ageHours / recognitionRuleV1.trendingHalfLifeHours);
      trending.push({ edge: c.edge, ...interest, score, netUnits: null });
    }
    if (
      c.edge.result !== "WON" ||
      !c.edge.settledAt ||
      !valid(c.edge.settledAt) ||
      Date.parse(c.edge.settledAt) < Date.parse(week.start) ||
      Date.parse(c.edge.settledAt) >= Date.parse(week.end) ||
      Date.parse(c.edge.startAt) > Date.parse(c.edge.settledAt) ||
      !eligible(c, Date.parse(week.end)) ||
      c.settledSample < recognitionRuleV1.weeklySettledSample ||
      c.activeDays < recognitionRuleV1.weeklyActiveDays
    )
      continue;
    const weeklyInterest = recognitionEngagement(c, week.end);
    if (
      weeklyInterest.burst ||
      weeklyInterest.uniqueMembers < recognitionRuleV1.minimumEngagers
    )
      continue;
    weekly.push({
      edge: c.edge,
      ...weeklyInterest,
      score: weeklyInterest.uniqueMembers,
      netUnits: new Decimal(c.edge.odds).minus(1).toFixed(4),
    });
  }
  const tie = (a: RecognizedEdge, b: RecognizedEdge) =>
    a.edge.submittedAt.localeCompare(b.edge.submittedAt) ||
    a.edge.id.localeCompare(b.edge.id);
  trending.sort((a, b) => b.score - a.score || tie(a, b));
  weekly.sort(
    (a, b) =>
      b.uniqueMembers - a.uniqueMembers ||
      Decimal.min(b.netUnits!, recognitionRuleV1.weeklyReturnTieBreakCap).cmp(
        Decimal.min(a.netUnits!, recognitionRuleV1.weeklyReturnTieBreakCap),
      ) ||
      tie(a, b),
  );
  // Determine the same winner before applying viewer privacy; never promote a runner-up.
  const winner = weekly[0] ?? null;
  return {
    ruleVersion: recognitionRuleV1.version,
    asOf,
    week,
    trending: trending.slice(0, 3),
    weeklyWinner:
      winner &&
      candidates.find((c) => c.edge.id === winner.edge.id)?.viewerVisible
        ? winner
        : null,
    canonicalWeeklyWinner: winner,
    weeklyWithheld:
      !!winner &&
      !candidates.find((c) => c.edge.id === winner.edge.id)?.viewerVisible,
    reviewEdgeIds,
  };
}
