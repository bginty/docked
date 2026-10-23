import { z } from "zod";
const game = z.object({
  id: z.string(),
  sport: z.enum(["afl", "nrl"]),
  season: z.string(),
  round: z.string(),
  season_type: z.enum(["REG", "POST"]),
  kickoff: z.number().nullable(),
  home_name: z.string(),
  away_name: z.string(),
  home_score: z.number().int().nonnegative(),
  away_score: z.number().int().nonnegative(),
  venue: z.string().nullable(),
  status: z.literal("final"),
  revision: z.number().int().positive(),
  provenance: z.url(),
});
export const historicalArchive = z.object({
  schema_version: z.literal("docked-historical-fixtures-v1"),
  sport: z.enum(["afl", "nrl"]),
  season: z.literal("2026"),
  synthetic: z.literal(false),
  source: z.string(),
  source_url: z.url(),
  rights_url: z.url(),
  imported_at: z.number(),
  player_games: z.literal(0),
  player_statistics_available: z.literal(false),
  attribution: z.string().optional(),
  source_revisions: z.array(z.url()).optional(),
  games: z.array(game).max(500),
});
export type HistoricalArchive = z.infer<typeof historicalArchive>;
export const historyQuery = z.object({
  sport: z.enum(["afl", "nrl"]),
  season: z.literal("2026").default("2026"),
  team: z.string().max(100).default(""),
  round: z.string().max(40).default(""),
  page: z.coerce.number().int().min(0).max(30).default(0),
});
export function historicalPage(
  archive: HistoricalArchive,
  query: z.infer<typeof historyQuery>,
) {
  if (archive.sport !== query.sport || archive.season !== query.season)
    throw Error("Archive scope mismatch");
  const all = [...archive.games].sort(
    (a, b) => (b.kickoff ?? 0) - (a.kickoff ?? 0) || a.id.localeCompare(b.id),
  );
  const filtered = all.filter(
    (g) =>
      (!query.team || [g.home_name, g.away_name].includes(query.team)) &&
      (!query.round || g.round === query.round),
  );
  const { games: _games, ...meta } = archive;
  return {
    ...meta,
    total: all.length,
    filtered: filtered.length,
    page: query.page,
    teams: [...new Set(all.flatMap((g) => [g.home_name, g.away_name]))].sort(),
    rounds: [...new Set(all.map((g) => g.round))].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    ),
    games: filtered.slice(query.page * 20, query.page * 20 + 20),
    hasMore: (query.page + 1) * 20 < filtered.length,
  };
}
export type HistoricalPage = ReturnType<typeof historicalPage>;
