import configuration from "../../config/nfl-seven-v1.json";

/** Slots are not player positions. This policy never changes scoring or release rules. */
export const nflCardPositions = [
  ...new Set(configuration.slots.flatMap((s) => s.positions)),
];
export const nflRosterPolicy = "official-nfl-roster-v1" as const;
export type NflRosterEvidence = {
  policy: typeof nflRosterPolicy;
  playerId: string;
  providerId: string;
  team: string;
  position: string;
  status:
    | "active"
    | "reserve"
    | "practice-squad"
    | "released"
    | "retired"
    | "unknown";
  identityVerified: boolean;
  sourceUrl: string;
  sourceHash: string;
  checkedAt: number;
};
/** Existing fantasy RB classification includes FB/HB provider labels. Dual-role
 * players retain an already verified offensive classification, never gain IDP. */
export function officialPositionMatches(official: string, fantasy: string) {
  if (!nflCardPositions.includes(fantasy)) return false;
  const labels = official
    .toUpperCase()
    .split("/")
    .map((p) => p.trim());
  return labels.some(
    (p) => p === fantasy || (fantasy === "RB" && ["HB", "FB"].includes(p)),
  );
}
export function nflCardEligibility(
  player: {
    id: string;
    providerId: string;
    position: string;
    roster?: NflRosterEvidence;
  },
  now: number,
  requireOfficial = true,
) {
  if (!nflCardPositions.includes(player.position))
    return { eligible: false, reason: "Unsupported NFL fantasy position" };
  const r = player.roster;
  if (!r)
    return {
      eligible: !requireOfficial,
      reason: "Official roster verification required",
    };
  if (
    r.policy !== nflRosterPolicy ||
    !r.identityVerified ||
    r.playerId !== player.id ||
    r.providerId !== player.providerId ||
    !r.team ||
    !r.sourceUrl.startsWith("https://") ||
    !/^[a-f0-9]{64}$/.test(r.sourceHash) ||
    !officialPositionMatches(r.position, player.position)
  )
    return {
      eligible: false,
      reason: "Conflicting or unverified roster identity",
    };
  if (
    !Number.isFinite(r.checkedAt) ||
    r.checkedAt > now ||
    now - r.checkedAt > 72 * 3600000
  )
    return { eligible: false, reason: "Roster evidence needs refreshing" };
  return {
    eligible: r.status === "active",
    reason:
      r.status === "active"
        ? "Current supported roster player"
        : `Roster status: ${r.status}`,
  };
}
/** A failed team fetch is not an empty roster. Retain previous observations;
 * normal freshness expiry stops issuance without silently deleting identities. */
export function mergeRosterEvidence(
  previous: Record<string, NflRosterEvidence>,
  incoming: NflRosterEvidence[],
  completeTeams: ReadonlySet<string>,
) {
  const next = structuredClone(previous),
    seen = new Set<string>();
  for (const r of incoming) {
    if (seen.has(r.playerId)) throw Error("Conflicting roster identity");
    seen.add(r.playerId);
    if (!completeTeams.has(r.team) || !r.identityVerified) continue;
    if (next[r.playerId]?.checkedAt > r.checkedAt) continue;
    next[r.playerId] = structuredClone(r);
  }
  return next;
}
