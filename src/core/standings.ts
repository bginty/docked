export type StandingPlayer = {
  cardId?: string;
  playerId?: string;
  scoreUpdatedAt?: string | null;
  completed?: boolean;
  fixtures?: { scheduledAt: string; status?: string }[];
  serial?: number;
  max_supply?: number;
  slot: string;
  name: string;
  position: string;
  tier: string;
  team: string;
  multiplier: number | null;
  locked: boolean;
  baseCentipoints: number | null;
  centipoints: number | null;
  status: string;
  parts: { statistic: string; quantity: number; centipoints: number }[];
};
export type StandingRow = {
  knownCentipoints?: number | null;
  currentCentipoints?: number | null;
  currentRank?: number | null;
  completedPlayers?: number | null;
  totalPlayers?: number;
  key: string;
  name: string;
  isMe: boolean;
  rank: number | null;
  centipoints: number | null;
  points?: number | null;
  status: string;
  lineup: StandingPlayer[] | null;
};
export type StandingRound = {
  scoringVersion?: string;
  receptionCentipoints?: number;
  rarityVersion?: string | null;
  updatedAt?: string;
  lastCheckedAt?: string;
  dataDelayed?: boolean;
  feedMode?: "postgame" | "live";
  closesAt?: string;
  fixtures?: { scheduledAt: string; status?: string }[];
  serverTime?: number;
  competitionId: string;
  label: string;
  season: string;
  week: number;
  mode: string;
  series: string;
  finalised: boolean;
  visible: boolean;
  rows: StandingRow[];
};
export type SeasonRow = StandingRow & {
  weeksEntered: number;
  weeksIncluded: number;
  weeks: { round: StandingRound; entry: StandingRow }[];
};
/** The same competition ranking as the scoring engine: 1, 1, 3. */
export function sharedRanks<
  T extends { key: string; centipoints: number | null; rank: number | null },
>(rows: T[]): T[] {
  const ordered = rows
    .map((r) => ({ ...r, rank: null as number | null }))
    .sort(
      (a, b) =>
        (b.centipoints ?? -Infinity) - (a.centipoints ?? -Infinity) ||
        a.key.localeCompare(b.key),
    );
  if (ordered.every((r) => r.centipoints !== null))
    ordered.forEach((r, i) => {
      r.rank =
        i && r.centipoints === ordered[i - 1].centipoints
          ? ordered[i - 1].rank
          : i + 1;
    });
  return ordered;
}
/** Recomputed from latest journals; a reopened week drops out, never becomes zero. */
export function seasonStandings(
  rounds: StandingRound[],
  mode: string,
  season: string,
  series: string,
) {
  const selected = rounds.filter(
    (r) => r.mode === mode && r.season === season && r.series === series,
  );
  const final = selected.filter(
    (r) =>
      r.visible &&
      r.finalised &&
      r.rows.length > 0 &&
      r.rows.every(
        (e) => e.status === "final" && Number.isSafeInteger(e.centipoints),
      ),
  );
  const members = new Map<string, SeasonRow>();
  for (const round of selected)
    for (const entry of round.rows) {
      const member = members.get(entry.key) ?? {
        ...entry,
        rank: null,
        centipoints: null,
        weeksEntered: 0,
        weeksIncluded: 0,
        weeks: [],
        lineup: null,
      };
      member.weeksEntered++;
      member.weeks.push({ round, entry });
      if (final.includes(round)) {
        member.centipoints = (member.centipoints ?? 0) + entry.centipoints!;
        member.weeksIncluded++;
      }
      members.set(entry.key, member);
    }
  // Members with no finalised week have no season rank, rather than a fabricated zero.
  const scored = sharedRanks(
    [...members.values()].filter((m) => m.weeksIncluded > 0),
  );
  return {
    rows: [
      ...scored,
      ...[...members.values()]
        .filter((m) => !m.weeksIncluded)
        .sort((a, b) => a.key.localeCompare(b.key)),
    ],
    latestWeek: final.length ? Math.max(...final.map((r) => r.week)) : null,
    included: final.length,
    excluded: selected.length - final.length,
  };
}
export function standingsPage<
  T extends { key: string; name: string; isMe: boolean },
>(rows: T[], search: string, page: number, size = 10) {
  const filtered = rows.filter((r) =>
    r.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const current = Math.max(
    1,
    Math.min(pages, Number.isSafeInteger(page) ? page : 1),
  );
  return {
    rows: filtered.slice((current - 1) * size, current * size),
    total: filtered.length,
    pages,
    page: current,
  };
}
export function myTeamPage(rows: { isMe: boolean }[], size = 10) {
  const i = rows.findIndex((r) => r.isMe);
  return i < 0 ? null : Math.floor(i / size) + 1;
}
export function formatPoints(cents: number | null) {
  return cents === null ? "Pending" : (cents / 100).toFixed(2);
}
