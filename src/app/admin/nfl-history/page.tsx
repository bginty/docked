import { notFound } from "next/navigation";
import { requireRole } from "@/server/auth";
import { openNflHistory } from "@/server/nfl-history-connection";
import { historyStore } from "@/server/nfl-history-store";
import { nflTestingReport } from "@/server/nfl-testing-report";
import { NflTestingPanel } from "@/components/nfl-testing-panel";
import { NflRoundOperations } from "@/components/nfl-round-operations";
export const dynamic = "force-dynamic";
export default async function HistoryOperations() {
  try {
    await requireRole(["owner"]);
  } catch {
    notFound();
  }
  if (process.env.NFL_HISTORY_READ_ENABLED !== "true")
    return (
      <section className="fantasy-panel">
        <h1>NFL player history</h1>
        <p>Publication is not enabled.</p>
      </section>
    );
  const c = openNflHistory("reader");
  try {
    const report = await nflTestingReport(historyStore(c.db), true);
    if (report.health === "Postgame test feed connected")
      report.health = "Postgame history connected";
    return (
      <>
        <NflTestingPanel report={report} liveHistory />
        <NflRoundOperations />
        <p className="small-note">
          Statistics:{" "}
          <a href="https://github.com/nflverse/nflverse-data">nflverse</a>, CC
          BY 4.0. Fantasy calculations by Docked. Manual imports only. No
          competition settlement.
        </p>
      </>
    );
  } catch {
    return (
      <section className="fantasy-panel">
        <h1>NFL player history</h1>
        <p role="alert">
          Feed health is unavailable. Retained statistics must not be treated as
          newly verified.
        </p>
      </section>
    );
  } finally {
    await c.close();
  }
}
