import "server-only";
import type { TransactionSql } from "postgres";
import type { CreditsState } from "../core/credits-sandbox";
import type { Operations } from "../core/owner-operations";
import type { OwnerReferenceAggregate } from "../core/owner-reference-data";
import { ownerReferenceProjection } from "../core/owner-reference-projection";

/** Called only inside ownerOperations' authenticated repeatable-read transaction. */
export async function readOwnerReferenceData(
  tx: TransactionSql,
  filters: { startAt: string; endAt: string; sport: string; staff: string },
  state: CreditsState | null,
  operations: Operations,
) {
  const [row] =
    await tx`select private.owner_reference_reporting(${filters.startAt}::timestamptz,${filters.endAt}::timestamptz,${filters.sport === "all" ? null : filters.sport},${filters.staff === "true"}) value`;
  return ownerReferenceProjection(
    row.value as OwnerReferenceAggregate,
    state,
    operations,
    filters,
  );
}
