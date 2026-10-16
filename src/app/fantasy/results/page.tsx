import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { postgameResults, nflStandings, playStandings } from "@/server/postgame-results";
import { fantasyRequest } from "@/server/fantasy";
import { CompetitionResults } from "@/components/competition-results";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Standings · Traditional & All-Star",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams;
  try {
    const [{ state }, records, standings, weekly] = await Promise.all([
      fantasyRequest(),
      postgameResults(),
      nflStandings(),
      playStandings(),
    ]);
    return (
      <AppShell authenticated>
        <CompetitionResults
          rounds={state.review?.rounds ?? []}
          records={records}
          standings={standings}
          initial={query.competition}
          selection={query}
          weekly={weekly}
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
