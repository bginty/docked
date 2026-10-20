import type { AuthorisedScoringSnapshot } from "./authorised-scoring-feed";
import type { PostgameMapping } from "./postgame-nflverse";
import { completedNflGame } from "./nflverse-evidence";

/** Owner-approved 20 October 2026: an absent player row contributes a provisional
 * zero after verified game completion. This is not a claim of confirmed DNP.
 * Raw source statistics and frozen scoring weights remain unchanged. */
export function completedNflMissingZero(
  parsed: { snapshot: AuthorisedScoringSnapshot; issues: string[] },
  mapping: PostgameMapping,
  weeklyRows: Record<string, string>[],
  plays: Record<string, string>[],
) {
  const marker = plays.length ? completedNflGame(plays) : null;
  const gameRows = weeklyRows.filter((r) => r.game_id === mapping.gameId);
  if (
    !marker ||
    marker.gameId !== mapping.gameId ||
    marker.home !== mapping.home ||
    marker.away !== mapping.away ||
    parsed.snapshot.status !== "completed" ||
    !weeklyRows.length
  )
    return parsed;
  const present = new Set(gameRows.map((r) => r.player_id));
  const assumed = new Set(
    mapping.players
      .filter((p) => !present.has(p.gsisId))
      .map((p) => p.playerId),
  );
  const affected = parsed.snapshot.players.filter(
    (p) => assumed.has(p.playerId) && p.availability === "pending",
  );
  if (!affected.length) return parsed;
  const affectedIds = new Set(affected.map((p) => p.playerId));
  return {
    snapshot: {
      ...parsed.snapshot,
      missingPlayerPolicy: "nfl-completed-missing-zero-v1" as const,
      players: parsed.snapshot.players.map((p) =>
        affectedIds.has(p.playerId)
          ? { ...p, availability: "assumed-zero" as const, stats: null }
          : p,
      ),
    },
    issues: parsed.issues.filter(
      (issue) =>
        !affected.some(
          (p) =>
            issue ===
            `${p.playerId}: Missing or unmapped player; not confirmed DNP`,
        ),
    ),
  };
}
