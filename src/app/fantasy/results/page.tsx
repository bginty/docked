import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { postgameResults, nflStandings } from "@/server/postgame-results";
import { PostgameResults } from "@/components/postgame-results";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Post-game points",
  robots: { index: false, follow: false },
};
export default async function Page() {
  let records, standings;
  try {
    [records, standings] = await Promise.all([
      postgameResults(),
      nflStandings(),
    ]);
  } catch {
    return (
      <AppShell authenticated>
        <section className="scoring-review">
          <h1>Post-game points unavailable</h1>
          <p>
            Sign in with your eligible beta account, or try again if the service
            is temporarily unavailable.
          </p>
          <Link href="/app/login">Sign in</Link> ·{" "}
          <Link href="/fantasy/play">Back to Play</Link>
        </section>
      </AppShell>
    );
  }
  return (
    <AppShell authenticated>
      <PostgameResults records={records} />
      <section className="scoring-review">
        <h2>NFL standings</h2>
        <p>
          Post-game results. Ties share rank; no prizes. Rankings wait for
          complete required statistics.
        </p>
        {!standings.length && (
          <p>Your entered rounds appear here after lineups lock.</p>
        )}
        {standings.map((s) => (
          <article className="scoring-team" key={s.competitionId}>
            <h3>{s.label}</h3>
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Team</th>
                  <th>Points</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {s.rows.map((r, i) => (
                  <tr key={i}>
                    <td>{r.rank ?? "Pending"}</td>
                    <th scope="row">{r.name}</th>
                    <td>
                      {r.points === null
                        ? "Awaiting results"
                        : Number(r.points).toFixed(2)}
                    </td>
                    <td>{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        ))}
      </section>
    </AppShell>
  );
}
