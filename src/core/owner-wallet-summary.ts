import { financialReport, type CreditsState } from "./credits-sandbox";

/** Sanitised projection of the existing ledger; never a second balance store. */
export function ownerWalletSummary(state: CreditsState, at = Date.now()) {
  if (state.mode !== "financial-sandbox-only" || state.policy.liveEnabled)
    throw Error("Test reporting scope required");
  const report = financialReport(state);
  return {
    ...report.circulation,
    reserved: report.balances.reduce((sum, b) => sum + b.reserved, 0),
    pending: report.balances.reduce((sum, b) => sum + b.pending, 0),
    spendable: report.balances.reduce((sum, b) => sum + b.spendable, 0),
    categories: report.categories,
    packSpend: report.packRevenue,
    fees: report.commission + report.swapFees,
    marketplaceVolume: report.marketplaceVolume,
    unbalancedTransactions: report.unbalancedTransactions.length,
    listings: Object.values(state.listings).filter(
      (x) => x.status === "OPEN" && !x.privateOffer,
    ).length,
    pendingOffers: Object.values(state.privateCardOffers ?? {}).filter(
      (x) => x.status === "OPEN" && x.expires > at,
    ).length,
    actualCashReceipts: null,
  };
}
export type OwnerWalletSummary = ReturnType<typeof ownerWalletSummary>;
