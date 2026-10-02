import type { Quote } from "./pricing";
export type BookmakerApproval = {
  bookmaker: string;
  operator: string;
  approved: boolean;
  effectiveFrom: string;
  effectiveTo: string;
};
/** Snapshot approval is evidence of the past, not authority to keep using a revoked source. */
export function revalidateBookmakers(
  quotes: Quote[],
  approvals: BookmakerApproval[],
  now: string,
) {
  const at = Date.parse(now);
  const active = approvals.filter(
    (a) =>
      a.approved &&
      a.operator.trim() &&
      Number.isFinite(at) &&
      Date.parse(a.effectiveFrom) <= at &&
      Date.parse(a.effectiveTo) > at,
  );
  const accepted: Quote[] = [];
  const rejections: { quoteId: string; reason: string }[] = [];
  for (const quote of quotes) {
    const groups = new Set(
      active
        .filter((a) => a.bookmaker === quote.bookmaker)
        .map((a) => a.operator),
    );
    if (groups.size === 1 && groups.has(quote.operator) && quote.approved)
      accepted.push(quote);
    else
      rejections.push({
        quoteId: quote.id,
        reason:
          groups.size > 1
            ? "conflicting_current_operator_ownership"
            : "bookmaker_approval_revoked_expired_or_changed",
      });
  }
  return { quotes: accepted, rejections };
}
