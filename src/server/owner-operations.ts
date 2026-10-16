import "server-only";
import { readOwnerReferenceData } from "./owner-reference-data";
import { requireRole } from "./auth";
import { db } from "./db";
import { operationFilters, type Operations } from "../core/owner-operations";
import { ownerWalletSummary } from "../core/owner-wallet-summary";
import type { CreditsState } from "../core/credits-sandbox";
import { contextualCompetitionName } from "../core/competition-display";
export async function ownerOperations(
  input: Record<string, string | undefined>,
) {
  const who = await requireRole(["owner"]),
    filters = operationFilters(input);
  if (filters.scope === "live" || process.env.DOCKED_BETA_STAGING !== "true")
    return { filters, data: null };
  const data = await db().begin(async (tx) => {
    await tx`set transaction isolation level repeatable read, read only`;
    await tx`select set_config('request.jwt.claim.sub',${who.user.id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: who.user.id, session_id: who.sessionId, aal: who.aal })},true)`;
    const [r] =
      await tx`select private.owner_command_centre(${filters.startAt}::timestamptz,${filters.endAt}::timestamptz,${filters.sport === "all" ? null : filters.sport},${filters.staff === "true"}) value`;
    const [state] =
      await tx`select document from credits_sandbox.state where id`;
    const operations = {
      ...r.value,
      competitions: (r.value.competitions as Operations["competitions"]).map(
        (competition) => ({
          ...competition,
          name: contextualCompetitionName(
            competition.name,
            competition.display,
          ),
        }),
      ),
      wallet: state
        ? ownerWalletSummary(
            state.document as CreditsState,
            Date.parse(r.value.generatedAt),
          )
        : null,
    } as Operations;
    return {
      ...operations,
      reference: await readOwnerReferenceData(
        tx,
        filters,
        state?.document ?? null,
        operations,
      ),
    };
  });
  return { filters, data: data as Operations };
}
