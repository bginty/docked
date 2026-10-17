import type { PlayerHistory, PlayerGameHistory } from "./player-card-history";

export type StatColumn = { key: string; label: string; title: string };
export type StatCategory = { id: string; label: string; columns: StatColumn[] };
const col = (key: string, label: string, title: string): StatColumn => ({
  key,
  label,
  title,
});
const passing: StatCategory = {
  id: "passing",
  label: "Passing",
  columns: [
    col("passing_attempts", "ATT", "Pass attempts"),
    col("passing_completions", "CMP", "Completions"),
    col("passing_yards", "YDS", "Passing yards"),
    col("passing_touchdowns", "TD", "Passing touchdowns"),
    col("interceptions_thrown", "INT", "Interceptions thrown"),
  ],
};
const rushing: StatCategory = {
  id: "rushing",
  label: "Rushing",
  columns: [
    col("rushing_attempts", "ATT", "Rush attempts"),
    col("rushing_yards", "YDS", "Rushing yards"),
    col("rushing_touchdowns", "TD", "Rushing touchdowns"),
  ],
};
const receiving: StatCategory = {
  id: "receiving",
  label: "Receiving",
  columns: [
    col("receptions", "REC", "Receptions"),
    col("receiving_targets", "TAR", "Receiving targets"),
    col("receiving_yards", "YDS", "Receiving yards"),
    col("receiving_touchdowns", "TD", "Receiving touchdowns"),
  ],
};
const misc: StatCategory = {
  id: "misc",
  label: "Misc",
  columns: [
    col("fumbles_lost", "FL", "Fumbles lost"),
    col("passing_two_point_conversions", "P2", "Passing two-point conversions"),
    col("rushing_two_point_conversions", "R2", "Rushing two-point conversions"),
    col(
      "receiving_two_point_conversions",
      "C2",
      "Receiving two-point conversions",
    ),
  ],
};

/** Only field names already supported by Docked's source/scoring schemas. */
export function statCategories(
  sport: string,
  position: string,
): StatCategory[] {
  if (sport.toLowerCase() === "nfl") {
    if (position === "QB") return [passing, rushing, misc];
    if (position === "RB") return [rushing, receiving, misc];
    if (["WR", "TE"].includes(position)) return [receiving, rushing, misc];
    return [misc];
  }
  if (["epl", "football"].includes(sport.toLowerCase()))
    return [
      {
        id: "attacking",
        label: "Attacking",
        columns: [
          col("goals", "G", "Goals"),
          col("assists", "AST", "Assists"),
          col("penaltiesMissed", "PM", "Penalties missed"),
        ],
      },
      {
        id: "defending",
        label: "Defending",
        columns:
          position === "GK"
            ? [
                col("saves", "SV", "Saves"),
                col("penaltySaves", "PS", "Penalty saves"),
                col("concededOnPitch", "GC", "Goals conceded while on pitch"),
              ]
            : [
                col("concededOnPitch", "GC", "Goals conceded while on pitch"),
                col("ownGoals", "OG", "Own goals"),
              ],
      },
      {
        id: "other",
        label: "Other",
        columns: [
          col("playedSeconds", "SEC", "Seconds played"),
          col("yellowCards", "YC", "Yellow cards"),
          col("ownGoals", "OG", "Own goals"),
        ],
      },
    ]; // Pass counts are not supplied by the approved EPL schema: do not invent them.
  if (sport.toLowerCase() === "afl")
    return [
      {
        id: "disposals",
        label: "Disposals",
        columns: [
          col("kicks", "K", "Kicks"),
          col("handballs", "HB", "Handballs"),
          col("marks", "M", "Marks"),
        ],
      },
      {
        id: "scoring",
        label: "Scoring",
        columns: [
          col("goals", "G", "Goals"),
          col("behinds", "B", "Behinds"),
          col("hitouts", "HO", "Hitouts"),
        ],
      },
      {
        id: "defending",
        label: "Defending",
        columns: [
          col("tackles", "T", "Tackles"),
          col("freesFor", "FF", "Free kicks for"),
          col("freesAgainst", "FA", "Free kicks against"),
        ],
      },
    ];
  return [];
}
export function compactColumns(category: StatCategory) {
  // Three readable metrics alongside WK/OPP/FPTS; expanded view has all fields.
  const omit =
    category.id === "passing"
      ? ["passing_attempts", "passing_completions"]
      : ["receiving_targets"];
  return category.columns.filter((c) => !omit.includes(c.key)).slice(0, 3);
}
export function historyGameRows(history: PlayerHistory): PlayerGameHistory[] {
  if (history.games?.length)
    return [...history.games].sort(
      (a, b) =>
        b.week - a.week || (b.kickoff ?? "").localeCompare(a.kickoff ?? ""),
    );
  return history.rows.map((r) => ({
    id: `week-${r.week}`,
    week: r.week,
    base: r.base,
    opponent: null,
    venue: null,
    kickoff: null,
    gameStatus: r.status,
    scoringStatus: r.status,
    incomplete: false,
    missing: [],
    revision: 0,
    updatedAt: r.updatedAt ?? "",
    played: false,
    values: {},
    parts: [],
  }));
}
export function historyTotal(history: PlayerHistory) {
  // Totals are projected server-side, never a second frontend scoring engine.
  return history.feed?.seasonBase ?? history.seasonBase ?? null;
}
export function gameScoreStatus(game: PlayerGameHistory) {
  if (game.scoringStatus.includes("review")) return "Under review";
  if (game.scoringStatus.includes("DNP")) return "DNP";
  if (game.scoringStatus === "Bye") return "Bye";
  if (game.base === null)
    return game.scoringStatus === "Missing data" ||
      game.scoringStatus === "Scoring unavailable"
      ? "Unavailable"
      : "Pending";
  if (game.scoringStatus === "Final") return "Final";
  if (game.scoringStatus.startsWith("Calculated")) return "Calculated";
  return "Provisional";
}
