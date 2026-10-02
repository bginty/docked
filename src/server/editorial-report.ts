import { DateTime } from "luxon";
import { db } from "./db";
import { ledger, type LedgerRow } from "@/core/ledger";
export async function editorialReport(kind: string, at: string) {
  const now = DateTime.fromISO(at, { zone: "utc" }).setZone(
    "Australia/Melbourne",
  );
  const end =
    kind === "weekly-results" ? now.startOf("week") : now.startOf("month");
  const from =
    kind === "weekly-results"
      ? end.minus({ weeks: 1 })
      : end.minus({ months: 1 });
  const sql = db();
  const tips =
    await sql`select p.*,e.competition_id,coalesce(s.result,'pending') result,s.created_at settled_at,(select count(*) from private.availability_observations a where a.tip_id=p.id and a.observed_at<=${at}) observations from private.tip_publications p join private.events e on e.id=p.event_id left join lateral (select result,created_at from private.settlement_events where tip_id=p.id and created_at<=${at} order by created_at desc limit 1) s on true where p.evidence='live_published' and p.published_at>=${from.toUTC().toISO()!} and p.published_at<${end.toUTC().toISO()!} order by p.published_at`;
  const rows: LedgerRow[] = tips.map((t) => ({
    id: t.id,
    eventId: t.event_id,
    publishedAt: t.published_at.toISOString(),
    settledAt: t.settled_at?.toISOString(),
    odds: t.odds,
    stake: "1",
    evidence: "live_published",
    result: t.result,
    sport: t.competition_id,
    strategy: t.strategy_id,
  }));
  const stats = ledger(rows, "live_published");
  return {
    title:
      kind === "weekly-results"
        ? "Prior-week publication cohort review"
        : "Prior-month methodology and record review",
    body: `DRAFT FOR EVIDENCE AND REGIONAL REVIEW\nPublication cohort: ${from.toISODate()} to ${end.toISODate()} exclusive, Australia/Melbourne. Settlement as of ${at}. This is a publication cohort, not all results settled during the period.\n\n${JSON.stringify(stats, null, 2)}\n\nAvailability: ${tips.filter((t) => Number(t.observations) > 0).length}/${tips.length} publications have measured observations. Unmeasured prices/limits remain unknown. Complete included publication IDs: ${tips.map((t) => t.id).join(", ") || "none"}.\n\nLosses, voids and pending entries are retained. Corrections may change the latest settlement and must be disclosed when republishing. No sample size alone proves a profitable strategy. Review missing data, individual price access, strategy changes and source rights before approval.`,
  };
}
