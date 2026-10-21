import { z } from "zod";
import { sportConfigurations } from "./sport-configuration";

const identifier = z.string().trim().min(1).max(160);
const source = z
  .object({
    url: z.url().refine((s) => s.startsWith("https://")),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    observedAt: z.iso.datetime(),
  })
  .strict();
/** Normalised evidence contract, not a licence or a guessed provider mapping. */
export const rosterCandidate = z
  .object({
    sport: z.enum(["afl", "nrl", "basketball", "football"]),
    season: identifier,
    playerId: identifier,
    provider: identifier,
    providerPlayerId: identifier,
    name: z.string().trim().min(2).max(160),
    teamId: identifier,
    teamName: identifier,
    presentation: z
      .object({
        city: z.string().trim().min(1).max(80),
        primary: z.string().regex(/^#[0-9a-f]{6}$/i),
        accent: z.string().regex(/^#[0-9a-f]{6}$/i),
        evidence: source,
      })
      .strict()
      .optional(),
    identityVerified: z.boolean(),
    registration: z.enum([
      "active",
      "reserve",
      "loan",
      "temporary",
      "released",
      "retired",
      "unknown",
    ]),
    availability: z.enum(["available", "injured", "suspended", "unknown"]),
    positions: z.array(identifier).min(1).max(6),
    positionsVerified: z.boolean(),
    jerseyNumber: z.number().int().min(0).max(999).nullable(),
    jerseyVerified: z.boolean(),
    evidence: source,
  })
  .strict();
export type RosterCandidate = z.infer<typeof rosterCandidate>;
export const rosterReviewPolicy = z
  .object({
    sport: rosterCandidate.shape.sport,
    season: identifier,
    provider: identifier,
    rightsEvidence: z.url().refine((s) => s.startsWith("https://")),
    rightsExpiresAt: z.iso.datetime(),
    rosterUse: z.literal(true),
    storage: z.literal(true),
    fantasyUse: z.literal(true),
    maxAgeHours: z.number().int().min(1).max(168),
    // Must be selected in a reviewed policy; no silent loan/reserve exclusions.
    permittedRegistrations: z.array(rosterCandidate.shape.registration).min(1),
  })
  .strict()
  .refine(
    (p) =>
      !p.permittedRegistrations.some((s) =>
        ["unknown", "retired", "released"].includes(s),
      ),
    "Inactive or unknown registrations cannot be approved",
  );
export type RosterReviewPolicy = z.infer<typeof rosterReviewPolicy>;
export type RosterReview = {
  playerId: string | null;
  providerPlayerId: string | null;
  status: "ready-for-review" | "quarantined";
  reasons: string[];
  candidate: RosterCandidate | null;
};

/** A complete fetch is required for NEW issuance eligibility. Failed or partial
 * fetches never delete existing evidence, cards, ownership or historical teams. */
export function reviewRosterBatch(
  raw: unknown[],
  policyInput: unknown,
  now: string,
  completeTeamIds: readonly string[],
): RosterReview[] {
  const policy = rosterReviewPolicy.parse(policyInput),
    at = Date.parse(now);
  if (!Number.isFinite(at) || at >= Date.parse(policy.rightsExpiresAt))
    throw Error("Current roster rights review required");
  if (raw.length > 10000) throw Error("Roster batch too large");
  const parsed = raw.map((r) => rosterCandidate.safeParse(r));
  const counts = {
    playerId: new Map<string, number>(),
    providerPlayerId: new Map<string, number>(),
  };
  for (const r of parsed)
    if (r.success)
      for (const key of ["playerId", "providerPlayerId"] as const)
        counts[key].set(r.data[key], (counts[key].get(r.data[key]) ?? 0) + 1);
  return parsed.map((r) => {
    if (!r.success)
      return {
        playerId: null,
        providerPlayerId: null,
        status: "quarantined",
        reasons: ["Invalid or incomplete evidence"],
        candidate: null,
      };
    const c = r.data,
      reasons: string[] = [];
    if (
      c.sport !== policy.sport ||
      c.season !== policy.season ||
      c.provider !== policy.provider
    )
      reasons.push("Sport, season or provider mismatch");
    if (
      !c.identityVerified ||
      counts.playerId.get(c.playerId) !== 1 ||
      counts.providerPlayerId.get(c.providerPlayerId) !== 1
    )
      reasons.push("Identity unverified or duplicated");
    if (!completeTeamIds.includes(c.teamId))
      reasons.push("Team roster fetch incomplete");
    if (!policy.permittedRegistrations.includes(c.registration))
      reasons.push(`Registration needs review: ${c.registration}`);
    const permitted = new Set(
      sportConfigurations[policy.sport].slots.flatMap((s) => s.positions),
    );
    if (
      !c.positionsVerified ||
      new Set(c.positions).size !== c.positions.length ||
      c.positions.some((p) => !permitted.has(p))
    )
      reasons.push("Fantasy positions unverified or unsupported");
    const age = at - Date.parse(c.evidence.observedAt);
    if (age < 0 || age > policy.maxAgeHours * 3600000)
      reasons.push("Roster evidence stale or future-dated");
    if (c.presentation) {
      const age = at - Date.parse(c.presentation.evidence.observedAt);
      if (age < 0 || age > policy.maxAgeHours * 3600000)
        reasons.push("City/colour evidence stale or future-dated");
    }
    // Unknown numbers stay blank. Injury/suspension alone does not retire a player.
    if (c.jerseyNumber !== null && !c.jerseyVerified)
      reasons.push("Jersey number unverified");
    return {
      playerId: c.playerId,
      providerPlayerId: c.providerPlayerId,
      status: reasons.length ? "quarantined" : "ready-for-review",
      reasons,
      candidate: c,
    };
  });
}

/** Review preview metadata only; this is not a collectible or issuance command. */
export function reviewedRosterPresentation(review: RosterReview) {
  const c = review.candidate;
  if (review.status !== "ready-for-review" || !c?.presentation)
    throw Error("Reviewed city and colours required");
  return {
    sport: c.sport,
    name: c.name,
    team: c.teamId,
    city: c.presentation.city,
    colour: c.presentation.primary,
    accentColour: c.presentation.accent,
    verifiedJerseyNumber: c.jerseyVerified ? c.jerseyNumber : null,
  };
}

/** Review output deliberately grants no eligibility/issuance or live activation. */
export function rosterReviewReport(
  raw: unknown[],
  policy: unknown,
  now: string,
  completeTeams: string[],
) {
  const rows = reviewRosterBatch(raw, policy, now, completeTeams);
  return {
    schemaVersion: 1,
    generatedAt: now,
    activationAllowed: false,
    issuanceAllowed: false,
    readyForReview: rows.filter((r) => r.status === "ready-for-review").length,
    quarantined: rows.filter((r) => r.status === "quarantined").length,
    rows,
  };
}
