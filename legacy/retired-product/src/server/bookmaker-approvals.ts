import type postgres from "postgres";
import type { BookmakerApproval } from "@/core/bookmaker-approval";
export async function currentBookmakerApprovals(
  sql: postgres.Sql | postgres.TransactionSql,
): Promise<BookmakerApproval[]> {
  // Reference sources require current permission in at least one reviewed region.
  // The offered bookmaker additionally needs the recipient/publication's exact region.
  const rows =
    await sql`select b.bookmaker,b.operator_group,b.approved,b.effective_from,b.effective_to from private.bookmaker_eligibility b join private.region_policies r on r.id=b.region_policy_id where b.approved and b.effective_from<=now() and b.effective_to>now() and r.approved and r.effective_from<=now() and r.effective_to>now() and r.review_at>now() and b.bookmaker=any(r.operators) and 'tips'=any(r.features) for share of b,r`;
  return rows.map((row) => ({
    bookmaker: row.bookmaker,
    operator: row.operator_group,
    approved: row.approved,
    effectiveFrom: row.effective_from.toISOString(),
    effectiveTo: row.effective_to.toISOString(),
  }));
}
