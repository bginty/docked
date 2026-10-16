import type { FantasyCard, FantasyCompetition } from "./fantasy";
import { competitionCardEligible } from "./fantasy-play";
import { teamFilter } from "./card-presentation";
import { nflSeven } from "./nfl-seven";
/** Membership and slot eligibility are applied before all optional filters. */
export function slotPool(
  cards: FantasyCard[],
  owner: string,
  competition: FantasyCompetition,
  slot: string,
  config = nflSeven,
) {
  const positions = config.slots.find((s) => s.id === slot)?.positions ?? [];
  return cards.filter(
    (c) =>
      c.owner_id === owner &&
      c.sport === competition.sport &&
      positions.includes(c.position) &&
      competitionCardEligible(c, competition),
  );
}
export function filterSlotPool(
  cards: FantasyCard[],
  filters: { search: string; tier: string; team: string; position: string },
) {
  return cards.filter(
    (c) =>
      (!filters.team || teamFilter(c.team).key === filters.team) &&
      (!filters.tier || c.tier === filters.tier) &&
      (!filters.position || c.position === filters.position) &&
      c.name
        .toLocaleLowerCase()
        .includes(filters.search.trim().toLocaleLowerCase()),
  );
}

/** Prefer the selected competition's fixture snapshot, deduplicating only stable IDs. */
export function upcomingFixtures(
  groups: Record<
    string,
    {
      fixtureId: string;
      scheduledAt: string;
      playerIds: string[];
      status?: string;
    }[]
  >,
  competition: string | undefined,
  player: string,
  now: number,
) {
  const candidates = [
    ...(competition ? (groups[competition] ?? []) : []),
    ...Object.values(groups).flat(),
  ];
  const unique = new Map<string, (typeof candidates)[number]>();
  for (const fixture of candidates)
    if (!unique.has(fixture.fixtureId)) unique.set(fixture.fixtureId, fixture);
  return [...unique.values()]
    .filter(
      (f) => f.playerIds.includes(player) && Date.parse(f.scheduledAt) > now,
    )
    .sort(
      (a, b) =>
        Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt) ||
        a.fixtureId.localeCompare(b.fixtureId),
    );
}
