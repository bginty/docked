import "server-only";
import {
  betaCreditRequestMutation,
  type BetaCreditRequest,
  type BetaCreditRequestListing,
} from "@/core/beta-credit-requests";
import { creditsPolicy } from "@/core/credits-policy";
import { requireRole } from "./auth";
import { db, rateLimit } from "./db";

export async function betaCreditRequests(input: {
  page?: number;
  q?: string;
  mutation?: unknown;
}): Promise<BetaCreditRequestListing | BetaCreditRequest> {
  const actor = await requireRole(["owner"]);
  if (process.env.DOCKED_BETA_STAGING !== "true")
    throw Error("Credit request source unavailable");
  const mutation =
    input.mutation === undefined
      ? undefined
      : betaCreditRequestMutation.parse(input.mutation);
  const page = input.page ?? 1,
    q = (input.q ?? "").trim();
  if (!Number.isInteger(page) || page < 1 || page > 100 || q.length > 120)
    throw Error("Invalid credit request query");
  if (
    !(await rateLimit(
      `beta-credit-request:${actor.user.id}`,
      mutation ? 20 : 60,
      60,
    ))
  )
    throw Error("Request rate limit");
  return db().begin(async (tx) => {
    // Admission checks take FOR SHARE locks; SQL READ ONLY would reject them.
    // Read branches still call only permission-scoped reporting projections.
    await tx`set local statement_timeout='4000ms'`;
    await tx`select set_config('request.jwt.claim.sub',${actor.user.id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: actor.user.id, session_id: actor.sessionId, aal: actor.aal })},true)`;
    if (mutation) {
      const [row] =
        await tx`select private.credit_request_mutate(${tx.json(mutation)}::jsonb,${creditsPolicy.version}) value`;
      return row.value as BetaCreditRequest;
    }
    const [row] =
      await tx`select private.credit_request_list(${q},${page}) value`;
    return row.value as BetaCreditRequestListing;
  });
}
