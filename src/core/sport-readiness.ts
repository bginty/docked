import { z } from "zod";
import { sportConfigurations } from "./sport-configuration";

export const activationGates = [
  "roster-format",
  "scoring-rules",
  "eligible-catalogue",
  "source-rights",
  "operational-ingestion",
  "score-reconciliation",
  "supply-issuance",
  "lockout-privacy",
  "wallet-ownership",
  "hosted-acceptance",
  "owner-activation",
] as const;
export const gateLabels: Record<(typeof activationGates)[number], string> = {
  "roster-format": "Roster structure",
  "scoring-rules": "Scoring and salary rules",
  "eligible-catalogue": "Verified eligible catalogue",
  "source-rights": "Source usage permission",
  "operational-ingestion": "Operational fixtures and statistics",
  "score-reconciliation": "Scoring and leaderboard reconciliation",
  "supply-issuance": "Scarcity and pack issuance approval",
  "lockout-privacy": "Lockout and privacy verification",
  "wallet-ownership": "Wallet and ownership regression",
  "hosted-acceptance": "Hosted acceptance",
  "owner-activation": "Owner activation approval",
};
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const id = z.string().trim().min(1).max(160);
export const readinessPackage = z
  .object({
    schemaVersion: z.literal(1),
    sport: z.enum(["afl", "football", "basketball", "nrl"]),
    season: id,
    mode: z.enum(["OPEN", "SALARY_CAP"]),
    formatVersion: id,
    scoringVersion: id,
    // All approval evidence must refer to the same immutable release inputs.
    releaseHash: hash,
    catalogueHash: hash,
    rulesHash: hash,
    issuanceHash: hash,
    salaryCap: z.number().int().positive().nullable(),
    provider: id,
    evidence: z
      .array(
        z
          .object({
            gate: z.enum(
              activationGates.slice(0, -1) as [
                Exclude<(typeof activationGates)[number], "owner-activation">,
                ...Exclude<
                  (typeof activationGates)[number],
                  "owner-activation"
                >[],
              ],
            ),
            releaseHash: hash,
            catalogueHash: hash,
            rulesHash: hash,
            issuanceHash: hash,
            reference: z.string().trim().min(1).max(1000),
            sha256: hash,
            verifiedAt: z.iso.datetime(),
            expiresAt: z.iso.datetime(),
            outcome: z.enum(["passed", "blocked"]),
          })
          .strict(),
      )
      .max(10),
  })
  .strict();
export type ReadinessPackage = z.infer<typeof readinessPackage>;
export type ReadinessDecision = {
  packageHash: string;
  action: "approve" | "suspend";
  at: string;
};
/** Informational evaluation, not a feature flag. Owner decisions come only from
 * the authenticated, append-only DB journal. A draft never turns on issuance. */
export function evaluateReadiness(
  input: unknown,
  now: string,
  packageHash: string,
  decision?: ReadinessDecision | null,
) {
  const p = readinessPackage.parse(input),
    at = Date.parse(now);
  if (!Number.isFinite(at)) throw Error("Invalid evaluation time");
  if (new Set(p.evidence.map((e) => e.gate)).size !== p.evidence.length)
    throw Error("Duplicate activation evidence");
  const cfg = sportConfigurations[p.sport];
  const gates = activationGates.map((gate) => {
    if (gate === "owner-activation")
      return {
        gate,
        label: gateLabels[gate],
        passed:
          decision?.action === "approve" &&
          decision.packageHash === packageHash &&
          Number.isFinite(Date.parse(decision.at)) &&
          Date.parse(decision.at) <= at,
        reason: "Owner decision must bind this exact package",
      };
    const e = p.evidence.find((e) => e.gate === gate);
    let reason = "Evidence missing";
    let passed = false;
    if (e) {
      passed =
        e.outcome === "passed" &&
        Date.parse(e.verifiedAt) <= at &&
        at < Date.parse(e.expiresAt) &&
        ["releaseHash", "catalogueHash", "rulesHash", "issuanceHash"].every(
          (k) => e[k as "releaseHash"] === p[k as "releaseHash"],
        );
      reason = passed ? e.reference : "Blocked, expired or superseded evidence";
    }
    if (gate === "roster-format" && cfg.formatVersion !== p.formatVersion) {
      passed = false;
      reason = "Configured roster version differs";
    }
    if (
      gate === "scoring-rules" &&
      (cfg.scoringVersion !== p.scoringVersion ||
        (p.mode === "SALARY_CAP" && p.salaryCap === null) ||
        (p.mode === "OPEN" && p.salaryCap !== null))
    ) {
      passed = false;
      reason = "Rules version or competition salary policy missing/mismatched";
    }
    return { gate, label: gateLabels[gate], passed, reason };
  });
  return {
    gates,
    readyForOwnerReview: gates.slice(0, -1).every((g) => g.passed),
    readyForRelease: gates.every((g) => g.passed),
    activated: false as const,
  };
}
