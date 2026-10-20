"use client";
import { useEffect, useState } from "react";
import { currentPoints, currentRank, gameDayPoints } from "@/core/game-day";
import { useGameDay } from "./use-game-day";
import { GameDaySummary } from "./game-day-summary";
import { GameDayPlayerScore } from "./game-day-player-score";
import { SevenField } from "./seven-field";
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
  weekly: initialWeekly = [],
  selection = {},
}: {
  rounds: ReviewRound[];
  standings: NflStanding[];
  records: PostgameView[];
  initial?: string;
  weekly?: StandingRound[];
  selection?: Selection;
}) {
  const live = useGameDay(initialWeekly);
  const weekly = live.rounds;
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
    setDetail((previous) => {
      if (!previous) return null;
      const round = weekly.find(
        (r) => r.competitionId === previous.round.competitionId,
      );
      const row = round?.rows.find((r) => r.key === previous.row.key);
      return round && row ? { round, row } : null;
    });
  }, [weekly]);
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
          onChange={(mode) => change({ mode, competition: "", series: "" })}
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
      {live.error && (
        <p role="status">
          {live.error}{" "}
          <button className="play-support" onClick={live.retry}>
            Retry scores
          </button>
        </p>
      )}
      {period === "weekly" && round ? (
        <GameDaySummary round={round} entry={mine} title="Your standing" />
      ) : (
        <div className="game-day-summary">
          <div className="game-day-numbers">
            <div>
              <span>Your rank</span>
              <strong>{mine?.rank ?? "—"}</strong>
            </div>
            <div>
              <span>Season points</span>
              <strong>{gameDayPoints(mine?.centipoints)}</strong>
            </div>
            <div>
              <span>Weeks included</span>
              <strong>{summary.included}</strong>
            </div>
          </div>
        </div>
      )}
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
                  {period === "season" ? "Total points" : "Points"}
                </th>
                {period === "weekly" && <th scope="col">Played</th>}
                <th scope="col">
                  <span className="sr-only">View entry</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paged.rows.map((r) => (
                <tr key={r.key} className={r.isMe ? "current-member" : ""}>
                  <td>
                    {(period === "weekly" ? currentRank(r) : r.rank) ?? "—"}
                  </td>
                  <th scope="row">
                    {r.name}
                    {r.isMe && <small> · You</small>}
                  </th>
                  {"weeksEntered" in r && period === "season" && (
                    <td>
                      {r.weeksEntered} / {r.weeksIncluded}
                    </td>
                  )}
                  <td>
                    {period === "weekly"
                      ? gameDayPoints(currentPoints(r))
                      : formatPoints(r.centipoints)}
                  </td>
                  {period === "weekly" && (
                    <td>
                      {r.completedPlayers ?? "—"}/
                      {r.totalPlayers ?? r.lineup?.length ?? "—"} played
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
                        View Team
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
      {paged.pages > 1 && (
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
      )}
      <details className="standings-explanation">
        <summary>How rankings work</summary>
        <p>
          Shared ranks use 1, 1, 3 for a tie. Order within a tied group does not
          break the tie. Weekly rankings wait for every entry’s required
          statistics for final results. Current rankings compare available
          authoritative points and remain provisional. Season totals include
          finalised weeks in this competition and scoring series only;
          corrections and reopened reviews update the totals. Weeks entered
          includes pending weeks.
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
          className="community-team-sheet"
          historyEntry
          title={`${detail.row.name} · Week ${detail.round.week}`}
          onClose={() => setDetail(null)}
        >
          <button className="play-support" onClick={() => setDetail(null)}>
            ← Back to Rankings
          </button>
          <GameDaySummary
            round={detail.round}
            entry={detail.row}
            title={detail.row.name}
          />
          {detail.row.lineup === null ? (
            <p>
              This lineup is private until its selections lock and viewing is
              authorised.
            </p>
          ) : (
            <div className="lineup-pitch community-team-field">
              <SevenField label="Locked team lineup">
                {(slot) => {
                  const p = detail.row.lineup?.find(
                    (player) => player.slot === slot.id,
                  );
                  if (!p) return <span>{slot.id} · Selection unavailable</span>;
                  return (
                    <article
                      data-card-id={p.cardId}
                      className={`field-player ${rarityFrame(p.tier)}`}
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
                      <span className="collectible-context">
                        <span>{p.slot}</span>
                      </span>
                      <GameDayPlayerScore
                        player={p}
                        now={detail.round.serverTime ?? Date.now()}
                      />
                    </article>
                  );
                }}
              </SevenField>
              <details className="standings-explanation">
                <summary>Scoring breakdown</summary>
                {detail.row.lineup.map((p) => (
                  <div key={p.slot}>
                    <strong>
                      {p.name} · {gameDayPoints(p.centipoints)} PTS
                    </strong>
                    <p>
                      Base: {gameDayPoints(p.baseCentipoints)} · Multiplier:{" "}
                      {p.multiplier == null
                        ? "—"
                        : p.multiplier.toFixed(1) + "×"}
                    </p>
                    {p.parts.map((part, i) => (
                      <p key={i}>
                        {part.statistic === "assumed-zero"
                          ? "No stats recorded (provisional)"
                          : part.statistic}
                        : {part.quantity} · {gameDayPoints(part.centipoints)}
                      </p>
                    ))}
                  </div>
                ))}
              </details>
            </div>
          )}
        </FantasySheet>
      )}
      {weeks && (
        <FantasySheet
          historyEntry
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
