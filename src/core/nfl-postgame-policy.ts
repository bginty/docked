import { nflOffensiveStats } from "./fantasy-nfl";

export const nflPostgameVersion = "docked-nfl-postgame-full-ppr-test-v1";
export const nflFutureVersions = {
  base: "docked-nfl-full-ppr-beta-v2",
  rarity: "docked-nfl-rarity-full-ppr-v2",
  seven: "docked-nfl-seven-full-ppr-v2",
  sevenRoundWide: "docked-nfl-seven-full-ppr-round-wide-v3",
} as const;
export function isNflAlignedVersion(version?: string) {
  return Object.values(nflFutureVersions).some((v) => v === version);
}
// Explicit owner-requested TEST policy. Missing legacy return/recovery fields are
// not filled with zero: they are outside this version's scoring contract.
export const nflPostgameStats = nflOffensiveStats
  .omit({
    kickoff_return_touchdowns: true,
    punt_return_touchdowns: true,
  })
  .strict();
export const nflPostgameWeights = {
  passing_yards: 4,
  passing_touchdowns: 400,
  interceptions_thrown: -200,
  passing_two_point_conversions: 200,
  rushing_yards: 10,
  rushing_touchdowns: 600,
  rushing_two_point_conversions: 200,
  receiving_yards: 10,
  receptions: 100,
  receiving_touchdowns: 600,
  receiving_two_point_conversions: 200,
  fumbles_lost: -200,
};
