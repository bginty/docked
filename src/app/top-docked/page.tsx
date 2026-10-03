import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import {
  AppHeading,
  CommunityEmpty,
  IntegrityNote,
} from "@/components/community-basics";
import { LeaderboardTable } from "@/components/community-performance";
import { appViewer } from "@/server/app-view";
import { topDockedBoard } from "@/server/top-docked";
import { topDockedRuleV1, type RankingPeriod } from "@/core/top-docked";
import { NativeShare } from "@/components/native-share";
import { PreviewTopDocked } from "@/components/preview-top-docked";
import { previewTesterCapabilities } from "@/server/preview-testers";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Top Docked",
  robots: { index: false, follow: false },
};
const periods: [RankingPeriod, string][] = [
  ["week", "This week"],
  ["month", "This month"],
  ["90d", "90 days"],
  ["ytd", "YTD"],
  ["all", "All time"],
];
export default async function TopDocked({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const q = await searchParams;
  const period = periods.some(([id]) => id === q.period)
    ? (q.period as RankingPeriod)
    : "month";
  const [{ who }, previewCapabilities] = await Promise.all([
    appViewer(),
    previewTesterCapabilities(),
  ]);
  // An explicit isolated preview entitlement never grants a real leaderboard read.
  if (previewCapabilities.includes("preview_top_docked"))
    return (
      <AppShell authenticated={!!who}>
        <PreviewTopDocked />
      </AppShell>
    );
  const board = await topDockedBoard(period, q.sport);
  return (
    <AppShell authenticated={!!who}>
      <AppHeading eyebrow="TOP DOCKED" title="The record earns the rank.">
        Historical verified community records, ranked by net standardised units
        after qualification. Not a prediction of future performance.
      </AppHeading>
      <nav className="period-tabs" aria-label="Leaderboard period">
        {periods.map(([id, label]) => (
          <Link
            key={id}
            href={`/top-docked?period=${id}${q.sport ? `&sport=${encodeURIComponent(q.sport)}` : ""}`}
            aria-current={id === period ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      {board.availableSports.length > 0 && (
        <nav className="sport-chips" aria-label="Qualified leaderboard sport">
          <Link
            href={`/top-docked?period=${period}`}
            aria-current={!q.sport ? "page" : undefined}
          >
            All sports
          </Link>
          {board.availableSports.map((sport) => (
            <Link
              key={sport}
              href={`/top-docked?period=${period}&sport=${encodeURIComponent(sport)}`}
              aria-current={q.sport === sport ? "page" : undefined}
            >
              {sport.replaceAll("_", " ")}
            </Link>
          ))}
        </nav>
      )}
      {board.rows.length ? (
        <>
          <p className="small-note">
            Calculated {board.asOf} · {board.rule.version}
          </p>
          <LeaderboardTable rows={board.rows} />
          <NativeShare
            path="/top-docked"
            title="Docked community leaderboard"
          />
        </>
      ) : (
        <CommunityEmpty
          title={
            board.status === "EMPTY"
              ? "No qualified record to rank yet"
              : "Leaderboard not available"
          }
        >
          {board.message}
        </CommunityEmpty>
      )}
      <section className="app-panel" id="rules">
        <h2>Qualification is part of the result.</h2>
        <p>
          Rule version: <strong>{topDockedRuleV1.version}</strong>. At least{" "}
          {topDockedRuleV1.minimumSettled} settled, non-void verified Edges
          across {topDockedRuleV1.minimumActiveDays} active UTC days are
          required within the selected window. Unresolved integrity flags
          prevent ranking.
        </p>
        <p>
          Only standard, provider-verified, supported pre-event records count.
          Promotional prices, screenshots, social claims, demo data and official
          Docked strategy records are excluded. Provisional members receive no
          rank and show their remaining sample requirements.
        </p>
        <p>
          Primary order is net standardised units. Ties use lower maximum
          drawdown, then a stable profile identifier. ROI divides net units by
          settled non-void standard units. Wins, losses, voids and pending
          records remain visible; no dollars or personal stakes are used.
        </p>
        <p>
          Followers, engagement and paid membership give no ranking advantage.
          Sports filters and discovery badges need enough eligible evidence; no
          sport leaders or achievements are invented before that evidence
          exists.
        </p>
        <p>
          Past performance does not guarantee future results. Top Docked
          measures historical verified records under published rules; it does
          not predict future performance.
        </p>
      </section>
      <IntegrityNote />
    </AppShell>
  );
}
