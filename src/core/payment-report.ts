export type PaymentRecord = {
  scope: "beta" | "live";
  at: string;
  kind: "capture" | "refund" | "chargeback" | "fee";
  currency: string;
  cents: number;
  providerId: string;
};
export function paymentTotals(
  records: PaymentRecord[],
  scope: "beta" | "live",
  start: string,
  end: string,
) {
  const seen = new Set<string>(),
    out: Record<
      string,
      {
        gross: number;
        refunds: number;
        chargebacks: number;
        fees: number;
        netReceipts: number;
      }
    > = {};
  for (const r of records) {
    if (r.scope !== scope || r.at < start || r.at >= end) continue;
    if (
      !Number.isSafeInteger(r.cents) ||
      r.cents < 0 ||
      !/^[A-Z]{3}$/.test(r.currency)
    )
      throw Error("Invalid reconciled payment record");
    const id = `${r.kind}:${r.providerId}`;
    if (seen.has(id)) throw Error("Duplicate provider posting");
    seen.add(id);
    const t = (out[r.currency] ??= {
      gross: 0,
      refunds: 0,
      chargebacks: 0,
      fees: 0,
      netReceipts: 0,
    });
    t[
      r.kind === "capture"
        ? "gross"
        : r.kind === "refund"
          ? "refunds"
          : r.kind === "chargeback"
            ? "chargebacks"
            : "fees"
    ] += r.cents;
    t.netReceipts = t.gross - t.refunds - t.chargebacks - t.fees;
  }
  return out;
}
