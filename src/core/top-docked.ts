import Decimal from "decimal.js";
import type { CommunityResult, PriceClass } from "./community-edge";

export const topDockedRuleV1 = Object.freeze({
  version: "top-docked-net-units-v1",
  minimumSettled: 20,
  minimumActiveDays: 7,
  primary: "net_standardised_units",
  tieBreakers: ["maximum_drawdown_ascending", "profile_id_ascending"],
  periodBasis: "submitted_at_utc",
  roiDenominator: "settled_non_void_standard_units",
});
export type RankingPeriod =
  "week" | "month" | "7d" | "30d" | "90d" | "ytd" | "all";
export type CanonicalCommunityRecord = {
  id: string;
  profileId: string;
  submittedAt: string;
  startAt: string;
  sport: string;
  odds: string;
  units: string;
  classification: PriceClass;
  ruleVersion: string;
  verified: boolean;
  demo: boolean;
  official: boolean;
  integrityClear: boolean;
  result: CommunityResult;
  settledAt: string | null;
  settlementId: string | null;
};
export type CommunityPerformance = {
  verifiedEdges: number;
  settled: number;
  won: number;
  lost: number;
  voids: number;
  pending: number;
  disputed: number;
  netUnits: string | null;
  roi: string | null;
  winRate: string | null;
  averageOdds: string | null;
  maxDrawdown: string | null;
  longestLosingRun: number | null;
  activeDays: number;
  lastSubmissionAt: string | null;
  curve: { at: string; units: string; edgeId: string }[];
};
export type TopDockedRow = {
  profileId: string;
  rank: number | null;
  qualification: "QUALIFIED" | "PROVISIONAL" | "INTEGRITY_REVIEW";
  qualificationMessage: string;
  needsSettled: number;
  needsActiveDays: number;
  edgeIds: string[];
  settlementIds: string[];
  performance: CommunityPerformance;
};
export function rankingWindow(period: RankingPeriod, asOf: string) {
  const now = new Date(asOf);
  if (!Number.isFinite(now.getTime()))
    throw new Error("Valid ranking as-of time required");
  const from = new Date(now);
  if (period === "all") return { from: null, to: now.toISOString() };
  if (period === "week") {
    from.setUTCHours(0, 0, 0, 0);
    from.setUTCDate(from.getUTCDate() - ((from.getUTCDay() + 6) % 7));
  } else if (period === "month") {
    from.setUTCDate(1);
    from.setUTCHours(0, 0, 0, 0);
  } else if (period === "ytd") {
    from.setUTCMonth(0, 1);
    from.setUTCHours(0, 0, 0, 0);
  } else if (["7d", "30d", "90d"].includes(period)) {
    from.setTime(now.getTime() - Number(period.slice(0, -1)) * 86400000);
  } else throw new Error("Unsupported ranking period");
  return { from: from.toISOString(), to: now.toISOString() };
}
export function communityPerformance(
  records: CanonicalCommunityRecord[],
): CommunityPerformance {
  if (new Set(records.map((r) => r.id)).size !== records.length)
    throw new Error("Duplicate canonical Edge");
  let net = new Decimal(0),
    peak = new Decimal(0),
    drawdown = new Decimal(0),
    odds = new Decimal(0),
    run = 0,
    longest = 0;
  let won = 0,
    lost = 0,
    voids = 0,
    pending = 0,
    disputed = 0;
  const days = new Set<string>(),
    curve: CommunityPerformance["curve"] = [];
  for (const r of [...records].sort(
    (a, b) =>
      Date.parse(a.settledAt ?? a.submittedAt) -
        Date.parse(b.settledAt ?? b.submittedAt) ||
      a.id.localeCompare(b.id, "en"),
  )) {
    const price = new Decimal(r.odds);
    if (
      ![r.submittedAt, r.startAt].every((time) =>
        Number.isFinite(Date.parse(time)),
      ) ||
      !new Decimal(r.units).eq(1) ||
      !price.isFinite() ||
      price.lte(1) ||
      price.gt(1000) ||
      !r.verified ||
      r.demo ||
      r.official ||
      r.classification !== "STANDARD_VERIFIED" ||
      !["community-standard-v1", "community-market-reference-v2"].includes(
        r.ruleVersion,
      ) ||
      Date.parse(r.submittedAt) >= Date.parse(r.startAt) - 600000
    )
      throw new Error(
        "Performance requires canonical eligible one-unit community records",
      );
    if (r.result === "PENDING") {
      pending++;
      continue;
    }
    if (["DISPUTED", "MANUAL_REVIEW"].includes(r.result)) {
      disputed++;
      continue;
    }
    if (
      !r.settlementId ||
      !r.settledAt ||
      !Number.isFinite(Date.parse(r.settledAt)) ||
      Date.parse(r.settledAt) < Date.parse(r.startAt)
    )
      throw new Error("Verified settlement evidence required");
    if (r.result === "VOID") {
      voids++;
      continue;
    }
    if (!["WON", "LOST"].includes(r.result))
      throw new Error("Unknown settlement status");
    days.add(new Date(r.submittedAt).toISOString().slice(0, 10));
    odds = odds.plus(price);
    if (r.result === "WON") {
      won++;
      net = net.plus(price.minus(1));
      run = 0;
    } else {
      lost++;
      net = net.minus(1);
      run++;
      longest = Math.max(longest, run);
    }
    peak = Decimal.max(peak, net);
    drawdown = Decimal.max(drawdown, peak.minus(net));
    curve.push({ at: r.settledAt, units: net.toFixed(2), edgeId: r.id });
  }
  const count = won + lost;
  return {
    verifiedEdges: records.length,
    settled: count + voids,
    won,
    lost,
    voids,
    pending,
    disputed,
    netUnits: count + voids ? net.toString() : null,
    roi: count ? net.div(count).mul(100).toFixed(2) : null,
    winRate: count ? new Decimal(won).div(count).mul(100).toFixed(2) : null,
    averageOdds: count ? odds.div(count).toFixed(3) : null,
    maxDrawdown: count ? drawdown.toString() : null,
    longestLosingRun: count ? longest : null,
    activeDays: days.size,
    lastSubmissionAt: records.length
      ? [...records]
          .map((r) => r.submittedAt)
          .sort((a, b) => Date.parse(b) - Date.parse(a))[0]
      : null,
    curve,
  };
}
export function calculateTopDocked(
  records: CanonicalCommunityRecord[],
  options: { period: RankingPeriod; asOf: string; sport?: string },
) {
  const window = rankingWindow(options.period, options.asOf),
    grouped = new Map<string, CanonicalCommunityRecord[]>();
  for (const record of records)
    if (
      ![
        record.submittedAt,
        record.startAt,
        ...(record.settledAt ? [record.settledAt] : []),
      ].every((time) => Number.isFinite(Date.parse(time)))
    )
      throw new Error("Invalid canonical record timestamp");
  if (new Set(records.map((r) => r.id)).size !== records.length)
    throw new Error("Duplicate canonical Edge");
  const canonical = records.filter(
    (r) =>
      r.verified &&
      !r.demo &&
      !r.official &&
      r.classification === "STANDARD_VERIFIED" &&
      (!options.sport || r.sport === options.sport) &&
      Date.parse(r.submittedAt) <= Date.parse(window.to) &&
      (!window.from || Date.parse(r.submittedAt) >= Date.parse(window.from)),
  );
  for (const r of canonical) {
    if (r.settledAt && Date.parse(r.settledAt) > Date.parse(options.asOf))
      throw new Error("Future settlement cannot enter an earlier snapshot");
    grouped.set(r.profileId, [...(grouped.get(r.profileId) ?? []), r]);
  }
  const rows: TopDockedRow[] = [...grouped].map(([profileId, member]) => {
    const performance = communityPerformance(member),
      needsSettled = Math.max(
        0,
        topDockedRuleV1.minimumSettled - performance.won - performance.lost,
      ),
      needsActiveDays = Math.max(
        0,
        topDockedRuleV1.minimumActiveDays - performance.activeDays,
      );
    const review = records.some(
      (r) => r.profileId === profileId && !r.integrityClear,
    );
    const qualification = review
      ? "INTEGRITY_REVIEW"
      : !needsSettled && !needsActiveDays
        ? "QUALIFIED"
        : "PROVISIONAL";
    return {
      profileId,
      rank: null,
      qualification,
      needsSettled,
      needsActiveDays,
      qualificationMessage: review
        ? "Unresolved integrity review; not ranked."
        : qualification === "QUALIFIED"
          ? "Qualified under the published sample and integrity rules."
          : `Needs ${needsSettled} more settled verified Edges and ${needsActiveDays} more active UTC days.`,
      edgeIds: member.map((r) => r.id).sort(),
      settlementIds: member
        .flatMap((r) => (r.settlementId ? [r.settlementId] : []))
        .sort(),
      performance,
    };
  });
  rows.sort(
    (a, b) =>
      Number(b.qualification === "QUALIFIED") -
        Number(a.qualification === "QUALIFIED") ||
      new Decimal(b.performance.netUnits ?? 0).cmp(
        a.performance.netUnits ?? 0,
      ) ||
      new Decimal(a.performance.maxDrawdown ?? 0).cmp(
        b.performance.maxDrawdown ?? 0,
      ) ||
      a.profileId.localeCompare(b.profileId, "en"),
  );
  let rank = 0;
  for (const row of rows)
    if (row.qualification === "QUALIFIED") row.rank = ++rank;
  return {
    rule: topDockedRuleV1,
    period: options.period,
    sport: options.sport ?? null,
    ...window,
    asOf: options.asOf,
    rows,
  };
}

