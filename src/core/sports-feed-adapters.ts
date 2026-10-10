import { z } from "zod";
import { DateTime } from "luxon";
import { nflStats } from "./scoring-v1";
import type { AuthorisedScoringSnapshot } from "./authorised-scoring-feed";

const id = z.number().int().positive();
const object = z.record(z.string(), z.unknown());
const nflFields = {
  passing_yards: "PassingYards",
  passing_touchdowns: "PassingTouchdowns",
  interceptions_thrown: "PassingInterceptions",
  rushing_yards: "RushingYards",
  rushing_touchdowns: "RushingTouchdowns",
  receptions: "Receptions",
  receiving_yards: "ReceivingYards",
  receiving_touchdowns: "ReceivingTouchdowns",
  fumbles_lost: "FumblesLost",
  passing_two_point_conversions: "TwoPointConversionPasses",
  rushing_two_point_conversions: "TwoPointConversionRuns",
  receiving_two_point_conversions: "TwoPointConversionReceptions",
  kickoff_return_touchdowns: "KickReturnTouchdowns",
  punt_return_touchdowns: "PuntReturnTouchdowns",
} as const;
export const nflRequiredProviderFields = Object.values(nflFields);
export type FeedMapping = {
  fixtureId: string;
  providerFixtureId: number;
  playerIds: string[];
  providerPlayers: Record<string, string>;
};
export type AdapterResult = {
  snapshot: AuthorisedScoringSnapshot;
  issues: string[];
};

/** SportsDataIO dates are US Eastern, not server-local time. Ambiguous DST
 * timestamps cannot be safely assigned an instant without explicit offset. */
export function sportsDataTime(value: unknown): string {
  const text = z.string().parse(value);
  const d = DateTime.fromISO(text, { zone: "America/New_York" });
  if (
    !d.isValid ||
    (!/(Z|[+-]\d\d:\d\d)$/.test(text) && d.getPossibleOffsets().length !== 1)
  )
    throw Error("Ambiguous provider timestamp");
  return d.toUTC().toISO()!;
}

export function sportsDataBoxscore(
  raw: unknown,
  mapping: FeedMapping,
  revision: number,
  observedAt: string,
): AdapterResult {
  const box = z
    .object({ Score: object, PlayerGames: z.array(object) })
    .parse(raw);
  if (id.parse(box.Score.ScoreID) !== mapping.providerFixtureId)
    throw Error("Wrong NFL fixture");
  const statusMap: Record<string, AuthorisedScoringSnapshot["status"]> = {
    Scheduled: "scheduled",
    InProgress: "live",
    Final: "completed",
    "F/OT": "completed",
    Postponed: "postponed",
    Canceled: "cancelled",
    Suspended: "abandoned",
  };
  const status = statusMap[String(box.Score.Status)];
  if (!status) throw Error("Unknown NFL game state");
  const seen = new Set<string>();
  for (const row of box.PlayerGames) {
    const key = String(id.parse(row.PlayerID));
    if (seen.has(key) || row.ScoreID !== mapping.providerFixtureId)
      throw Error("Duplicate or mismatched NFL row");
    seen.add(key);
  }
  const issues: string[] = [];
  const players = mapping.playerIds.map((playerId) => {
    const providerId = mapping.providerPlayers[playerId];
    const row = box.PlayerGames.find((r) => String(r.PlayerID) === providerId);
    const pending = { playerId, availability: "pending" as const, stats: null };
    if (!row) {
      issues.push(`${playerId}:missing-player-row`);
      return pending;
    }
    // Deprecated OffensiveFumbleRecoveryTouchdowns is NEVER assumed zero or trusted.
    // A separately accepted play-by-play adapter must supply this evidence in a new adapter version.
    const values = Object.fromEntries(
      Object.entries(nflFields).map(([k, field]) => [k, row[field]]),
    );
    const missing = Object.entries(nflFields)
      .filter(([, f]) => typeof row[f] !== "number")
      .map(([, f]) => f);
    if (missing.length) issues.push(`${playerId}:missing:${missing.join(",")}`);
    issues.push(
      `${playerId}:offensive-fumble-recovery-touchdown-evidence-required`,
    );
    // Validate all other supplied values without using provider fantasy totals.
    if (
      !missing.length &&
      !nflStats.safeParse({ ...values, offensiveFumbleRecoveryTouchdowns: 0 })
        .success
    )
      issues.push(`${playerId}:invalid-or-scrambled-statistics`);
    return pending;
  });
  const endedAt =
    status === "completed" && box.Score.GameEndDateTime
      ? sportsDataTime(box.Score.GameEndDateTime)
      : null;
  if (status === "completed" && !endedAt) issues.push("missing-game-end-time");
  return {
    snapshot: {
      provider: "sportsdataio",
      competition: "NFL",
      simulated: false,
      sport: "nfl",
      fixtureId: mapping.fixtureId,
      revision,
      observedAt,
      status: status === "completed" && !endedAt ? "live" : status,
      endedAt,
      players,
    },
    issues,
  };
}

