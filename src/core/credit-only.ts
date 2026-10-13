/** Additive policy for the isolated economy; never a commercial activation switch. */
export const creditOnlyVersion = "credit-only-2026-10-13-v1";
export type SwapWindow = {
  id: string;
  start: number;
  end: number;
  scope: "financial-sandbox-only";
  reason: string;
  actor: string;
  recordedAt: number;
};
export type CreditOnly = {
  version: typeof creditOnlyVersion;
  spending: "FIFO";
  unusedPurchasedWithdrawable: false;
  merchant: string;
  windows: SwapWindow[];
};
export const newCreditOnly = (): CreditOnly => ({
  version: creditOnlyVersion,
  spending: "FIFO",
  unusedPurchasedWithdrawable: false,
  merchant: "SYNTHETIC_MERCHANT",
  windows: [],
});
export function creditsFromAudCents(cents: number) {
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > 1_000_000_000)
    throw Error("Positive integer AUD cents required");
  return cents;
}
export function audEquivalent(credits: number) {
  if (!Number.isSafeInteger(credits)) throw Error("Whole credits required");
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(credits / 100);
}
export function swapFeeQuote(
  policy: CreditOnly | undefined,
  fee: number,
  now: number,
) {
  const active = policy?.windows.find((w) => w.start <= now && now < w.end);
  const next = policy?.windows
    .filter((w) => w.start > now)
    .sort((a, b) => a.start - b.start)[0];
  return {
    feeEach: active ? 0 : fee,
    free: !!active,
    window: active?.id ?? null,
    closes: active?.end ?? null,
    opens: next?.start ?? null,
    at: now,
    policy: policy?.version ?? "legacy-fixed-fee",
  };
}
