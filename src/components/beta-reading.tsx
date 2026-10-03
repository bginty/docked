import Link from "next/link";
import {
  weekendWatchlist,
  visibleWeekendWatchlist,
  watchlistLabel,
} from "@/content/weekend-watchlist";

export function WeekendWatchlist() {
  const items = visibleWeekendWatchlist(weekendWatchlist);
  return (
    <section
      className="app-panel beta-watchlist"
      aria-labelledby="weekend-watchlist-title"
    >
      <h2 id="weekend-watchlist-title">Weekend Watchlist</h2>
      <p className="eyebrow">{watchlistLabel}</p>
      {items.length ? (
        items.map((item) => (
          <article key={item.id}>
            <h3>{item.event}</h3>
            <p>
              {item.sport} ·{" "}
              <time dateTime={item.startAt}>
                {new Date(item.startAt).toLocaleString("en-AU", {
                  timeZone: "UTC",
                })}{" "}
                UTC
              </time>
            </p>
            <p>{item.whyWatch}</p>
            <p>{item.informationToEvaluate}</p>
            <a href={item.source.url} rel="noreferrer">
              Factual source
            </a>
            {item.corrections.map((c) => (
              <p key={c.at}>Correction: {c.reason}</p>
            ))}
          </article>
        ))
      ) : (
        <p>
          No current events have an approved source yet. Upcoming fixtures will
          appear after editorial verification.
        </p>
      )}
      <Link href="/feed">Discuss the sport</Link>
    </section>
  );
}
export function BetaReading({ watchlist = false }: { watchlist?: boolean }) {
  return (
    <div className="beta-reading">
      {watchlist && <WeekendWatchlist />}
      <section className="app-panel" aria-labelledby="beta-reading-title">
        <h2 id="beta-reading-title">Build your understanding.</h2>
        <p>Useful reading while research and data approvals are pending.</p>
        <ul className="beta-reading-links">
          <li>
            <Link href="/learn/read-a-docked-edge">
              What does TAKE mean? Read a Docked Edge
            </Link>
          </li>
          <li>
            <Link href="/learn/how-top-docked-works">
              How Top Docked earns a record
            </Link>
          </li>
          <li>
            <Link href="/learn/why-edge-records-stay">
              Why the losses stay visible
            </Link>
          </li>
          <li>
            <Link href="/learn/standard-units-and-roi">
              Understand units and ROI
            </Link>
          </li>
        </ul>
        <Link className="text-link" href="/research">
          Latest research status
        </Link>
      </section>
    </div>
  );
}
