"use client";
import {
  competitionContextBadge,
  competitionRoundOption,
  competitionRoundLabel,
  competitionRoundStatus,
  competitionRoundWord,
  seasonLabel,
  type RoundDisplay,
} from "@/core/competition-display";
/** Native selection is compact, keyboard accessible and uses the device's picker. */
export function CompetitionWeekSelector({
  rounds,
  selected,
  onSelect,
  sport = "nfl",
  now = Date.now(),
  disabled = false,
}: {
  rounds: (RoundDisplay & { id: string })[];
  selected: string;
  onSelect: (id: string) => void;
  sport?: string;
  now?: number;
  disabled?: boolean;
}) {
  const index = rounds.findIndex((c) => c.id === selected);
  const word = competitionRoundWord(sport);
  const current = rounds[index];
  return (
    <nav
      className="competition-weeks"
      aria-label={`Competition ${word.toLowerCase()}s`}
    >
      <button
        type="button"
        className="play-support"
        aria-label={`Previous ${word.toLowerCase()}`}
        disabled={disabled || index <= 0}
        onClick={() => onSelect(rounds[index - 1].id)}
      >
        ‹
      </button>
      <label className="competition-round-label">
        <span className="competition-round-value" aria-hidden="true">
          <strong>
            {current
              ? competitionRoundLabel({ ...current, sport })
              : "No published rounds"}
          </strong>
          {current && (
            <small>
              {competitionRoundStatus(current, now)}
              {competitionContextBadge(current)
                ? ` · ${competitionContextBadge(current)}`
                : ""}
            </small>
          )}
        </span>
        <select
          aria-label={word}
          value={selected}
          disabled={disabled || !rounds.length}
          onChange={(e) => onSelect(e.target.value)}
        >
          {!rounds.length && <option value="">No published rounds</option>}
          {rounds.map((c) => {
            const duplicate = rounds.some(
              (other) =>
                other.id !== c.id &&
                other.round === c.round &&
                competitionContextBadge(other) === competitionContextBadge(c),
            );
            return (
              <option key={c.id} value={c.id}>
                {competitionRoundOption({ ...c, sport }, now)}
                {duplicate ? ` · ${seasonLabel(c.season)}` : ""}
              </option>
            );
          })}
        </select>
      </label>
      <button
        type="button"
        className="play-support"
        aria-label={`Next ${word.toLowerCase()}`}
        disabled={disabled || index < 0 || index >= rounds.length - 1}
        onClick={() => onSelect(rounds[index + 1].id)}
      >
        ›
      </button>
    </nav>
  );
}
