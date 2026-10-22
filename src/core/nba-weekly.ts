import { DateTime } from "luxon";
import {
  nbaWeeklyVersion,
  nbaWeeklyWeights,
  nbaWeeklyBonuses,
} from "./additional-sport-statistics";
import { nbaWeeklyConfiguration } from "./sport-configuration";
import { nflSeven } from "./nfl-seven";
import type { Rules } from "./scoring-v1";

export const nbaWeekZone = "America/New_York";
/** An isolated proposal, never selected by the public sport registry. */
export function nbaWeeklyLineup() {
  return {
    ...structuredClone(nflSeven),
    version: nbaWeeklyConfiguration.formatVersion,
    sport: "basketball",
    inventoryScope: "isolated-multi-sport-v1",
    salaryCap: 5_200_000,
    salaries: {
      CORE: 500_000,
      RARE: 600_000,
      ELITE: 650_000,
      ULTRA_RARE: 700_000,
      LEGENDARY: 800_000,
      ICON: 800_000,
    },
    slots: structuredClone(nbaWeeklyConfiguration.slots),
    lockPolicy: "round-wide-v1",
    commerciallyApproved: false,
  };
}
export function nbaWeeklyRules(): Rules {
  return {
    sport: "basketball",
    version: nbaWeeklyVersion,
    title: "NBA weekly · PROPOSED",
    beta: true,
    positions: ["PG", "SG", "SF", "PF", "C"],
    slots: structuredClone(nbaWeeklyConfiguration.slots),
    weights: { ...nbaWeeklyWeights },
    bonuses: { ...nbaWeeklyBonuses },
    correctionHours: 72,
    periodName: "weekly-window",
    policy: [
      "PROPOSED: eight unique players, PG/SG/SF/PF/C, guard, forward and utility. No rarity multiplier or injury compensation.",
      "Points 1, rebounds 1.2, assists 1.5, steals/blocks 3, turnovers -1. A per-game double-double adds 1.5; a triple-double adds a further 3. Qualifying categories are points, rebounds, assists, steals and blocks. Made threes are already in points. Include overtime.",
      "Sum all frozen eligible games starting Monday 00:00 through the next Monday 00:00 exclusive in America/New_York. Lock all slots at the first scheduled game. A later finish stays in the starting week. Exceptional or rescheduled fixtures require review; never silently move locked membership.",
      "Confirmed DNP is zero; missing participation is unresolved. Show known postgame points and provisional rankings while remaining games await data. Shared ranks for tied totals; member ID only stabilises display order, not a prize tie-break.",
      "Existing reviewer correction and finalisation controls apply, including the 72-hour correction window. Finalised results require the approved correction process. No live activation or issuance is authorised.",
    ],
  };
}

/** Accept explicit instants only; a timezone-less local time could be ambiguous at DST. */
export function nbaWeek(scheduledAt: string) {
  if (!/(?:Z|[+-]\d{2}:\d{2})$/.test(scheduledAt))
    throw Error("Explicit scheduled instant required");
  const local = DateTime.fromISO(scheduledAt, { setZone: true }).setZone(
    nbaWeekZone,
  );
  if (!local.isValid) throw Error("Invalid scheduled instant");
  const start = local.startOf("week");
  return {
    key: start.toISODate()!,
    start: start.toUTC().toISO()!,
    end: start.plus({ weeks: 1 }).toUTC().toISO()!,
    timezone: nbaWeekZone,
  };
}

/** Reviewed complete schedule in, immutable membership proposal out. No I/O or activation.
 * Stable fixture IDs plus the existing journal preserve trades and overnight games.
 * Re-freezing must pass ALL previously assigned IDs to prevent a moved game counting twice. */
export function freezeNbaWeek(
  monday: string,
  fixtures: {
    id: string;
    scheduledAt: string;
    playerIds: string[];
    status: string;
  }[],
  evidence: {
    complete: boolean;
    previouslyAssigned: Readonly<Record<string, string>>;
  },
) {
  const local = DateTime.fromISO(monday, { zone: nbaWeekZone });
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(monday) ||
    !local.isValid ||
    local.weekday !== 1 ||
    !evidence.complete
  )
    throw Error("Verified complete Monday schedule required");
  const window = nbaWeek(local.toUTC().toISO()!);
  if (new Set(fixtures.map((f) => f.id)).size !== fixtures.length)
    throw Error("Duplicate fixture identity");
  const selected = fixtures.filter(
    (f) => nbaWeek(f.scheduledAt).key === monday,
  );
  if (!selected.length)
    throw Error("No eligible games; do not open a competition");
  for (const f of selected) {
    if (
      !f.id ||
      !f.playerIds.length ||
      new Set(f.playerIds).size !== f.playerIds.length ||
      f.status !== "scheduled"
    )
      throw Error(
        "Exceptional fixture or unresolved player mapping requires review",
      );
    if (
      evidence.previouslyAssigned[f.id] &&
      evidence.previouslyAssigned[f.id] !== monday
    )
      throw Error(
        "Fixture already assigned to another frozen week; reconciliation required",
      );
  }
  selected.sort(
    (a, b) =>
      Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt) ||
      a.id.localeCompare(b.id),
  );
  return {
    window: { start: window.start, end: window.end, timezone: window.timezone },
    locksAt: selected[0].scheduledAt,
    fixtures: selected.map(({ id, scheduledAt, playerIds }) => ({
      id,
      scheduledAt,
      playerIds: [...playerIds],
    })),
  };
}
