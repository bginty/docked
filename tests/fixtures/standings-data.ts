import {
  sharedRanks,
  type StandingRound,
  type StandingPlayer,
} from "../../src/core/standings";
const players: StandingPlayer[] = [
  "QB",
  "RB",
  "RB",
  "WR",
  "WR",
  "TE",
  "RB",
].map((position, i) => ({
  slot: ["QB1", "RB1", "RB2", "WR1", "WR2", "TE1", "FLEX1"][i],
  name: `Fixture Player ${i + 1}`,
  position,
  tier: i === 0 ? "CORE" : "RARE",
  team: ["NYG", "KC", "NYJ", "LAR", "LAC", "PIT", "SEA"][i],
  serial: i + 1,
  max_supply: 5000,
  multiplier: i === 0 ? 1 : 1.1,
  locked: true,
  completed: true,
  baseCentipoints: 1000,
  centipoints: i === 0 ? 1000 : 1100,
  status: "final",
  parts: [{ statistic: "Rushing yards", quantity: 100, centipoints: 1000 }],
}));
export const standingsFixture: StandingRound[] = ["SALARY_CAP", "OPEN"].flatMap(
  (mode) =>
    [1, 2, 3].map((week) => ({
      competitionId: `fixture-${mode}-${week}`,
      label: "LOCAL standings fixture",
      season: "2026",
      week,
      mode,
      series: "fixture-scoring-v1",
      visible: true,
      feedMode: "postgame" as const,
      updatedAt: "2026-10-20T04:00:00Z",
      finalised: week < 3,
      rows: sharedRanks(
        Array.from({ length: 25 }, (_, i) => ({
          key: `member-${String(i).padStart(2, "0")}`,
          name: i === 22 ? "Local Test Team" : `Fixture Team ${i + 1}`,
          isMe: i === 22,
          rank: null,
          completedPlayers: week < 3 ? 7 : 0,
          totalPlayers: 7,
          centipoints: week === 3 ? null : 20000 - i * 120 + week * 4,
          status: week === 3 ? "pending-data" : "final",
          lineup: i === 22 || week < 3 ? players : null,
        })),
      ),
    })),
);
