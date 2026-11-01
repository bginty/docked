import draft from "../../config/store-credit-package-drafts.json";
import { paidPackOffers, paidPackWeights } from "./paid-pack-catalogue";
import { digest } from "./scoring-engine";
export type BillingEnvironment = "commercial" | "acceptance";
export type CommercialProduct = {
  id: string;
  credits: number;
  audCents: number;
  version: string;
};
export const commercialProducts: CommercialProduct[] = draft.products.map(
  (p) => ({
    id: p.id,
    credits: p.credits,
    audCents: p.priceCents,
    version: draft.version,
  }),
);
export const commercialPolicyVersion = "commercial-closed-loop-2026-11-01-v1";
export const commercialSports = ["nfl", "afl", "nrl"] as const;
export type CommercialSport = (typeof commercialSports)[number];
export type CommercialReceipt = {
  key: string;
  account: string;
  environment: BillingEnvironment;
  product: CommercialProduct;
  state: "PENDING" | "PURCHASED" | "CANCELLED" | "REVOKED" | "REVIEW";
  consumed: boolean;
  reviewReason?: "account-unavailable";
  paid: boolean;
  orderId: string | null;
  grossCents: number | null;
  taxCents: number | null;
  refundedCents: number;
  providerAt: string | null;
};
export function integer(value: unknown): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0)
    throw Error("Invalid accounting integer");
  return n;
}
export function commercialPack(
  sport: CommercialSport,
  family: "STANDARD" | "PREMIUM",
  size: 1 | 3 | 9,
) {
  if (!commercialSports.includes(sport)) throw Error("Sport unavailable");
  const offer = paidPackOffers.find(
    (p) => p.type === family && p.cards === size,
  );
  if (!offer) throw Error("Pack unavailable");
  const pack = {
    ...offer,
    id: `${sport}:${offer.id}`,
    sport,
    version: offer.id,
    weights: paidPackWeights[family],
    guaranteedSlots: {},
    exhaustion: "FAIL_ENTIRE_PACK",
    duplicatePlayers: "deny",
  };
  return { ...pack, configurationHash: digest(pack) };
}
export function assertCommercialApproval(
  c: {
    environment: BillingEnvironment;
    policy_version: string;
    approvals: Record<string, unknown>;
  },
  environment: BillingEnvironment,
) {
  if (
    c.environment !== environment ||
    c.policy_version !== commercialPolicyVersion
  )
    throw Error("Billing environment or policy mismatch");
  const expiry = Date.parse(String(c.approvals.validUntil ?? ""));
  if (!Number.isFinite(expiry) || expiry <= Date.now())
    throw Error("Commercial approval expired or pending");
  for (const key of [
    "owner",
    "legal",
    "googlePlay",
    "privacy",
    "retention",
    "refundRecovery",
    "playerRights",
    "supplyReconciliation",
  ])
    if (
      typeof c.approvals[key] !== "string" ||
      String(c.approvals[key]).length < 8
    )
      throw Error("Commercial approval pending");
  if (
    c.approvals.withdrawals !== false ||
    c.approvals.prizes !== false ||
    c.approvals.paidEntry !== false ||
    c.approvals.nba !== false
  )
    throw Error("Unsupported commercial launch scope");
}
