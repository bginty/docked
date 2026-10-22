import { z } from "zod";
import { appSport, feedSport } from "./multisport-delivery";
import { digest } from "./scoring-engine";
import { rosterCandidate } from "./sport-roster-review";
const rawRoster = z.object({
  sport: feedSport,
  season: z.string().optional(),
  player_id: z.string(),
  provider_id: z.string(),
  provider: z.string(),
  team_id: z.string(),
  name: z.string(),
  synthetic: z.boolean(),
  verified_at: z.number().finite().nonnegative(),
  contract_status: z.string(),
  contract_evidence: z.string().optional(),
  availability: z.enum(["available", "injured", "suspended", "unknown"]),
  approved_positions: z.array(z.string()).optional(),
  approved_position: z.string().optional(),
  position_evidence: z.string().optional(),
  jersey: z.union([z.number(), z.string(), z.null()]).optional(),
  jersey_evidence: z.string().optional(),
});
/** Reviewed identity binding supplies Docked IDs and source evidence. A source
 * roster is not an issuance command or permission to mint a new identity. */
export function serviceRosterCandidate(
  input: unknown,
  binding: {
    sport: z.infer<typeof feedSport>;
    season: string;
    provider: string;
    canonicalPlayerId: string;
    providerPlayerId: string;
    playerId: string;
    canonicalTeamId: string;
    teamId: string;
    teamName: string;
    evidenceUrl: string;
  },
) {
  const r = rawRoster.parse(input);
  if (r.synthetic)
    throw Error("Synthetic roster cannot enter authorised review");
  if (
    r.sport !== binding.sport ||
    r.provider !== binding.provider ||
    r.player_id !== binding.canonicalPlayerId ||
    r.provider_id !== binding.providerPlayerId ||
    r.team_id !== binding.canonicalTeamId ||
    r.season !== binding.season
  )
    throw Error("Roster identity/season binding mismatch");
  const number =
    typeof r.jersey === "number"
      ? r.jersey
      : typeof r.jersey === "string" && /^\d{1,3}$/.test(r.jersey)
        ? Number(r.jersey)
        : null;
  const registrations: Record<string, string> = {
    active_contracted: "active",
    free_agent: "free-agent",
    released: "released",
    retired: "retired",
  };
  return rosterCandidate.parse({
    sport: appSport[r.sport],
    season: binding.season,
    playerId: binding.playerId,
    provider: binding.provider,
    providerPlayerId: r.provider_id,
    name: r.name,
    teamId: binding.teamId,
    teamName: binding.teamName,
    identityVerified: true,
    registration:
      r.contract_status === "active_contracted" && !r.contract_evidence
        ? "unknown"
        : (registrations[r.contract_status] ?? "unknown"),
    availability: r.availability,
    positions:
      r.approved_positions ??
      (r.approved_position ? [r.approved_position] : ["UNKNOWN"]),
    positionsVerified: !!r.position_evidence,
    jerseyNumber: number,
    jerseyVerified: number !== null && !!r.jersey_evidence,
    evidence: {
      url: binding.evidenceUrl,
      sha256: digest(input),
      observedAt: new Date(r.verified_at * 1000).toISOString(),
    },
  });
}