export function sportmonksFixture(
  raw: unknown,
  mapping: FeedMapping,
  revision: number,
  observedAt: string,
): AdapterResult {
  const data = z
    .object({
      data: z.object({
        id,
        sport_id: id,
        league_id: id,
        state: z.object({ developer_name: z.string() }),
        lineups: z.array(z.object({ player_id: id, details: z.array(object) })),
        events: z.array(object),
      }),
    })
    .parse(raw).data;
  if (
    data.id !== mapping.providerFixtureId ||
    data.sport_id !== 1 ||
    data.league_id !== 8
  )
    throw Error("Only mapped English Premier League fixtures are supported");
  if (
    new Set(data.lineups.map((p) => p.player_id)).size !== data.lineups.length
  )
    throw Error("Duplicate EPL lineup row");
  const statusMap: Record<string, AuthorisedScoringSnapshot["status"]> = {
    NS: "scheduled",
    INPLAY_1ST_HALF: "live",
    HT: "live",
    INPLAY_2ND_HALF: "live",
    FT: "completed",
    POSTPONED: "postponed",
    CANCELLED: "cancelled",
    ABANDONED: "abandoned",
  };
  const status = statusMap[data.state.developer_name];
  if (!status) throw Error("Unknown or unsupported EPL state");
  // Documented minute/extra_minute and sort_order are not proof of elapsed seconds,
  // boundary ordering or Docked's deliberate-assist definition. Keep pending.
  const issues = [
    "EPL-regulation-seconds-and-on-pitch-boundaries-unverified",
    "Docked-assist-definition-unverified",
  ];
  const players = mapping.playerIds.map((playerId) => {
    if (
      !data.lineups.some(
        (p) => String(p.player_id) === mapping.providerPlayers[playerId],
      )
    )
      issues.push(`${playerId}:missing-player-row`);
    return { playerId, availability: "pending" as const, stats: null };
  });
  return {
    snapshot: {
      provider: "sportmonks",
      competition: "EPL",
      simulated: false,
      sport: "epl",
      fixtureId: mapping.fixtureId,
      revision,
      observedAt,
      status: status === "completed" ? "live" : status,
      endedAt: null,
      players,
    },
    issues: [
      ...issues,
      ...(status === "completed"
        ? ["provider-final;Docked-completion-evidence-pending"]
        : []),
    ],
  };
}

/** No headshots, logos, date of birth or other unnecessary personal fields copied. */
export function sportsDataCatalogue(raw: unknown, observedAt: string) {
  z.iso.datetime().parse(observedAt);
  const rows = z
    .array(
      z.object({
        PlayerID: id,
        Name: z.string().min(2),
        Team: z.string().nullable(),
        Position: z.string(),
        Status: z.string(),
      }),
    )
    .parse(raw);
  if (new Set(rows.map((p) => p.PlayerID)).size !== rows.length)
    throw Error("Duplicate catalogue ID");
  return rows
    .filter(
      (p) =>
        p.Team &&
        [
          "Active",
          "Injured Reserve",
          "Physically Unable to Perform",
          "Non Football Injury",
        ].includes(p.Status),
    )
    .map((p) => ({
      provider: "sportsdataio",
      providerId: String(p.PlayerID),
      name: p.Name,
      currentClubId: p.Team!,
      currentClub: p.Team!,
      position: p.Position,
      sport: "nfl" as const,
      competition: "NFL",
      observedAt,
      firstEligibleSeason: null,
      scoringSupported: ["QB", "RB", "WR", "TE"].includes(p.Position),
    }));
}

export function sportmonksSquad(
  raw: unknown,
  team: {
    id: number;
    leagueId: 8;
    verifiedAt: string;
    name: string;
    positionMap: Record<string, string>;
  },
  observedAt: string,
) {
  z.iso.datetime().parse(observedAt);
  if (
    team.leagueId !== 8 ||
    Date.parse(observedAt) - Date.parse(team.verifiedAt) > 86400000 ||
    !Number.isFinite(Date.parse(team.verifiedAt)) ||
    Date.parse(team.verifiedAt) > Date.parse(observedAt)
  )
    throw Error("Current EPL team membership required");
  const rows = z
    .object({
      data: z.array(
        z.object({
          player_id: id,
          team_id: id,
          position_id: id,
          start: z.iso.date().nullable(),
          end: z.iso.date().nullable(),
          player: z.object({ id, display_name: z.string().min(2) }),
        }),
      ),
    })
    .parse(raw).data;
  const day = observedAt.slice(0, 10);
  const active = rows.filter(
    (r) => (!r.start || r.start <= day) && (!r.end || r.end >= day),
  );
  if (new Set(active.map((r) => r.player_id)).size !== active.length)
    throw Error("Duplicate current squad player");
  return active.map((r) => {
    const position = team.positionMap[String(r.position_id)];
    if (
      r.team_id !== team.id ||
      r.player_id !== r.player.id ||
      !["GK", "DEF", "MID", "FWD"].includes(position)
    )
      throw Error("Unmapped EPL team/player/position");
    return {
      provider: "sportmonks",
      providerId: String(r.player_id),
      name: r.player.display_name,
      currentClubId: String(team.id),
      currentClub: team.name,
      position,
      sport: "epl" as const,
      competition: "EPL",
      observedAt,
      firstEligibleSeason: null,
      scoringSupported: true,
    };
  });
}
