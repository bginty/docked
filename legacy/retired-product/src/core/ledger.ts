import Decimal from "decimal.js";
import type { Evidence } from "./pricing";
export type LedgerRow = {
  id: string;
  eventId: string;
  publishedAt: string;
  settledAt?: string;
  odds: string;
  stake: string;
  evidence: Evidence;
  result: "pending" | "won" | "lost" | "void" | "disputed";
  sport: string;
  strategy: string;
  availability?: string;
  ev?: string;
  clv?: string;
};
export function ledger(rows: LedgerRow[], evidence: Evidence) {
  if (rows.some((r) => r.evidence !== evidence))
    throw new Error("Mixed evidence categories");
  if (
    new Set(rows.map((r) => r.id)).size !== rows.length ||
    new Set(rows.map((r) => r.eventId)).size !== rows.length
  )
    throw new Error("Duplicate benchmark");
  let net = new Decimal(0),
    peak = new Decimal(0),
    drawdown = new Decimal(0),
    turnover = new Decimal(0),
    voidStake = new Decimal(0),
    pending = new Decimal(0),
    denominator = new Decimal(0),
    oddsSum = new Decimal(0),
    run = 0,
    longest = 0;
  let won = 0,
    lost = 0,
    voids = 0;
  const curve: { date: string; units: string }[] = [],
    months: Record<string, Decimal> = {};
  const ordered = [...rows].sort(
    (a, b) =>
      (a.settledAt ?? a.publishedAt).localeCompare(
        b.settledAt ?? b.publishedAt,
      ) || a.id.localeCompare(b.id),
  );
  for (const r of ordered) {
    const s = new Decimal(r.stake),
      o = new Decimal(r.odds);
    if (!s.eq(1) || !o.isFinite() || o.lte(1))
      throw new Error("One-unit benchmark and valid odds required");
    turnover = turnover.plus(s);
    if (r.result === "pending" || r.result === "disputed") {
      pending = pending.plus(s);
      continue;
    }
    if (r.result === "void") {
      voids++;
      voidStake = voidStake.plus(s);
      continue;
    }
    denominator = denominator.plus(s);
    oddsSum = oddsSum.plus(o);
    let profit: Decimal;
    if (r.result === "won") {
      won++;
      profit = s.mul(o.minus(1));
      run = 0;
    } else {
      lost++;
      profit = s.negated();
      run++;
      longest = Math.max(longest, run);
    }
    net = net.plus(profit);
    peak = Decimal.max(peak, net);
    drawdown = Decimal.max(drawdown, peak.minus(net));
    const date = r.settledAt ?? r.publishedAt;
    const month = date.slice(0, 7);
    months[month] = (months[month] ?? new Decimal(0)).plus(profit);
    curve.push({ date, units: net.toFixed(2) });
  }
  return {
    count: rows.length,
    settled: won + lost + voids,
    won,
    lost,
    voids,
    net: rows.length ? net.toFixed(2) : null,
    roi: denominator.gt(0) ? net.div(denominator).mul(100).toFixed(2) : null,
    turnover: turnover.toString(),
    nonVoidStake: denominator.toString(),
    voidStake: voidStake.toString(),
    pendingStake: pending.toString(),
    averageOdds: won + lost ? oddsSum.div(won + lost).toFixed(3) : null,
    drawdown: won + lost ? drawdown.toFixed(2) : null,
    longestLosingRun: won + lost ? longest : null,
    curve,
    months: Object.fromEntries(
      Object.entries(months).map(([k, v]) => [k, v.toFixed(2)]),
    ),
    clv: rows.filter((r) => r.clv !== undefined).length
      ? Decimal.sum(
          ...rows.filter((r) => r.clv !== undefined).map((r) => r.clv!),
        )
          .div(rows.filter((r) => r.clv !== undefined).length)
          .toString()
      : null,
  };
}
export function closingValue(
  odds: string,
  closingProbability: string,
  closingAt: string,
  startAt: string,
  sameRules: boolean,
) {
  if (
    !sameRules ||
    !Number.isFinite(Date.parse(closingAt)) ||
    !Number.isFinite(Date.parse(startAt)) ||
    Date.parse(closingAt) >= Date.parse(startAt)
  )
    return null;
  const p = new Decimal(closingProbability);
  if (!p.isFinite() || p.lte(0) || p.gte(1)) return null;
  return new Decimal(odds).mul(p).minus(1).toString();
}
