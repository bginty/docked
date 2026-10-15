import {
  parseStatisticsCsv,
  nflverseRequiredColumns,
} from "./postgame-nflverse";

export const pbpColumns = [
  "play_id",
  "game_id",
  "home_team",
  "away_team",
  "season",
  "season_type",
  "week",
  "play_type_nfl",
  "play_deleted",
  "qtr",
  "game_seconds_remaining",
  "home_score",
  "away_score",
  "touchdown",
  "td_player_id",
  "td_team",
  "return_touchdown",
  "fumble",
  "play_type",
  "kickoff_attempt",
  "punt_attempt",
  "kickoff_returner_player_id",
  "punt_returner_player_id",
  "posteam",
  "defteam",
  "special_teams_play",
  "pass_touchdown",
  "rush_touchdown",
  "fumble_recovery_1_team",
  "fumble_recovery_1_player_id",
  "fumble_recovery_2_player_id",
  "fumbled_1_team",
  "lateral_recovery",
] as const;
export const rosterColumns = [
  "season",
  "team",
  "position",
  "status",
  "full_name",
  "gsis_id",
  "week",
  "game_type",
] as const;
export type NflDataset = "weekly" | "pbp" | "rosters";
export const nflRosterProjectionVersion = 2;
/** A 304 must not perpetuate an older projection which discarded number data. */
export function rosterProjectionCurrent(
  body: { projectionVersion?: unknown } | null | undefined,
) {
  return body?.projectionVersion === nflRosterProjectionVersion;
}
export const nflSourceUrl = (dataset: NflDataset, season: number) => {
  if (!Number.isInteger(season) || season < 1999 || season > 2100)
    throw Error("Invalid NFL season");
  const files = {
    weekly: `stats_player/stats_player_week_${season}.csv`,
    pbp: `pbp/play_by_play_${season}.csv.gz`,
    rosters: `rosters/roster_${season}.csv`,
  };
  return `https://github.com/nflverse/nflverse-data/releases/download/${files[dataset]}`;
};
export function parseNflDataset(
  csv: string,
  dataset: NflDataset,
  season: number,
) {
  const rows = parseStatisticsCsv(csv, {
    // Presentation metadata only. Older retained files may legitimately omit it.
    optionalColumns: dataset === "rosters" ? ["jersey_number"] : [],
    columns:
      dataset === "pbp"
        ? pbpColumns
        : dataset === "weekly"
          ? nflverseRequiredColumns
          : rosterColumns,
    maxChars: dataset === "pbp" ? 128_000_000 : 12_000_000,
    maxColumns: 450,
    maxRows: 100000,
  });
  if (!rows.length || rows.some((r) => r.season !== String(season)))
    throw Error("NFL source season/schema changed");
  if (
    dataset === "pbp" &&
    new Set(rows.map((r) => `${r.game_id}:${r.play_id}`)).size !== rows.length
  )
    throw Error("Duplicate play identity");
  if (
    dataset === "weekly" &&
    new Set(rows.map((r) => `${r.game_id}:${r.player_id}`)).size !== rows.length
  )
    throw Error("Duplicate weekly identity");
  return rows;
}

/** Explicit source state marker. No elapsed-time, score-presence or prose inference. */
export function completedNflGame(plays: Record<string, string>[]) {
  if (
    !plays.length ||
    plays.some(
      (p) =>
        p.game_id !== plays[0].game_id ||
        p.home_team !== plays[0].home_team ||
        p.away_team !== plays[0].away_team,
    )
  )
    throw Error("Game identity mismatch");
  const active = plays.filter((p) => p.play_deleted === "0");
  if (
    plays.some((p) => !["0", "1"].includes(p.play_deleted)) ||
    active.some((p) => !/^\d+(\.0)?$/.test(p.play_id))
  )
    throw Error("Invalid play state");
  const last = [...active]
    .sort((a, b) => Number(a.play_id) - Number(b.play_id))
    .at(-1);
  if (!last || last.play_type_nfl !== "END_GAME") return null;
  if (
    !/^\d+$/.test(last.home_score) ||
    !/^\d+$/.test(last.away_score) ||
    Number(last.qtr) < 4
  )
    throw Error("Invalid completed-game marker");
  return {
    gameId: last.game_id,
    marker: "END_GAME" as const,
    playId: last.play_id,
    home: last.home_team,
    away: last.away_team,
    homeScore: Number(last.home_score),
    awayScore: Number(last.away_score),
    actualEndedAt: null,
  };
}

/** A roster snapshot proves listed membership, never game participation/DNP.
 * Missing/duplicate IDs are reported rather than replaced by name matching. */
export function inspectNflRosters(
  rows: Record<string, string>[],
  season: number,
) {
  const teams = new Set<string>(),
    ids = new Set<string>(),
    issues: string[] = [];
  const players = rows.flatMap((r) => {
    if (r.season !== String(season)) throw Error("Roster season mismatch");
    if (r.team) teams.add(r.team);
    if (!["QB", "RB", "WR", "TE"].includes(r.position)) return [];
    if (
      !/^\d{2}-\d{7}$/.test(r.gsis_id) ||
      !r.full_name ||
      !r.team ||
      !r.status
    ) {
      issues.push("Missing roster identity/team/status");
      return [];
    }
    if (ids.has(r.gsis_id)) {
      issues.push(`Conflicting roster identity ${r.gsis_id}`);
      return [];
    }
    ids.add(r.gsis_id);
    return [
      {
        providerId: r.gsis_id,
        name: r.full_name,
        team: r.team,
        position: r.position,
        sourceStatus: r.status,
        week: r.week,
        gameType: r.game_type,
      },
    ];
  });
  const coverage = [...teams].sort().map((team) => ({
    team,
    positions: Object.fromEntries(
      ["QB", "RB", "WR", "TE"].map((p) => [
        p,
        players.filter((r) => r.team === team && r.position === p).length,
      ]),
    ),
  }));
  if (teams.size !== 32)
    issues.push("Expected 32 team coverage not established");
  if (coverage.some((t) => Object.values(t.positions).some((n) => !n)))
    issues.push("Missing supported position coverage");
  return {
    season,
    rows: rows.length,
    teamCount: teams.size,
    players,
    coverage,
    issues,
    status: issues.length ? "REVIEW_REQUIRED" : "SOURCE_COVERAGE_VERIFIED",
    participation: "NOT_ESTABLISHED",
  };
}
