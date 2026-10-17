import type { FeedDb } from "@/server/nfl-testing-store";
export async function NflRefreshHealth({ db }: { db: FeedDb }) {
  const { rows } = await db.query(`select distinct on(detail->>'phase') detail
    from nfl_history.audit where action='refresh-status'
    order by detail->>'phase',(detail->>'at')::numeric desc,id desc`);
  const events = rows.map((r) => r.detail).sort((a, b) => b.at - a.at);
  const find = (phase: string) => events.find((e) => e.phase === phase);
  const date = (seconds?: number) => seconds ? new Date(seconds * 1000).toLocaleString("en-AU", { timeZone: "Australia/Sydney", timeZoneName: "short" }) : "Not yet recorded";
  const latest = events[0], source = find("source"), delivery = find("delivered");
  const overdue = !delivery || Date.now() / 1000 - delivery.at > 8 * 3600;
  return <section className="fantasy-panel">
    <h2>Automatic postgame refresh</h2>
    <p>{latest?.phase === "failed" ? "Last refresh failed; previous statistics retained." : overdue ? "Delivery overdue or not yet verified. Check the Windows computer." : latest?.phase === "attempt" || latest?.phase === "source" ? "Refresh in progress; previous delivery remains current." : "Last signed delivery succeeded."}</p>
    <dl>
      <dt>Last attempt</dt><dd>{date(find("attempt")?.at)}</dd>
      <dt>Last successful source refresh</dt><dd>{date(source?.at)}</dd>
      <dt>Statistics retrieved from nflverse</dt><dd>{date(source?.sourceFetchedAt)}</dd>
      <dt>Source update time</dt><dd>{date(source?.sourceUpdatedAt)}</dd>
      <dt>Last successful delivery</dt><dd>{date(delivery?.at)}</dd>
      <dt>Changed records in last delivered refresh</dt><dd>{delivery?.changedRecords ?? "Not yet recorded"}</dd>
      <dt>Most recent error</dt><dd>{find("failed") ? `${find("failed").error} — ${date(find("failed").at)}` : "None recorded"}</dd>
    </dl>
    <p className="small-note">Postgame testing feed. Windows checks every six hours and after scheduled game-day publications. The computer must be awake, online and signed in. Locked Windows is supported. Upstream publication can be delayed.</p>
  </section>;
}
