/** All monetary arithmetic is in integer cents/credits. No floating point conversion. */
export const redemptionRate = {
  version: "AUD-cent-per-credit-v1",
  credits: 1,
  audCents: 1,
} as const;
export function audToCredits(value: string) {
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(value.trim()))
    throw Error("Enter a positive AUD amount with up to two decimal places.");
  const [whole, fraction = ""] = value.trim().split(".");
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (cents < 1n || cents > 1_000_000_000n)
    throw Error("Amount is outside the supported whole-credit range.");
  return Number(cents);
}
export function formatAud(cents: number) {
  if (!Number.isSafeInteger(cents) || cents < 0)
    throw Error("Integer AUD cents required");
  return `$${(BigInt(cents) / 100n).toLocaleString("en-AU")}.${String(BigInt(cents) % 100n).padStart(2, "0")} AUD`;
}
export const redemptionLabels: Record<string, string> = {
  NOT_STARTED: "Not started",
  SUBMITTED: "Evidence submitted",
  UNDER_REVIEW: "Under review",
  MORE_INFORMATION: "More information required",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
  REVOKED: "Approval revoked",
  REQUESTED: "Requested",
  APPROVED: "Approved",
  PAYMENT_IN_PROGRESS: "Payment in progress",
  SENT: "EFT sent",
  CANCELLED: "Cancelled",
  EXCEPTION: "Reconciliation required",
  RETURNED: "EFT returned",
};
