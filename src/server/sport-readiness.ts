import "server-only";
import { z } from "zod";
import { requireRole } from "./auth";
import { db, rateLimit } from "./db";
import type { SportReadinessReport } from "../core/sport-readiness-report";
import { evaluateReadiness } from "../core/sport-readiness";
const decision = z
  .object({
    packageHash: z.string().regex(/^[a-f0-9]{64}$/),
    action: z.enum(["approve", "suspend"]),
    reason: z.string().trim().min(10).max(1000),
    requestId: z.uuid(),
  })
  .strict();
export async function sportReadiness(input?: unknown) {
  const who = await requireRole(["owner"]);
  if (process.env.DOCKED_BETA_STAGING !== "true")
    throw Error("Beta operations required");
  if (input && !(await rateLimit(`sport-readiness:${who.user.id}`, 12, 60)))
    throw Error("Please wait before retrying");
  return db().begin(async (tx) => {
    await tx`select set_config('request.jwt.claim.sub',${who.user.id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: who.user.id, session_id: who.sessionId, aal: who.aal })},true)`;
    const [r] = await tx`select private.sport_readiness_report() value`;
    const report = r.value as SportReadinessReport;
    const [testing] =
      await tx`select private.sport_private_beta_report() value`;
    const privateTesting = (
      testing.value as NonNullable<SportReadinessReport["privateTesting"]>
    ).map((row) => {
      const gameplayEnabled =
        row.databaseEnabled &&
        process.env.DOCKED_NBA_PRIVATE_BETA === "true" &&
        (row.sport === "basketball" ||
          process.env.DOCKED_SPORTS_PRIVATE_BETA === "true");
      return {
        ...row,
        gameplayEnabled,
        commerceEnabled:
          gameplayEnabled &&
          row.allocationEnabled &&
          process.env.DOCKED_SPORTS_TEST_COMMERCE === "true",
      };
    });
    if (input) {
      const d = decision.parse(input),
        p = report.packages.find((p) => p.hash === d.packageHash);
      if (!p) throw Error("Package changed; refresh and review");
      if (
        d.action === "approve" &&
        !evaluateReadiness(p.body, report.generatedAt, p.hash)
          .readyForOwnerReview
      )
        throw Error("Required evidence is missing, expired or superseded");
      await tx`select private.sport_readiness_decide(${d.packageHash},${d.action},${d.reason},${d.requestId}::uuid)`;
      const [updated] = await tx`select private.sport_readiness_report() value`;
      return { ...(updated.value as SportReadinessReport), privateTesting };
    }
    return { ...report, privateTesting };
  });
}
