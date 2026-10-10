import { z } from "zod";
import { nflStats } from "./scoring-v1";
import type { AuthorisedScoringSnapshot } from "./authorised-scoring-feed";

export const nflverseFields = {
  passing_yards: "passing_yards",
  passing_touchdowns: "passing_tds",
  interceptions_thrown: "passing_interceptions",
  rushing_yards: "rushing_yards",
  rushing_touchdowns: "rushing_tds",
  receptions: "receptions",
  receiving_yards: "receiving_yards",
  receiving_touchdowns: "receiving_tds",
  fumbles_lost: "fumbles_lost_total",
  passing_two_point_conversions: "passing_2pt_conversions",
  rushing_two_point_conversions: "rushing_2pt_conversions",
  receiving_two_point_conversions: "receiving_2pt_conversions",
} as const;
export const nflverseRequiredColumns = [
  "player_id",
  "player_display_name",
  "position",
  "season",
  "season_type",
  "week",
  "game_id",
  "team",
  "opponent_team",
  ...Object.values(nflverseFields),
  "special_teams_tds",
  "fumble_recovery_tds",
];

/** Strict bounded CSV. Blanks remain blanks; no numeric coercion to zero.
 * Handles RFC4180 quoted commas/newlines and rejects malformed quoting. */
export function parseStatisticsCsv(text: string): Record<string, string>[] {
  if (text.length > 12_000_000 || text.includes("\0"))
    throw Error("CSV exceeds limit or contains NUL");
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    closed = false;
  const field = () => {
    row.push(cell);
    cell = "";
    closed = false;
    if (row.length > 200) throw Error("Too many CSV columns");
  };
  const line = () => {
    field();
    rows.push(row);
    row = [];
    if (rows.length > 30001) throw Error("Too many CSV rows");
  };
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
        closed = true;
      } else cell += c;
    } else if (c === ",") field();
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      line();
    } else if (c === '"' && cell === "" && !closed) quoted = true;
    else {
      if (closed || c === '"') throw Error("Malformed CSV quote");
      cell += c;
    }
  }
  if (quoted) throw Error("Unterminated CSV quote");
  if (cell || row.length || closed) line();
  const headers = rows.shift();
  if (
    !headers?.length ||
    headers.some((h) => !/^[A-Za-z][A-Za-z0-9_]*$/.test(h)) ||
    new Set(headers).size !== headers.length
  )
    throw Error("Invalid/duplicate CSV header");
  return rows.map((r) => {
    if (r.length !== headers.length) throw Error("CSV row width changed");
    return Object.fromEntries(headers.map((h, i) => [h, r[i]]));
  });
}

function integer(row: Record<string, string>, key: string, signed = false) {
  const value = row[key];
  if (!(signed ? /^-?\d+$/ : /^\d+$/).test(value ?? ""))
    throw Error(`Missing/invalid ${key}`);
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw Error(`Invalid ${key}`);
  return number;
}

/** Optional companion evidence. Accept only unambiguous ordinary kick/punt
 * return TDs, reconcile count against the aggregate, and reject complex
 * fumble/lateral attribution rather than extrapolating from prose. */
export function nflverseReturnTouchdowns(
  row: Record<string, string>,
  plays: Record<string, string>[],
) {
  if (
    !plays.length ||
    plays.length > 1000 ||
    new Set(plays.map((p) => p.play_id)).size !== plays.length ||
    plays.some(
      (p) => p.game_id !== row.game_id || !/^\d+(\.0)?$/.test(p.play_id),
    )
  )
    throw Error("Invalid companion game evidence");
  let kickoff = 0,
    punt = 0;
  for (const p of plays.filter(
    (p) => p.td_player_id === row.player_id && p.touchdown === "1",
  )) {
    if (p.return_touchdown !== "1") continue;
    if (p.fumble !== "0" || p.td_team !== row.team)
      throw Error("Complex return evidence requires review");
    if (
      p.play_type === "kickoff" &&
      p.kickoff_attempt === "1" &&
      p.punt_attempt === "0" &&
      p.kickoff_returner_player_id === row.player_id
    )
      kickoff++;
    else if (
      p.play_type === "punt" &&
      p.punt_attempt === "1" &&
      p.kickoff_attempt === "0" &&
      p.punt_returner_player_id === row.player_id
    )
      punt++;
    else throw Error("Return attribution requires review");
  }
  if (kickoff + punt !== integer(row, "special_teams_tds"))
    throw Error("Companion and weekly TD totals disagree");
  return { kickoff_return_touchdowns: kickoff, punt_return_touchdowns: punt };
}

