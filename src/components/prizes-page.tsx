"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSport } from "./sport-context";
import { CompetitionSwitch } from "./competition-switch";
import { competitionName } from "@/core/competition-display";
import {
  competitionHref,
  prizeSelection,
  type PrizeSchedule,
  type PrizeCompetition,
} from "@/core/prize-schedules";
export function PrizeTrophy() {
  return (
    <svg viewBox="0 0 80 80" aria-hidden="true">
      <path
        d="M23 12h34v22c0 15-8 22-17 22S23 49 23 34Zm0 5H10v10c0 12 9 18 18 18M57 17h13v10c0 12-9 18-18 18M40 56v13M25 70h30"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path
        d="M28 17h24v16c0 11-6 17-12 17s-12-6-12-17Z"
        fill="currentColor"
        opacity=".4"
      />
    </svg>
  );
}
export function PrizesPage({
  competitions,
  schedules,
}: {
  competitions: PrizeCompetition[];
  schedules: PrizeSchedule[];
}) {
  const { sport } = useSport();
  const params = useSearchParams();
  const router = useRouter();
  const query = Object.fromEntries(params.entries());
  const selected = prizeSelection(competitions, query, sport);
  const { mode, season, seasons, weeks, round, period } = selected;
  const context = {
    ...query,
    sport,
    mode,
    season,
    period,
    week: String(round?.week ?? ""),
    competition: round?.id,
  };
  const schedule = schedules.find(
    (s) =>
      s.sport === sport &&
      s.mode === mode &&
      s.season === season &&
      s.scope === period &&
      s.week === (period === "weekly" ? round?.week : 0),
  );
  const change = (patch: Record<string, string>) =>
    router.push(competitionHref("/fantasy/prizes", { ...context, ...patch }), {
      scroll: false,
    });
  const items = schedule?.items.slice().sort((a, b) => a.from - b.from) ?? [];
  return (
    <section className="prizes-page">
      <header className="prizes-heading">
        <div>
          <h1>Prizes</h1>
          <p>See what&apos;s up for grabs.</p>
        </div>
        <Link
          className="play-support"
          href={competitionHref("/fantasy/results", context)}
        >
          View Rankings ↗
        </Link>
      </header>
      <span className="competition-label">Competition</span>
      <CompetitionSwitch
        mode={mode}
        onChange={(mode) => change({ mode, competition: "", week: "" })}
      />
      <div className="standings-controls">
        <nav className="standings-segments" aria-label="Prize period">
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
            aria-label="Season"
            value={season}
            onChange={(e) =>
              change({ season: e.target.value, competition: "", week: "" })
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
              aria-label="Week"
              value={round?.id ?? ""}
              onChange={(e) => {
                const c = weeks.find((c) => c.id === e.target.value)!;
                change({ competition: c.id, week: String(c.week) });
              }}
            >
              {weeks.length ? (
                weeks.map((c) => (
                  <option key={c.id} value={c.id}>
                    Week {c.week}
                  </option>
                ))
              ) : (
                <option value="">No weeks</option>
              )}
            </select>
          </label>
        )}
      </div>
      <h2 className="prizes-period">
        {competitionName(mode)} ·{" "}
        {period === "weekly"
          ? `Weekly${round ? ` · Week ${round.week}` : ""}`
          : "Season"}{" "}
        prizes{season ? ` · ${season}` : ""}
      </h2>
      {items.length ? (
        <>
          <div className="prize-podium">
            {[1, 2, 3].map((position) => {
              const item = items.find(
                (i) => i.from <= position && i.to >= position,
              );
              return item ? (
                <article
                  key={position}
                  className={`prize-medal prize-medal-${position}`}
                >
                  <PrizeTrophy />
                  <div>
                    <h3>
                      {position === 1 ? "1st" : position === 2 ? "2nd" : "3rd"}{" "}
                      place
                    </h3>
                    <strong>{item.description}</strong>
                  </div>
                </article>
              ) : null;
            })}
          </div>
          <section className="prize-breakdown">
            <h2>Prize breakdown</h2>
            <table>
              <thead>
                <tr>
                  <th>Finish</th>
                  <th>Reward</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.from}>
                    <td>{i.from === i.to ? i.from : `${i.from}–${i.to}`}</td>
                    <td>{i.description}</td>
                    <td>
                      {i.amount.toLocaleString("en-AU")} {i.type}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      ) : (
        <section className="prize-empty">
          <PrizeTrophy />
          <h2>Prizes to be announced</h2>
        </section>
      )}
      <footer className="prizes-actions">
        <Link
          className="play-support"
          href={competitionHref("/fantasy/play", context)}
        >
          ← Back to Play
        </Link>
        <Link
          className="play-support"
          href={competitionHref("/fantasy/results", context)}
        >
          View Rankings ↗
        </Link>
      </footer>
    </section>
  );
}
