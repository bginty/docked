/** Raw-feed translation only. The existing authorised validator and scoring engine
 * remain authoritative. Never infer ordered EPL evidence from rounded minutes. */
export type RawGame = {
  sport: "epl" | "nba" | "afl" | "nrl";
  fixture_id: string;
  player_id: string;
  revision: number;
  synthetic: boolean;
  usable: boolean;
  stats: Record<string, number | null>;
  current_fields: Record<string, boolean>;
};
const aflFields = {
  kicks: "kicks",
  handballs: "handballs",
  marks: "marks",
  tackles: "tackles",
  goals: "goals",
  behinds: "behinds",
  hitouts: "hitouts",
  freesFor: "frees_for",
  freesAgainst: "frees_against",
} as const;
export function mapRawScoringInput(
  row: RawGame,
  mappedPlayerId: string | null,
) {
  if (!mappedPlayerId)
    return {
      availability: "pending" as const,
      stats: null,
      reason: "Player mapping requires review",
    };
  if (row.synthetic || !row.usable)
    return {
      availability: "pending" as const,
      stats: null,
      reason: "Awaiting usable real statistics",
    };
  if (row.sport === "epl")
    return {
      availability: "pending" as const,
      stats: null,
      reason:
        "Ordered on-pitch and regulation-time evidence required by existing EPL rules",
    };
  if (row.sport !== "afl")
    return {
      availability: "pending" as const,
      stats: null,
      reason: "Approved Docked scoring contract required",
    };
  const stats: Record<string, number> = {};
  for (const [target, source] of Object.entries(aflFields)) {
    const value = row.stats[source];
    if (
      !row.current_fields[source] ||
      !Number.isSafeInteger(value) ||
      value == null ||
      value < 0
    )
      return {
        availability: "pending" as const,
        stats: null,
        reason: `Awaiting ${source}`,
      };
    stats[target] = value;
  }
  return { availability: "complete" as const, stats, reason: null };
}
