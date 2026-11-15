"use client";
import {
  nflSeasonCalendar,
  nflCurrentWeek,
} from "@/core/nfl-season-navigation";
import { LocalDateTime } from "./local-date-time";

export function NflSeasonNavigation({
  week,
  onSelect,
  now,
  disabled = false,
  archive,
  onArchive,
  hasArchive,
  competitionAvailable,
}: {
  week: number;
  onSelect: (week: number) => void;
  now: number;
  disabled?: boolean;
  archive: boolean;
  onArchive: (archive: boolean) => void;
  hasArchive: boolean;
  competitionAvailable: boolean;
}) {
  const calendar = nflSeasonCalendar;
  const round = calendar.rounds.find((r) => r.week === week)!;
  return (
    <section aria-label="NFL season schedule" className="fantasy-panel">
      <div className="play-round-links">
        <button
          type="button"
          className="play-support"
          disabled={disabled}
          aria-pressed={!archive}
          onClick={() => onArchive(false)}
        >
          2026 season
        </button>
        {hasArchive && (
          <button
            type="button"
            className="play-support"
            disabled={disabled}
            aria-pressed={archive}
            onClick={() => onArchive(true)}
          >
            Practice archive
          </button>
        )}
      </div>
      {!archive && (
        <>
          <nav className="competition-weeks" aria-label="NFL season weeks">
            <button
              type="button"
              className="play-support"
              aria-label="Previous NFL week"
              disabled={disabled || week === 1}
              onClick={() => onSelect(week - 1)}
            >
              ‹
            </button>
            <label className="competition-round-label">
              <span className="competition-round-value" aria-hidden="true">
                <strong>Week {week}</strong>
                <small>
                  {week === nflCurrentWeek(now)
                    ? "Current NFL week"
                    : "2026 regular season"}
                </small>
              </span>
              <select
                aria-label="NFL season week"
                value={week}
                disabled={disabled}
                onChange={(e) => onSelect(Number(e.target.value))}
              >
                {calendar.rounds.map((r) => (
                  <option key={r.week} value={r.week}>
                    Week {r.week}
                    {r.week === nflCurrentWeek(now)
                      ? " · Current NFL week"
                      : ""}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="play-support"
              aria-label="Next NFL week"
              disabled={disabled || week === 18}
              onClick={() => onSelect(week + 1)}
            >
              ›
            </button>
          </nav>
          {!competitionAvailable && (
            <p role="status">
              Entries and scoring are unavailable for this week. The season
              schedule does not create a competition entry.
            </p>
          )}
          <details>
            <summary>Fixtures and byes · Week {week}</summary>
            <p>
              Schedule snapshot: 8 November 2026. Kickoff changes have not been
              reverified. Times use your device timezone; TBD fixtures have no
              confirmed kickoff.
            </p>
            <ul>
              {round.games.map((g) => (
                <li key={g.id}>
                  {g.away} at {g.home} ·{" "}
                  {g.kickoff ? (
                    <LocalDateTime value={g.kickoff} />
                  ) : (
                    "Date/time TBD"
                  )}
                </li>
              ))}
            </ul>
            <p>Byes: {round.byes.length ? round.byes.join(", ") : "None"}.</p>
            <p>
              Postseason is separate from these 18 regular-season weeks. No
              postseason entries are enabled.
            </p>
            <p>
              <a
                href={`https://www.nfl.com/schedules/2026/by-week/week-${week}`}
                target="_blank"
                rel="noreferrer"
              >
                Check the official NFL schedule
              </a>
              . Retained schedule source:{" "}
              <a
                href="https://github.com/nflverse/nfldata"
                target="_blank"
                rel="noreferrer"
              >
                nflverse
              </a>
              .
            </p>
          </details>
        </>
      )}
    </section>
  );
}
