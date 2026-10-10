import Link from "next/link";
import type { PostgameView } from "@/server/postgame-results";
const points = (n: number | null) =>
  n === null ? "Awaiting results" : (n / 100).toFixed(2);
const label = (s: string) =>
  s.replaceAll("_", " ").replace(/([a-z])([A-Z])/g, "$1 $2");
export function PostgameResults({ records }: { records: PostgameView[] }) {
  return (
    <section className="scoring-review postgame-results">
      <h1>Post-game points</h1>
      <p>
        Results are collected after games finish. Provisional points can change
        after source corrections; they are not live scores.
      </p>
      <p>
        <Link href="/fantasy/play">Back to Play</Link> ·{" "}
        <Link href="/fantasy/scoring/how-it-works">Scoring rules</Link>
      </p>
      {!records.length && (
        <article className="scoring-team">
          <h2>Awaiting results</h2>
          <p>
            No imported results are available for your entered competitions yet.
          </p>
        </article>
      )}
      {records.map((r) => (
        <article className="scoring-team" key={r.id}>
          <p className="scoring-badge">
            {r.purpose === "historical-acceptance"
              ? "HISTORICAL QA · REAL MATCH STATISTICS · TEST LINEUP"
              : "BETA COMPETITION"}
          </p>
          <h2>{r.view.period}</h2>
          {Date.now() - Date.parse(r.recordedAt) > 48 * 3600000 &&
            r.view.rows.some((row) => row.status !== "final") && (
              <p>
                Update delayed. These provisional points are awaiting another
                source check.
              </p>
            )}
          {r.purpose === "historical-acceptance" && (
            <p>
              This retrospective acceptance lineup is not a member competition.
              It awards no cards, points or prizes to an account.
            </p>
          )}
          <p>
            {r.view.rulesVersion} · Revision {r.revision} · Updated{" "}
            <time dateTime={r.recordedAt}>
              {new Date(r.recordedAt).toLocaleString("en-AU", {
                timeZone: "Australia/Sydney",
              })}{" "}
              Sydney
            </time>
          </p>
          {r.view.rows.map((row, i) => (
            <div key={i}>
              <h3>
                {row.name}: {points(row.centipoints)}
              </h3>
              <p>{label(row.status)}</p>
              {row.players.map((p) => (
                <details key={p.cardId}>
                  <summary>
                    {r.metadata.players?.[p.playerId] ?? p.playerId} ·{" "}
                    {p.position} · {points(p.centipoints)}
                  </summary>
                  {p.matches.map((m) => (
                    <div key={m.fixtureId}>
                      <p>
                        {label(m.status)}
                        {m.updatedAt
                          ? ` · Source observation ${new Date(m.updatedAt).toLocaleString("en-AU", { timeZone: "Australia/Sydney" })} Sydney`
                          : ""}
                      </p>
                      {m.score ? (
                        <table>
                          <caption>Player scoring breakdown</caption>
                          <thead>
                            <tr>
                              <th scope="col">Statistic</th>
                              <th scope="col">Quantity</th>
                              <th scope="col">Points earned</th>
                            </tr>
                          </thead>
                          <tbody>
                            {m.score.parts.map((s, j) => (
                              <tr key={j}>
                                <th scope="row">{label(s.statistic)}</th>
                                <td>{s.quantity}</td>
                                <td>{points(s.centipoints)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p>
                          Required statistics are missing or under review. No
                          zero score has been assigned.
                        </p>
                      )}
                    </div>
                  ))}
                </details>
              ))}
            </div>
          ))}
        </article>
      ))}
      <p>
        Data: <a href="https://github.com/nflverse/nflverse-data">nflverse</a>,{" "}
        <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.
        Selected statistics are normalised and scored using Docked rules. Docked
        is not endorsed by the source.
      </p>
    </section>
  );
}
