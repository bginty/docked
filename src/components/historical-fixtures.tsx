"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSport } from "./sport-context";
import { boundedFetch } from "@/core/bounded-request";
import type { HistoricalPage } from "@/core/historical-fixtures";

export function HistoricalFixtures() {
  const { sport } = useSport();
  return <History key={sport} sport={sport} />;
}
function History({ sport }: { sport: string }) {
  const [data, setData] = useState<HistoricalPage | null>(null),
    [team, setTeam] = useState(""),
    [round, setRound] = useState(""),
    [page, setPage] = useState(0),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!["afl", "nrl"].includes(sport)) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void boundedFetch(
      `/api/fantasy/match-history?${new URLSearchParams({ sport, team, round, page: String(page) })}`,
      { signal: controller.signal, cache: "no-store" },
    )
      .then(async (r) => {
        if (!r.ok)
          throw Error("Match history could not be loaded. Please retry.");
        const d = await r.json();
        if (!controller.signal.aborted) setData(d);
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setData(null);
          setError(e.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [sport, team, round, page, attempt]);
  if (!["afl", "nrl"].includes(sport))
    return (
      <section>
        <h1>Match history</h1>
        <p>Select AFL or NRL for the imported 2026 match archive.</p>
        <Link href={`/fantasy/play?sport=${sport}`}>Back to Play</Link>
      </section>
    );
  return (
    <section className="historical-matches">
      <header>
        <h1>{sport.toUpperCase()} · 2026 results</h1>
        <p>Real league matches · Separate from Docked fantasy rounds.</p>
      </header>
      <Link href={`/fantasy/play?sport=${sport}`}>Back to Play</Link>
      {error && (
        <p role="alert">
          {error}{" "}
          <button onClick={() => setAttempt((x) => x + 1)}>Retry</button>
        </p>
      )}
      {data && (
        <>
          <p className="form-help">
            {data.total} matches · Player statistics not yet available
          </p>
          <div className="historical-filters">
            <label>
              Team
              <select
                aria-label="Team"
                value={team}
                onChange={(e) => {
                  setTeam(e.target.value);
                  setPage(0);
                }}
              >
                <option value="">All teams</option>
                {data.teams.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              Round
              <select
                aria-label="Round"
                value={round}
                onChange={(e) => {
                  setRound(e.target.value);
                  setPage(0);
                }}
              >
                <option value="">All rounds</option>
                {data.rounds.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="historical-match-list" aria-busy={loading}>
            {data.games.map((g) => (
              <article key={g.id} className="historical-match">
                <small>
                  {g.season_type === "POST" ? "Finals" : "Round"}{" "}
                  {g.round !== "Finals" ? g.round : ""} · Final
                </small>
                <div>
                  <span>{g.home_name}</span>
                  <strong>{g.home_score}</strong>
                </div>
                <div>
                  <span>{g.away_name}</span>
                  <strong>{g.away_score}</strong>
                </div>
                <p>
                  {g.kickoff === null
                    ? "Date/time under review"
                    : new Date(g.kickoff * 1000).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}{" "}
                  · {g.venue ?? "Venue unavailable"}
                </p>
                <a href={g.provenance} target="_blank" rel="noreferrer">
                  Source
                </a>
              </article>
            ))}
          </div>
          <nav className="owned-pagination" aria-label="Match pages">
            <button
              disabled={loading || page === 0}
              onClick={() => setPage((x) => x - 1)}
            >
              Previous matches
            </button>
            <span>
              {data.filtered} matches · Page {page + 1}
            </span>
            <button
              disabled={loading || !data.hasMore}
              onClick={() => setPage((x) => x + 1)}
            >
              Next matches
            </button>
          </nav>
          <details className="sport-beta-details">
            <summary>Sources & coverage</summary>
            <p>
              {data.attribution ??
                "Match fixtures and scores provided by Squiggle. No player statistics are supplied by this source."}
            </p>
            <p>
              <a href={data.source_url}>{data.source}</a> ·{" "}
              <a href={data.rights_url}>Usage terms</a>
            </p>
            {data.source_revisions?.map((url) => (
              <p key={url}>
                <a href={url}>Source revision and contributors</a>
              </p>
            ))}
            <p>
              Imported {new Date(data.imported_at * 1000).toLocaleDateString()}.
              Historical snapshot; corrections require a reviewed re-import. No
              fantasy entries or results are created from this archive.
            </p>
          </details>
        </>
      )}
      {loading && <p role="status">Loading match history…</p>}
    </section>
  );
}
