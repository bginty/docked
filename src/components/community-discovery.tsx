import Link from "next/link";
import { mostFollowedMembers } from "@/server/community-discovery";
import { topDockedBoard, type PublicTopDockedRow } from "@/server/top-docked";
import { MemberDiscovery } from "./community-feed";

function RankedMembers({ rows }: { rows: PublicTopDockedRow[] }) {
  return (
    <ul className="ranking-discovery-list">
      {rows.slice(0, 3).map((row) => (
        <li key={row.profileId}>
          {row.interactionsAllowed ? (
            <Link href={`/profile/${row.handle}`}>{row.displayName}</Link>
          ) : (
            <strong>{row.displayName}</strong>
          )}
          <p className="small-note">
            Rank {row.rank} · {row.performance.netUnits} units ·{" "}
            {row.performance.roi}% ROI · {row.performance.settled} settled ·
            maximum drawdown {row.performance.maxDrawdown} u
          </p>
        </li>
      ))}
    </ul>
  );
}
export async function PerformanceDiscovery({ sport }: { sport?: string }) {
  const [board, popular] = await Promise.all([
    topDockedBoard("month", sport),
    mostFollowedMembers(),
  ]);
  const qualified = board.rows.filter(
    (row) => row.qualification === "QUALIFIED",
  );
  const rising = qualified.filter((row) =>
    row.badges.some((b) => b.code === "RISING"),
  );
  const specialists = qualified.filter((row) =>
    row.badges.some((b) => b.code === "SPORT_SPECIALIST"),
  );
  return (
    <>
      <section className="app-panel" aria-label="Top Docked snapshot">
        <p className="eyebrow">TOP DOCKED · THIS MONTH</p>
        <h2>Qualified records</h2>
        {qualified.length ? (
          <RankedMembers rows={qualified} />
        ) : (
          <p>
            {board.status === "READY"
              ? "No member meets the sample and integrity requirements in this period. Provisional records are available on Top Docked."
              : board.message}
          </p>
        )}
        <Link
          className="text-link"
          href={`/top-docked?period=month${sport ? `&sport=${encodeURIComponent(sport)}` : ""}`}
        >
          Complete rankings and qualification
        </Link>
        <details>
          <summary>Rising and sport specialists</summary>
          <h3>Rising</h3>
          {rising.length ? (
            <RankedMembers rows={rising} />
          ) : (
            <p>
              Rising requires a qualified improvement against an earlier audited
              snapshot in the same period, with new eligible records. No
              supported movement is available.
            </p>
          )}
          <h3>Sport specialists</h3>
          {specialists.length ? (
            <RankedMembers rows={specialists} />
          ) : (
            <p>
              {sport
                ? "No qualified member has the required 50 non-void settled Edges across 14 active UTC days in this sport and period."
                : "Choose a sport filter to inspect its qualified samples. Specialist labels require 50 non-void settled Edges across 14 active UTC days."}
            </p>
          )}
        </details>
        <p className="form-help">
          Past performance does not guarantee future results. Rankings describe
          historical records; they do not predict future performance.
        </p>
      </section>
      <MemberDiscovery
        profiles={popular.profiles}
        title="Most followed"
        explanation={popular.message}
      />
    </>
  );
}
