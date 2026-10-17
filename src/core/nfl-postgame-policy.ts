import { nflOffensiveStats } from "./fantasy-nfl";

export const nflPostgameVersion = "docked-nfl-postgame-full-ppr-test-v1";
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
