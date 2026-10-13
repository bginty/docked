import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { postgameResults, nflStandings } from "@/server/postgame-results";
import { fantasyRequest } from "@/server/fantasy";
import { CompetitionResults } from "@/components/competition-results";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "NFL results & leaderboards",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ competition?: string }>;
}) {
  const query = await searchParams;
  try {
    const [{ state }, records, standings] = await Promise.all([
      fantasyRequest(),
      postgameResults(),
      nflStandings(),
    ]);
    return (
      <AppShell authenticated>
        <CompetitionResults
          rounds={state.review?.rounds ?? []}
          records={records}
          standings={standings}
          initial={query.competition}
        />
      </AppShell>
    );
  } catch {
    return (
      <AppShell authenticated>
        <section className="scoring-review">
          <h1>Results temporarily unavailable</h1>
          <p>
            Check your connection or sign in again. An unavailable service is
            not an empty or completed round.
          </p>
          <a href="/fantasy/results">Retry results</a> ·{" "}
          <Link href="/app/login">Sign in</Link> ·{" "}
          <Link href="/fantasy/play">Play</Link>
        </section>
      </AppShell>
    );
  }
}
