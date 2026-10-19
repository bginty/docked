"use client";
import { useEffect, useState } from "react";
import { playerScoreStatus, roundProgress } from "@/core/round-status";
import Link from "next/link";
import { CompetitionSwitch } from "./competition-switch";
import { competitionHref } from "@/core/prize-schedules";
import type { ReviewRound } from "@/core/competition-review";
import type { NflStanding, PostgameView } from "@/server/postgame-results";
import { competitionName } from "@/core/competition-display";
import {
  formatPoints,
  myTeamPage,
  seasonStandings,
  standingsPage,
  type StandingRound,
  type StandingRow,
  type SeasonRow,
} from "@/core/standings";
import { FantasySheet } from "./fantasy-player-sheet";
import { LegacyCompetitionResults } from "./legacy-competition-results";
import { displayCity } from "@/core/card-presentation";
import { CollectibleFace } from "./collectible-face";
import { rarityFrame, rarityStyle } from "@/core/rarity-theme";

type Selection = {
  sport?: string;
  competition?: string;
  mode?: string;
  period?: string;
  season?: string;
  week?: string;
  series?: string;
  page?: string;
  search?: string;
};
export function CompetitionResults({
  rounds,
  standings,
  records,
  initial,
  weekly = [],
  selection = {},
}: {
  rounds: ReviewRound[];
  standings: NflStanding[];
  records: PostgameView[];
  initial?: string;
  weekly?: StandingRound[];
  selection?: Selection;
}) {
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState<Selection>({
    ...selection,
    competition: selection.competition ?? initial,
  });
  const [detail, setDetail] = useState<{
    row: StandingRow;
    round: StandingRound;
  } | null>(null);
  const [weeks, setWeeks] = useState<SeasonRow | null>(null);
  useEffect(() => {
    const read = () =>
      setQuery(Object.fromEntries(new URLSearchParams(window.location.search)));
    read();
    setReady(true);
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);
  const selectedRound = weekly.find(
    (r) => r.competitionId === query.competition,
  );
  const mode =
    query.mode === "OPEN" || query.mode === "SALARY_CAP"
      ? query.mode
      : (selectedRound?.mode ?? "SALARY_CAP");
  const period = query.period === "season" ? "season" : "weekly";
  const available = weekly.filter((r) => r.mode === mode);
  const seasons = [...new Set(available.map((r) => r.season))].sort().reverse();
  const season = seasons.includes(query.season ?? "")
    ? query.season!
    : (selectedRound?.season ?? seasons[0] ?? "");
  const seasonRounds = available
    .filter((r) => r.season === season)
    .sort(
      (a, b) =>
        b.week - a.week || a.competitionId.localeCompare(b.competitionId),
    );
  const round =
    seasonRounds.find(
      (r) =>
        r.week === Number(query.week) &&
        (!query.series || r.series === query.series),
    ) ??
    seasonRounds.find((r) => r.competitionId === query.competition) ??
    seasonRounds[0];
  const seriesOptions = [...new Set(seasonRounds.map((r) => r.series))];
  const series = seriesOptions.includes(query.series ?? "")
    ? query.series!
    : (round?.series ?? "");
  const summary = seasonStandings(weekly, mode, season, series);
  const rows: (StandingRow | SeasonRow)[] =
    period === "season" ? summary.rows : (round?.rows ?? []);
  const mine = rows.find((r) => r.isMe);
  const paged = standingsPage(
    rows,
    query.search ?? "",
    Number(query.page ?? 1),
  );
  function change(patch: Selection) {
    const next = {
      ...query,
      mode,
      period,
      season,
      series,
      competition: round?.competitionId,
      week: String(round?.week ?? ""),
      page: "1",
      ...patch,
    };
    setQuery(next);
    setDetail(null);
    setWeeks(null);
    const url = new URL(window.location.href);
    url.search = "";
    for (const [key, value] of Object.entries(next))
      if (value) url.searchParams.set(key, value);
    window.history.pushState(null, "", url);
  }
  const context = {
    ...query,
    mode,
    period,
    season,
    series,
    competition: round?.competitionId,
    week: String(round?.week ?? ""),
  };
  const playUrl = competitionHref("/fantasy/play", context);
  return (
    <section className="standings-page" data-ready={ready}>
      <header className="standings-hero">
        <Link className="play-support" href={playUrl}>
          ← Back to Lineup
        </Link>
        <h1>Rankings</h1>
        <Link
          className="play-support"
          href={competitionHref("/fantasy/prizes", context)}
        >
          🏆 Prizes
        </Link>
        <p>
          See how you stack up{" "}
          {period === "season" ? "this season" : "this week"}.
        </p>
        <span className="competition-label">Competition</span>
        <CompetitionSwitch
          mode={mode}
          onChange={(mode) =>
            change({ mode, competition: "", week: "", series: "" })
          }
        />
      </header>
      <div className="standings-controls">
        <nav className="standings-segments" aria-label="Rankings period">
          {["weekly", "season"].map((p) => (
            <button
              key={p}
              aria-pressed={period === p}
              onClick={() => change({ period: p })}
            >
              {p === "weekly" ? "Weekly" : "Season"}
            </button>
          ))}
        </nav>
        <label>
          Season
          <select
            value={season}
            onChange={(e) =>
              change({
                season: e.target.value,
                competition: "",
                week: "",
                series: "",
              })
            }
          >
            {seasons.length ? (
              seasons.map((s) => <option key={s}>{s}</option>)
            ) : (
              <option value="">No seasons</option>
            )}
          </select>
        </label>
        {period === "weekly" && (
          <label>
            Week
            <select
              value={round?.competitionId ?? ""}
              onChange={(e) => {
                const r = seasonRounds.find(
                  (r) => r.competitionId === e.target.value,
                )!;
                change({
                  competition: r.competitionId,
                  week: String(r.week),
                  series: r.series,
                });
              }}
            >
              {seasonRounds.length ? (
                seasonRounds.map((r) => (
                  <option key={r.competitionId} value={r.competitionId}>
                    Week {r.week}
                  </option>
                ))
              ) : (
                <option value="">No weeks</option>
              )}
            </select>
          </label>
        )}
        {period === "season" && seriesOptions.length > 1 && (
          <label>
            Scoring series
            <select
              value={series}
              onChange={(e) => change({ series: e.target.value })}
            >
              {seriesOptions.map((s, i) => (
                <option key={s} value={s}>
                  Series {i + 1} · Weeks{" "}
                  {seasonRounds
                    .filter((r) => r.series === s)
                    .map((r) => r.week)
                    .sort((a, b) => a - b)
                    .join(", ")}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {period === "season" && (
        <p className="standings-context">
          {summary.latestWeek === null
            ? "No weeks have finalised"
            : `Through Week ${summary.latestWeek}`}{" "}
          · Finalised weeks only
          {summary.excluded > 0 &&
            ` · ${summary.excluded} pending or under-review weeks excluded`}
        </p>
      )}
      <div className="standings-metrics">
        <div>
          <span>Your {period === "season" ? "season " : ""}rank</span>
          <strong>{mine ? (mine.rank ?? "Pending") : "Not entered"}</strong>
        </div>
        <div>
          <span>{period === "season" ? "Season points" : "Your points"}</span>
          <strong>
            {mine ? formatPoints(mine.centipoints) : "Not entered"}
          </strong>
        </div>
        <div>
          <span>
            {period === "season" ? "Weeks entered / included" : "Entries"}
          </span>
          <strong>
            {period === "season"
              ? mine && "weeksEntered" in mine
                ? `${mine.weeksEntered} / ${mine.weeksIncluded}`
                : "Not entered"
              : (round?.rows.length ?? 0)}
          </strong>
        </div>
        {period === "weekly" && (
          <div>
            <span>Results status</span>
            <strong>
              {!round
                ? "Unavailable"
                : round.closesAt && round.fixtures
                  ? roundProgress({
                      closesAt: round.closesAt,
                      fixtures: round.fixtures,
                      visible: round.visible,
                      finalised: round.finalised,
                      completeScores:
                        round.rows.length > 0 &&
                        round.rows.every((r) => r.centipoints !== null),
                      now: round.serverTime ?? Date.now(),
                    }).label
                  : !round.visible
                    ? "Under review"
                    : round.finalised
                      ? "Final"
                      : round.rows.some((r) => r.centipoints !== null)
                        ? "Provisional"
                        : "Pending"}
            </strong>
          </div>
        )}
      </div>
      <div className="standings-search">
        <label>
          Search teams
          <input
            type="search"
            value={query.search ?? ""}
            onChange={(e) => change({ search: e.target.value })}
            placeholder="Team name"
          />
        </label>
        <button
          className="play-secondary"
          disabled={!mine}
          onClick={() =>
            change({ search: "", page: String(myTeamPage(rows) ?? 1) })
          }
        >
          Find My Team
        </button>
      </div>
      {!rows.length ? (
        <div className="standings-empty">
          <h2>
            {period === "season" ? "No season entries yet" : "No entries yet"}
          </h2>
          <p>
            Confirmed entries and their results will appear here. Pending scores
            are never recorded as zero.
          </p>
        </div>
      ) : (
        <div className="standings-table-wrap">
          <table className="standings-table" data-period={period}>
            <caption className="sr-only">
              {competitionName(mode)} {period} rankings · {season}
            </caption>
            <thead>
              <tr>
                <th scope="col">Rank</th>
                <th scope="col">Team name</th>
                {period === "season" && (
                  <th scope="col">
                    Weeks
                    <span className="standings-column-note">
                      entered / included
                    </span>
                  </th>
                )}
                <th scope="col">
                  {period === "season" ? "Total points" : "Adjusted points"}
                </th>
                {period === "weekly" && <th scope="col">Status</th>}
                <th scope="col">
                  <span className="sr-only">View entry</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paged.rows.map((r) => (
                <tr key={r.key} className={r.isMe ? "current-member" : ""}>
                  <td>{r.rank ?? "—"}</td>
                  <th scope="row">
                    {r.name}
                    {r.isMe && <small> · You</small>}
                  </th>
                  {"weeksEntered" in r && period === "season" && (
                    <td>
                      {r.weeksEntered} / {r.weeksIncluded}
                    </td>
                  )}
                  <td>{formatPoints(r.centipoints)}</td>
                  {period === "weekly" && (
                    <td>
                      {r.status === "final"
                        ? "Final"
                        : r.status === "provisional"
                          ? "Provisional"
                          : r.status === "under-review"
                            ? "Under review"
                            : "Pending"}
                    </td>
                  )}
                  <td>
                    {period === "season" && "weeks" in r ? (
                      <button
                        className="play-support"
                        onClick={() => setWeeks(r)}
                      >
                        View Weeks
                      </button>
                    ) : (
                      <button
                        className="play-support"
                        onClick={() => round && setDetail({ row: r, round })}
                      >
                        View Lineup
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!paged.rows.length && (
            <p>
              No teams match this search.{" "}
              <button onClick={() => change({ search: "" })}>
                Clear search
              </button>
            </p>
          )}
        </div>
      )}
      <nav className="standings-pagination" aria-label="Rankings pages">
        <button
          className="play-support"
          disabled={paged.page === 1}
          onClick={() => change({ page: String(paged.page - 1) })}
        >
          Previous
        </button>
        <span>
          Page {paged.page} of {paged.pages} · {paged.total} teams
        </span>
        <button
          className="play-support"
          disabled={paged.page === paged.pages}
          onClick={() => change({ page: String(paged.page + 1) })}
        >
          Next
        </button>
      </nav>
      <div className="play-support-actions">
        <Link className="play-secondary" href={playUrl}>
          Back to Lineup
        </Link>
        <Link
          className="play-support"
          href={`/fantasy/scoring/how-it-works${round ? `?competition=${round.competitionId}` : ""}`}
        >
          Scoring Rules
        </Link>
      </div>
      <details className="standings-explanation">
        <summary>How rankings work</summary>
        <p>
          Shared ranks use 1, 1, 3 for a tie. Order within a tied group does not
          break the tie. Weekly rankings wait for every entry’s required
          statistics. Season totals include finalised weeks in this competition
          and scoring series only; corrections and reopened reviews update the
          totals. Weeks entered includes pending weeks.
        </p>
        <p>
          Opposing lineups stay private until every player has locked and the
          competition’s publication policy allows viewing. Scores are processed
          after games.
        </p>
      </details>
      <details className="standings-explanation">
        <summary>Archive / Legacy rounds</summary>
        <LegacyCompetitionResults
          rounds={rounds.filter((r) => !r.lineup)}
          standings={standings}
          records={records}
        />
      </details>
      {detail && (
        <FantasySheet
          title={`${detail.row.name} · Week ${detail.round.week}`}
          onClose={() => setDetail(null)}
        >
          <p>
            {competitionName(detail.round.mode)} · {detail.round.season} ·{" "}
            {formatPoints(detail.row.centipoints)} points
          </p>
          {detail.row.lineup === null ? (
            <p>
              This lineup is private. Opposing selections are shown only after
              all player locks and permission under the competition’s
              publication policy.
            </p>
          ) : (
            <div className="standings-lineup">
              {detail.row.lineup.map((p) => (
                <article key={p.slot}>
                  <div
                    className={`standings-player-card ${rarityFrame(p.tier)}`}
                    style={rarityStyle(p.tier)}
                  >
                    <CollectibleFace
                      variant="lineup"
                      showNumber
                      card={{
                        ...p,
                        name: p.name || "Player name unavailable",
                        sport: "nfl",
                      }}
                      appliedMultiplier={p.multiplier ?? undefined}
                    />
                  </div>
                  <p>
                    {p.slot} · {p.locked ? "Locked" : "Not locked"} ·{" "}
                    {displayCity({ sport: "nfl", team: p.team })}
                  </p>
                  <dl>
                    <dt>Base points</dt>
                    <dd>{formatPoints(p.baseCentipoints)}</dd>
                    <dt>Applied multiplier</dt>
                    <dd>
                      {p.multiplier === null
                        ? "Unavailable"
                        : `${p.multiplier.toFixed(1)}×`}
                    </dd>
                    <dt>Adjusted points</dt>
                    <dd>{formatPoints(p.centipoints)}</dd>
                  </dl>
                  <small>{playerScoreStatus(p.status)}</small>
                  {p.parts.length > 0 && (
                    <details>
                      <summary>Scoring breakdown</summary>
                      {p.parts.map((part, i) => (
                        <p key={i}>
                          {part.statistic}: {part.quantity} ·{" "}
                          {formatPoints(part.centipoints)}
                        </p>
                      ))}
                    </details>
                  )}
                </article>
              ))}
            </div>
          )}
        </FantasySheet>
      )}
      {weeks && (
        <FantasySheet
          title={`${weeks.name} · ${season}`}
          onClose={() => setWeeks(null)}
        >
          <p>{competitionName(mode)} · Finalised weeks only</p>
          {weeks.weeks
            .sort((a, b) => b.round.week - a.round.week)
            .map(({ round: r, entry }) => (
              <div className="standings-week" key={r.competitionId}>
                <strong>Week {r.week}</strong>
                <span>
                  {r.finalised && r.visible
                    ? formatPoints(entry.centipoints)
                    : "Not included · pending / review"}
                </span>
                <button
                  className="play-support"
                  onClick={() => {
                    setWeeks(null);
                    change({
                      period: "weekly",
                      competition: r.competitionId,
                      week: String(r.week),
                      series: r.series,
                    });
                    setDetail({ row: entry, round: r });
                  }}
                >
                  View Lineup
                </button>
              </div>
            ))}
        </FantasySheet>
      )}
    </section>
  );
}
