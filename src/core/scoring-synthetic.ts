// Authored statistics, fake people and fake cards. Never issued into a member inventory.
import { rulesets, type Sport } from "./scoring-v1";
import { eplOnPitchEvidence, type SourceSnapshot } from "./scoring-provider";
import { createPeriod, type CatalogCard } from "./scoring-engine";
export const scenarioTimes = {
  created: "2026-10-01T00:00:00Z",
  save: "2026-10-01T01:00:00Z",
  lock: "2026-10-02T00:00:00Z",
  ended: "2026-10-02T04:00:00Z",
  initial: "2026-10-02T05:00:00Z",
  corrected: "2026-10-03T05:00:00Z",
  final: "2026-10-08T05:00:00Z",
};
export function syntheticStats(sport: Sport) {
  if (sport === "epl")
    return {
      ...eplOnPitchEvidence({
        intervals: [
          {
            enterOrder: 0,
            leaveOrder: 200,
            regulationSeconds: 5400,
            playedSeconds: 5700,
          },
        ],
        concededGoalOrders: [80],
      }),
      goals: 0,
      assists: 0,
      saves: 3,
      penaltySaves: 0,
      penaltiesMissed: 0,
      yellowCards: 0,
      dismissal: "none",
      ownGoals: 0,
    };
  return Object.fromEntries(
    Object.keys(rulesets[sport].weights).map((k) => [k, 0]),
  );
}
export function syntheticScenario(sport: Sport) {
  const rules = structuredClone(rulesets[sport]);
  const catalog: CatalogCard[] = ["amber", "violet"].flatMap((owner) =>
    rules.slots.map((slot, i) => ({
      cardId: `sim:${sport}:${owner}:card${i}`,
      playerId: `sim:${sport}:${owner}:player${i}`,
      position: slot.positions[0],
      sport,
      owner,
      eligible: true,
    })),
  );
  const fixtureId = `sim:${sport}:fixture1`;
  const state = createPeriod(
    {
      id: `sim:${sport}:scoring-v1`,
      sport,
      label: `Synthetic ${rules.periodName} 1`,
      rules,
      locksAt: scenarioTimes.lock,
      fixtures: [
        {
          id: fixtureId,
          playerIds: catalog.map((c) => c.playerId),
          scheduledAt: scenarioTimes.lock,
        },
      ],
    },
    scenarioTimes.created,
  );
  const source: SourceSnapshot = {
    provider: "docked-synthetic-v1",
    simulated: true,
    sport,
    fixtureId,
    revision: 1,
    observedAt: scenarioTimes.initial,
    endedAt: scenarioTimes.ended,
    status: "completed",
    players: catalog.map((c, i) => ({
      playerId: c.playerId,
      availability: "complete",
      stats: {
        ...syntheticStats(sport),
        ...(i === 0
          ? sport === "epl"
            ? { goals: 1 }
            : sport === "nfl"
              ? { passing_yards: 100 }
              : { kicks: 1 }
          : {}),
      },
    })),
  };
  const correction = structuredClone(source);
  correction.revision = 2;
  correction.observedAt = scenarioTimes.corrected;
  correction.players[rules.slots.length].stats = {
    ...syntheticStats(sport),
    ...(sport === "epl"
      ? { goals: 2 }
      : sport === "nfl"
        ? { passing_yards: 200 }
        : { kicks: 2 }),
  };
  return { state, catalog, source, correction };
}