export function nflversePlayerStatistics(
  row: Record<string, string>,
  plays?: Record<string, string>[],
) {
  try {
    // The published calculation includes all TDs in each aggregate. An explicit
    // zero proves every subset is zero. A nonzero aggregate cannot identify which
    // return/recovery happened: NEVER allocate it arbitrarily or ignore it.
    if (
      integer(row, "fumble_recovery_tds") !== 0 ||
      (integer(row, "special_teams_tds") !== 0 && !plays)
    )
      throw Error(
        "Touchdown category evidence required (return type/offensive recovery)",
      );
    const stats = nflStats.parse({
      ...Object.fromEntries(
        Object.entries(nflverseFields).map(([dest, source]) => [
          dest,
          integer(row, source, dest.endsWith("_yards")),
        ]),
      ),
      ...(plays
        ? nflverseReturnTouchdowns(row, plays)
        : { kickoff_return_touchdowns: 0, punt_return_touchdowns: 0 }),
      offensiveFumbleRecoveryTouchdowns: 0,
    });
    return { stats, issue: null };
  } catch (error) {
    return {
      stats: null,
      issue: error instanceof Error ? error.message : "Invalid statistics",
    };
  }
}

const mappingSchema = z
  .object({
    fixtureId: z.string().regex(/^[A-Za-z0-9:._-]{1,120}$/),
    gameId: z.string().regex(/^\d{4}_\d{2}_[A-Z0-9]+_[A-Z0-9]+$/),
    season: z.number().int().min(1999).max(2100),
    seasonType: z.enum(["REG", "POST"]),
    home: z.string().regex(/^[A-Z0-9]+$/),
    away: z.string().regex(/^[A-Z0-9]+$/),
    players: z
      .array(
        z
          .object({
            playerId: z.string().regex(/^[A-Za-z0-9:._-]{1,120}$/),
            gsisId: z.string().regex(/^\d{2}-\d{7}$/),
            team: z.string(),
            position: z.enum(["QB", "RB", "WR", "TE"]),
          })
          .strict(),
      )
      .min(1)
      .max(200),
    // Weekly CSV has no exact completion instant. Do not infer it from kickoff,
    // a populated row, or elapsed wall time. Supply separately verified evidence.
    endedAt: z.iso.datetime(),
    completionEvidence: z.url(),
  })
  .strict();
export type PostgameMapping = z.infer<typeof mappingSchema>;

export function nflversePostgame(
  csv: string,
  input: PostgameMapping,
  revision: number,
  observedAt: string,
) {
  const mapping = mappingSchema.parse(input);
  z.iso.datetime().parse(observedAt);
  z.number().int().positive().parse(revision);
  if (Date.parse(mapping.endedAt) > Date.parse(observedAt))
    throw Error("Match not completed");
  if (
    mapping.home === mapping.away ||
    mapping.gameId !==
      `${mapping.season}_${mapping.gameId.split("_")[1]}_${mapping.away}_${mapping.home}`
  )
    throw Error("Fixture identity mismatch");
  if (
    new Set(mapping.players.map((p) => p.playerId)).size !==
      mapping.players.length ||
    new Set(mapping.players.map((p) => p.gsisId)).size !==
      mapping.players.length ||
    mapping.players.some((p) => ![mapping.home, mapping.away].includes(p.team))
  )
    throw Error("Invalid player mapping");
  const rows = parseStatisticsCsv(csv);
  if (!rows.length || nflverseRequiredColumns.some((k) => !(k in rows[0])))
    throw Error("nflverse schema changed");
  const selected = rows.filter((r) => r.game_id === mapping.gameId);
  const index = new Map<string, Record<string, string>>();
  for (const r of selected) {
    if (
      !/^\d{2}-\d{7}$/.test(r.player_id) ||
      index.has(r.player_id) ||
      integer(r, "season") !== mapping.season ||
      r.season_type !== mapping.seasonType ||
      integer(r, "week") !== Number(mapping.gameId.split("_")[1]) ||
      ![mapping.home, mapping.away].includes(r.team) ||
      r.opponent_team !==
        (r.team === mapping.home ? mapping.away : mapping.home)
    )
      throw Error("Duplicate/mismatched player or fixture row");
    index.set(r.player_id, r);
  }
  const issues: string[] = [];
  const players = mapping.players.map((p) => {
    const row = index.get(p.gsisId);
    const result =
      row && row.team === p.team && row.position === p.position
        ? nflversePlayerStatistics(row)
        : {
            stats: null,
            issue: "Missing or unmapped player; not confirmed DNP",
          };
    if (result.issue) issues.push(`${p.playerId}: ${result.issue}`);
    return {
      playerId: p.playerId,
      availability: result.stats ? ("complete" as const) : ("pending" as const),
      stats: result.stats,
    };
  });
  const snapshot: AuthorisedScoringSnapshot = {
    provider: "nflverse",
    simulated: false,
    competition: "NFL",
    sport: "nfl",
    fixtureId: mapping.fixtureId,
    revision,
    observedAt,
    status: "completed",
    endedAt: mapping.endedAt,
    players,
  };
  return { snapshot, issues };
}
