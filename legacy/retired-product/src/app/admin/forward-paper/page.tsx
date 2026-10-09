import Link from "next/link";
import { requireRole } from "@/server/auth";
import { db } from "@/server/db";
import { forwardPaperReport } from "@/server/forward-paper";
import { Notice, PageHeading } from "@/components/ui";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Forward paper validation",
  robots: { index: false, follow: false },
};
export default async function ForwardPaper({
  searchParams,
}: {
  searchParams: Promise<{ strategy?: string }>;
}) {
  try {
    await requireRole(["owner", "admin", "analyst", "auditor"]);
  } catch {
    return (
      <div className="page">
        <PageHeading
          eyebrow="FORWARD PAPER VALIDATION"
          title="Verified access required."
        />
        <Notice>
          Staff role and MFA required. No paper records are public.
        </Notice>
        <Link href="/login">Log in</Link>
      </div>
    );
  }
  const sql = db();
  const strategies =
    await sql`select id,lifecycle from private.strategy_versions order by state_changed_at desc`;
  const params = await searchParams;
  const id =
    params.strategy && strategies.some((s) => s.id === params.strategy)
      ? params.strategy
      : strategies[0]?.id;
  const report = id ? await forwardPaperReport(id) : null;
  const s = report?.summary;
  const fields = [
    ["Days running", report?.daysRunning],
    ["Events evaluated", report?.eventsEvaluated],
    ["Candidate opportunities", report?.candidates],
    ["Paper selections", s?.count],
    ["Settled selections", s?.settled],
    ["Wins", s?.won],
    ["Losses", s?.lost],
    ["Voids", s?.voids],
    ["Net units", s?.net],
    ["ROI", s?.roi == null ? null : `${s.roi}%`],
    [
      "Average estimated EV",
      report?.averageEstimatedEv == null
        ? null
        : `${report.averageEstimatedEv}%`,
    ],
    ["CLV", s?.clv == null ? null : `${(Number(s.clv) * 100).toFixed(2)}%`],
    ["Maximum drawdown", s?.drawdown],
    ["Longest losing run", s?.longestLosingRun],
    ["Data-health incidents", report?.dataHealthIncidents],
    ["Rejected decisions", report?.rejected],
  ];
  return (
    <div className="page">
      <PageHeading
        eyebrow="FORWARD PAPER VALIDATION"
        title="Observe the frozen rules."
      />
      <Notice>
        Private paper selections use the prospective pricing engine, immutable
        pre-event timestamps and one-unit accounting. They never trigger public
        notifications. Estimated EV and paper returns do not establish a genuine
        edge.
      </Notice>
      <p>
        <Link href="/admin">Operations</Link> ·{" "}
        <Link href="/admin/strategies">Strategy lifecycle</Link>
      </p>
      {strategies.length ? (
        <form method="get">
          <label>
            Strategy version
            <select name="strategy" defaultValue={id}>
              {strategies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id} · {s.lifecycle}
                </option>
              ))}
            </select>
          </label>
          <button className="button" type="submit">
            View strategy
          </button>
        </form>
      ) : (
        <Notice>
          No strategy has entered forward paper. No performance data exists.
        </Notice>
      )}
      <div className="admin-grid">
        {fields.map(([label, value]) => (
          <section className="card" key={String(label)}>
            <h2>{label}</h2>
            <p>{value ?? "Not available"}</p>
          </section>
        ))}
      </div>
      <section className="card">
        <h2>Price availability</h2>
        {report?.availability.map((a) => (
          <p key={a.minutes}>
            {a.minutes} minutes:{" "}
            {a.rate === null ? "Not available" : `${a.rate}%`} · {a.observed}{" "}
            observations · {a.unavailable} unavailable. The rate excludes
            missing observations, reported separately.
          </p>
        ))}
        <p>
          Missing prices are not treated as failures or zero odds. Observation
          coverage must be reviewed alongside availability.
        </p>
      </section>
      <section className="card">
        <h2>Complete paper ledger</h2>
        {report?.entries.length ? (
          report.entries.map((r) => (
            <p key={r.id}>
              {r.publishedAt} · {r.eventId} · {r.result} · {r.odds} decimal · 1
              unit
            </p>
          ))
        ) : (
          <p>
            No paper selections recorded. Losses and withdrawals remain in this
            record once selections exist.
          </p>
        )}
      </section>
      <section className="card">
        <h2>Monthly net units</h2>
        {s && Object.keys(s.months).length ? (
          Object.entries(s.months).map(([month, net]) => (
            <p key={month}>
              {month}: {net} units
            </p>
          ))
        ) : (
          <p>No settled months.</p>
        )}
      </section>
    </div>
  );
}