export type PerformanceBadge = {
  code: "TOP_100" | "RISING" | "SPORT_SPECIALIST";
  label: string;
  ruleVersion: string;
  edgeIds: string[];
};
export type RankingScope = {
  period: RankingPeriod;
  from: string | null;
  sport: string | null;
  rule: { version: string };
};
export function sameRankingScope(
  current: RankingScope,
  previous: RankingScope,
) {
  return (
    current.rule.version === topDockedRuleV1.version &&
    previous.rule.version === current.rule.version &&
    current.period === previous.period &&
    current.from === previous.from &&
    current.sport === previous.sport
  );
}
export function leaderboardMilestone(
  current: TopDockedRow,
  previous: TopDockedRow | undefined,
  scope: { current: RankingScope; previous: RankingScope } | undefined,
): "QUALIFIED" | "RISING" | null {
  if (
    !scope ||
    !sameRankingScope(scope.current, scope.previous) ||
    current.qualification !== "QUALIFIED" ||
    current.rank === null
  )
    return null;
  if (!previous || previous.qualification === "PROVISIONAL") return "QUALIFIED";
  // Clearing integrity review alone is not a performance milestone.
  return qualifiedPerformanceBadges(
    current,
    previous,
    scope.current.sport ?? undefined,
    scope,
  ).some((badge) => badge.code === "RISING")
    ? "RISING"
    : null;
}
/** Badges are derived from canonical qualified samples, never subscription or follower counts. */
export function qualifiedPerformanceBadges(
  current: TopDockedRow,
  previous?: TopDockedRow,
  sport?: string,
  comparison?: { current: RankingScope; previous: RankingScope },
): PerformanceBadge[] {
  if (current.qualification !== "QUALIFIED" || current.rank === null) return [];
  const proof = {
    ruleVersion: topDockedRuleV1.version,
    edgeIds: current.edgeIds,
  };
  const badges: PerformanceBadge[] =
    current.rank <= 100
      ? [{ ...proof, code: "TOP_100", label: "Top 100 — qualified period" }]
      : [];
  if (
    comparison &&
    sameRankingScope(comparison.current, comparison.previous) &&
    previous?.qualification === "QUALIFIED" &&
    previous.rank !== null &&
    current.rank < previous.rank &&
    current.edgeIds.some((id) => !previous.edgeIds.includes(id))
  )
    badges.push({
      ...proof,
      code: "RISING",
      label: "Rising — qualified ranking improvement",
    });
  if (
    sport &&
    current.performance.won + current.performance.lost >= 50 &&
    current.performance.activeDays >= 14
  )
    badges.push({
      ...proof,
      code: "SPORT_SPECIALIST",
      label: `${sport} specialist — verified sample`,
    });
  return badges;
}
