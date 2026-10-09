import Decimal from "decimal.js";
import type { Evidence } from "./pricing";

export type OfficialRecordRow = {
  publicationId: string;
  eventId: string;
  publishedAt: string;
  selection: string;
  odds: string;
  estimatedEv: string | null;
  benchmarkStake: "1";
  evidence: Evidence;
  result: "pending" | "won" | "lost" | "void" | "disputed";
  netUnits: string | null;
  settledAt: string | null;
  correctionCount: number;
  modelVersion: string;
  competition?: string;
  eventLabel?: string;
};
export type OfficialDockedRecord = {
  status: "READY" | "NOT_CONFIGURED" | "RESTRICTED" | "UNAVAILABLE";
  officialRecordStart: string | null;
  rows: OfficialRecordRow[];
};
export type OfficialRecordFilters = {
  from?: string;
  to?: string;
  sport?: string;
  strategy?: string;
};
export function officialRecordScope(
  record: OfficialDockedRecord,
  filters: OfficialRecordFilters,
): OfficialDockedRecord {
  const from = /^\d{4}-\d{2}-\d{2}$/.test(filters.from ?? "")
    ? filters.from
    : undefined;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(filters.to ?? "")
    ? filters.to
    : undefined;
  return {
    ...record,
    rows: record.rows.filter(
      (row) =>
        (!from || row.publishedAt.slice(0, 10) >= from) &&
        (!to || row.publishedAt.slice(0, 10) <= to) &&
        (!filters.sport || row.competition === filters.sport) &&
        (!filters.strategy || row.modelVersion === filters.strategy),
    ),
  };
}

function number(value: string | null): Decimal | null {
  if (value === null) return null;
  try {
    const parsed = new Decimal(value);
    return parsed.isFinite() ? parsed : null;
  } catch {
    return null;
  }
}

/** Global record boundary is supplied by the immutable ledger, never inferred from visible rows. */
export function officialRecordMetrics(record: OfficialDockedRecord) {
  const available = record.status === "READY";
  const rows = available
    ? record.rows.filter((row) => row.evidence === "live_published")
    : [];
  if (new Set(rows.map((row) => row.publicationId)).size !== rows.length)
    throw new Error("Duplicate official publication");
  if (rows.some((row) => row.benchmarkStake !== "1"))
    throw new Error("Official record requires the fixed one-unit benchmark");
  const won = rows.filter((row) => row.result === "won").length;
  const lost = rows.filter((row) => row.result === "lost").length;
  const voids = rows.filter((row) => row.result === "void").length;
  const outcomes = rows.filter((row) =>
    ["won", "lost", "void"].includes(row.result),
  );
  const odds = rows.map((row) => number(row.odds));
  const estimates = rows.map((row) => number(row.estimatedEv));
  const completeOdds = odds.every((value) => value !== null && value.gt(1));
  const completeEstimates = estimates.every((value) => value !== null);
  const profits = outcomes.map((row) => number(row.netUnits));
  const completeSettlement =
    outcomes.length > 0 && profits.every((value) => value !== null);
  const net = completeSettlement
    ? Decimal.sum(...(profits as Decimal[]))
    : null;
  let cumulative = new Decimal(0),
    peak = new Decimal(0),
    drawdown = new Decimal(0),
    run = 0,
    longest = 0;
  const curve: { date: string; units: string }[] = [];
  const months: Record<string, Decimal> = {};
  const chronological =
    completeSettlement &&
    outcomes.every(
      (row) =>
        row.settledAt !== null && Number.isFinite(Date.parse(row.settledAt)),
    );
  if (chronological) {
    for (const row of [...outcomes].sort(
      (a, b) =>
        a.settledAt!.localeCompare(b.settledAt!) ||
        a.publicationId.localeCompare(b.publicationId),
    )) {
      const profit = number(row.netUnits)!;
      cumulative = cumulative.plus(profit);
      peak = Decimal.max(peak, cumulative);
      drawdown = Decimal.max(drawdown, peak.minus(cumulative));
      if (row.result === "won") run = 0;
      else if (row.result === "lost") longest = Math.max(longest, ++run);
      // Voids neither create nor break a losing run.
      const date = row.settledAt!;
      curve.push({ date, units: cumulative.toFixed(2) });
      months[date.slice(0, 7)] = (
        months[date.slice(0, 7)] ?? new Decimal(0)
      ).plus(profit);
    }
  }
  return {
    available,
    officialRecordStart: record.officialRecordStart,
    rows,
    published: available ? rows.length : null,
    settled: available ? outcomes.length : null,
    wins: available ? won : null,
    losses: available ? lost : null,
    voids: available ? voids : null,
    pending: available
      ? rows.filter((row) => row.result === "pending").length
      : null,
    disputed: available
      ? rows.filter((row) => row.result === "disputed").length
      : null,
    netUnits: net?.toFixed(2) ?? null,
    roi:
      net !== null && won + lost > 0
        ? net
            .div(won + lost)
            .mul(100)
            .toFixed(2)
        : null,
    averagePublishedOdds:
      rows.length && completeOdds
        ? Decimal.sum(...(odds as Decimal[]))
            .div(rows.length)
            .toFixed(3)
        : null,
    averageEstimatedEdge:
      rows.length && completeEstimates
        ? Decimal.sum(...(estimates as Decimal[]))
            .div(rows.length)
            .mul(100)
            .toFixed(2)
        : null,
    maximumDrawdown:
      chronological && won + lost > 0 ? drawdown.toFixed(2) : null,
    longestLosingRun: chronological && won + lost > 0 ? longest : null,
    curve,
    months: Object.fromEntries(
      Object.entries(months).map(([month, units]) => [month, units.toFixed(2)]),
    ),
  };
}
