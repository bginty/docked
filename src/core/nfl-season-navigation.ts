import calendar from "../../config/nfl-season-2026.json";
import { competitionContextBadge } from "./competition-display";
import type { FantasyCompetition } from "./fantasy";

/** Display-only retained schedule. Never creates competitions or entry authority. */
export const nflSeasonCalendar = calendar;
export function nflCurrentWeek(now: number, rounds = calendar.rounds) {
  const started = rounds.filter((r) => Date.parse(r.startsAt) <= now);
  return started.at(-1)?.week ?? rounds[0]?.week ?? 1;
}
export function nflSeasonSelection(input: {
  competitions: FantasyCompetition[];
  mode: string;
  chosen: string;
  week?: string | null;
  now: number;
}) {
  const modes = input.competitions.filter(
    (c) => c.rules.mode === input.mode && c.rules.lineup_version,
  );
  const practice = modes.filter((c) => competitionContextBadge(c) !== null);
  const rounds = modes
    .filter(
      (c) =>
        competitionContextBadge(c) === null &&
        c.season === String(calendar.season),
    )
    .sort((a, b) => a.round - b.round || a.id.localeCompare(b.id));
  const explicit = rounds.find((c) => c.id === input.chosen);
  const queryWeek = Number(input.week);
  const week =
    explicit?.round ??
    (Number.isInteger(queryWeek) && queryWeek >= 1 && queryWeek <= 18
      ? queryWeek
      : nflCurrentWeek(input.now));
  return {
    week,
    rounds,
    practice,
    competition: explicit ?? rounds.find((c) => c.round === week),
  };
}
