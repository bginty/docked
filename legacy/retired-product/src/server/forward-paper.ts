import Decimal from "decimal.js";
import { ledger, type LedgerRow } from "@/core/ledger";
import { db } from "./db";

export async function forwardPaperReport(strategyId: string) {
  const sql = db();
  const strategies =
    await sql`select s.id,s.config_hash,s.lifecycle,s.code_commit,
    (select min(created_at) from private.strategy_transitions t where t.strategy_id=s.id and t.to_state='FORWARD_PAPER') started_at,
    (select min(created_at) from private.strategy_transitions t where t.strategy_id=s.id and t.from_state='FORWARD_PAPER') ended_at
    from private.strategy_versions s where s.id=${strategyId}`;
  const strategy = strategies[0] ?? null;
  const started = strategy?.started_at ?? null;
  const ended = strategy?.ended_at ?? null;
  const [rows, decisions, availability, incidents] = await Promise.all([
    sql`select p.id,p.event_id,p.published_at,p.odds,p.benchmark_stake,p.estimated_ev,p.strategy_id,e.competition_id,e.start_at,
      coalesce((select result from private.settlement_events where tip_id=p.id order by created_at desc,id desc limit 1),'pending') result,
      (select created_at from private.settlement_events where tip_id=p.id order by created_at desc,id desc limit 1) settled_at,
      (select p.odds*c.probability-1 from private.closing_snapshots c where c.tip_id=p.id and c.source_at<=c.cutoff and c.cutoff<e.start_at) clv
      from private.tip_publications p join private.events e on e.id=p.event_id where p.strategy_id=${strategyId} and p.evidence='forward_paper' order by p.published_at`,
    sql`select count(distinct event_id)::int events,count(*)::int decisions,count(*) filter(where payload ? 'offer')::int candidates,count(*) filter(where status='rejected')::int rejected from private.candidate_decisions where strategy_id=${strategyId} and decision_at>=${started} and (${ended}::timestamptz is null or decision_at<${ended})`,
    sql`select a.target_minutes,count(*)::int observed,count(*) filter(where a.qualifies is true)::int qualifying,count(*) filter(where a.qualifies is null)::int unavailable from private.availability_observations a join private.tip_publications p on p.id=a.tip_id where p.strategy_id=${strategyId} and p.evidence='forward_paper' group by a.target_minutes order by a.target_minutes`,
    sql`select count(*)::int n from private.provider_poll_runs where status<>'success' and started_at>=${started} and (${ended}::timestamptz is null or started_at<${ended})`,
  ]);
  const entries: LedgerRow[] = rows.map((r) => ({
    id: r.id,
    eventId: r.event_id,
    publishedAt: r.published_at.toISOString(),
    settledAt: r.settled_at?.toISOString(),
    odds: r.odds,
    stake: r.benchmark_stake,
    evidence: "forward_paper",
    result: r.result,
    sport: r.competition_id,
    strategy: r.strategy_id,
    ev: r.estimated_ev,
    ...(r.clv === null ? {} : { clv: r.clv }),
  }));
  const summary = ledger(entries, "forward_paper");
  return {
    strategy,
    daysRunning: strategy?.started_at
      ? Math.max(
          0,
          Math.floor(
            ((ended ? new Date(ended).getTime() : Date.now()) -
              new Date(strategy.started_at).getTime()) /
              86400000,
          ),
        )
      : null,
    eventsEvaluated: decisions[0]?.events ?? 0,
    candidates: decisions[0]?.candidates ?? 0,
    decisions: decisions[0]?.decisions ?? 0,
    rejected: decisions[0]?.rejected ?? 0,
    summary,
    averageEstimatedEv: entries.length
      ? Decimal.sum(...entries.map((r) => r.ev!))
          .div(entries.length)
          .mul(100)
          .toFixed(2)
      : null,
    availability: [5, 15, 60].map((minutes) => {
      const a = availability.find((r) => r.target_minutes === minutes);
      return {
        minutes,
        observed: a?.observed ?? 0,
        qualifying: a?.qualifying ?? 0,
        unavailable: a?.unavailable ?? 0,
        rate:
          a && a.observed > a.unavailable
            ? new Decimal(a.qualifying)
                .div(a.observed - a.unavailable)
                .mul(100)
                .toFixed(1)
            : null,
      };
    }),
    dataHealthIncidents: strategy?.started_at ? (incidents[0]?.n ?? 0) : null,
    entries,
  };
}
