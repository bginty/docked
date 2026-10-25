"use client";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useSport } from "./sport-context";
import { CompetitionSwitch } from "./competition-switch";
import { competitionName, seasonLabel } from "@/core/competition-display";
import { NavigationShortcut } from "./navigation-shortcut";
import { approvedAustralianPrizes } from "@/core/approved-australian-rules";
import { paidPackOffers } from "@/core/paid-pack-catalogue";
import { PackArtwork } from "./pack-artwork";
import {
  competitionHref,
  prizeSelection,
  prizeRewardLabel,
  finishingPosition,
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
  const roundWord = sport === "afl" || sport === "nrl" ? "Round" : "Week";
  const params = useSearchParams();
  const [query, setQuery] = useState<Record<string, string>>(() =>
    Object.fromEntries(params.entries()),
  );
  useEffect(() => {
    const read = () =>
      setQuery(Object.fromEntries(new URLSearchParams(location.search)));
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);
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
  const change = (patch: Record<string, string>) => {
    // All authorised schedules are already loaded. Selection is local, like Rankings;
    // a button press must not wait for an unrelated full server-state request.
    const url = competitionHref("/fantasy/prizes", { ...context, ...patch });
    window.history.pushState(null, "", url);
    setQuery(Object.fromEntries(new URL(url, location.origin).searchParams));
  };
  const items = schedule?.items.slice().sort((a, b) => a.from - b.from) ?? [];
  const upcoming =
    !items.length && period === "weekly" && (sport === "afl" || sport === "nrl")
      ? approvedAustralianPrizes(sport, mode === "OPEN" ? "OPEN" : "SALARY_CAP")
      : null;
  const displayedItems = upcoming?.items ?? items;
  return (
    <section className="prizes-page">
      <header className="prizes-heading">
        <div>
          <h1>Prizes</h1>
          <p>See what&apos;s up for grabs.</p>
        </div>
        <nav className="competition-page-actions" aria-label="Prize links">
          <NavigationShortcut
            compact
            href={competitionHref("/fantasy/play", context)}
          >
            Back to Lineup
          </NavigationShortcut>
          <NavigationShortcut
            compact
            icon="edge"
            href={competitionHref("/fantasy/results", context)}
          >
            View Rankings
          </NavigationShortcut>
        </nav>
      </header>
      <span className="competition-label">Competition</span>
      <CompetitionSwitch
        mode={mode}
        salaryLabel={
          round?.salaryLabel ?? (sport !== "nfl" ? "Test cap" : undefined)
        }
        onChange={(mode) => change({ mode, competition: "" })}
      />
      <div className="standings-controls">
        <nav className="standings-segments" aria-label="Prize period">
          {["weekly", "season"].map((p) => (
            <button
              type="button"
              key={p}
              aria-pressed={period === p}
              onClick={() => change({ period: p })}
            >
              {p === "weekly"
                ? roundWord === "Week"
                  ? "Weekly"
                  : "Round"
                : "Season"}
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
              seasons.map((s) => (
                <option key={s} value={s}>
                  {seasonLabel(s)}
                </option>
              ))
            ) : (
              <option value="">No seasons</option>
            )}
          </select>
        </label>
        {period === "weekly" && (
          <label>
            {roundWord}
            <select
              aria-label={roundWord}
              value={round?.id ?? ""}
              onChange={(e) => {
                const c = weeks.find((c) => c.id === e.target.value)!;
                change({ competition: c.id, week: String(c.week) });
              }}
            >
              {weeks.length ? (
                weeks.map((c) => (
                  <option key={c.id} value={c.id}>
                    {roundWord} {c.week}
                  </option>
                ))
              ) : (
                <option value="">No configured rounds</option>
              )}
            </select>
          </label>
        )}
      </div>
      <h2 className="prizes-period">
        {competitionName(mode)} ·{" "}
        {period === "weekly"
          ? round
            ? `${roundWord} ${round.week}`
            : roundWord === "Week"
              ? "Weekly"
              : "Round"
          : "Season"}{" "}
        prizes{season ? ` · ${seasonLabel(season)}` : ""}
      </h2>
      {upcoming && (
        <section
          className="upcoming-prize-notice"
          aria-label="Upcoming prize schedule"
        >
          <h2>Upcoming weekly prizes</h2>
          <p>
            Approved {sport.toUpperCase()} {competitionName(mode)} schedule ·
            Test Docked Credits have no cash value.
          </p>
          <p>
            Preview only. Prize-bearing rounds and a tied-place policy must be
            approved before awards begin.
          </p>
          {round && (
            <p>
              {seasonLabel(season)} · {roundWord} {round.week}: No prizes in
              this test competition. The upcoming schedule does not apply
              retrospectively.
            </p>
          )}
        </section>
      )}
      {displayedItems.length ? (
        <>
          <div className="prize-podium">
            {[1, 2, 3].map((position) => {
              const rewards = displayedItems.filter(
                (i) => i.from <= position && i.to >= position,
              );
              return rewards.length ? (
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
                    {rewards.map((item) => {
                      const product = paidPackOffers.find(
                        (p) => p.id === item.productVersion,
                      );
                      const upcomingPack =
                        item.type === "pack" &&
                        upcoming?.items.some(
                          (p) => p.productVersion === item.productVersion,
                        );
                      return (
                        <div className="prize-reward-item" key={item.type}>
                          {item.type === "pack" &&
                            (product || upcomingPack) && (
                              <PackArtwork
                                compact
                                name={item.description}
                                sport={sport}
                                count={product?.cards ?? 9}
                                premium={
                                  product
                                    ? product.type === "PREMIUM"
                                    : mode === "OPEN"
                                }
                              />
                            )}
                          <strong>{prizeRewardLabel(item)}</strong>
                        </div>
                      );
                    })}
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
                </tr>
              </thead>
              <tbody>
                {displayedItems.map((i) => (
                  <tr key={`${i.from}:${i.type}`}>
                    <td>
                      {i.from === i.to
                        ? finishingPosition(i.from)
                        : `${finishingPosition(i.from)}–${finishingPosition(i.to)}`}
                    </td>
                    <td>{prizeRewardLabel(i)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      ) : (
        <section className="prize-empty">
          <PrizeTrophy />
          <h2>
            {sport !== "nfl" && period === "weekly"
              ? "No prizes in this test competition"
              : "Prizes to be announced"}
          </h2>
        </section>
      )}
      <footer className="prizes-actions">
        <NavigationShortcut
          compact
          href={competitionHref("/fantasy/play", context)}
        >
          Back to Play
        </NavigationShortcut>
        <NavigationShortcut
          compact
          icon="edge"
          href={competitionHref("/fantasy/results", context)}
        >
          View Rankings
        </NavigationShortcut>
      </footer>
    </section>
  );
}
