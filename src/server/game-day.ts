import type { StandingRound } from "../core/standings";

/** Presentation of persisted authoritative totals; never rewrites a journal,
 * final rank, scoring rule, or missing player's score. */
export function gameDayStandings(rounds: StandingRound[]): StandingRound[] {
  return rounds.map((round) => {
    const rows = round.rows
      .map((row) => ({
        ...row,
        currentCentipoints: round.visible
          ? (row.centipoints ?? row.knownCentipoints ?? null)
          : null,
        currentRank: null as number | null,
      }))
      .sort(
        (a, b) =>
          (b.currentCentipoints ?? -Infinity) -
            (a.currentCentipoints ?? -Infinity) || a.key.localeCompare(b.key),
      );
    rows.forEach((row, i) => {
      if (row.currentCentipoints !== null)
        row.currentRank = round.finalised
          ? row.rank
          : i && row.currentCentipoints === rows[i - 1].currentCentipoints
            ? rows[i - 1].currentRank
            : i + 1;
    });
    return { ...round, rows };
  });
}
