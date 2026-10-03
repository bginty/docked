import {
  marketReferenceV1,
  validateMarketReferenceConfig,
  type MarketSourceObservation,
} from "../../src/core/market-reference";
import { now, rules } from "./fixtures";
export const referenceConfig = validateMarketReferenceConfig({
  ...marketReferenceV1,
  pricingBookmakers: ["pricing-a", "pricing-b"],
  availabilityBookmakers: ["market-a", "market-b", "market-c"],
});
export const referenceStart = "2026-10-02T07:00:00.000Z";
/** Authored arithmetic fixtures only; neither licensed observations nor a performance history. */
export function referenceSources(): MarketSourceObservation[] {
  return [
    ["pricing-a", "1.75", "2.15"],
    ["pricing-b", "1.75", "2.15"],
    ["market-a", "2.00", "1.85"],
    ["market-b", "2.02", "1.83"],
    ["market-c", "2.04", "1.81"],
  ].map(([bookmaker, a, b]) => ({
    id: `fictional-${bookmaker}`,
    bookmaker,
    operator: `fictional-group-${bookmaker}`,
    approved: true,
    rules: structuredClone(rules),
    prices: { "Fictional A": a, "Fictional B": b },
    sourceAt: now,
    snapshotAt: now,
    receivedAt: now,
    suspended: false,
    provider: "fictional-fixture-provider",
    sourceKind: "bookmaker",
    licensed: true,
    rightsReference: "fictional-only-no-commercial-rights",
    ownershipEvidence: "fictional-independent-groups",
    mappingVerified: true,
    feedHealthy: true,
    priceClass: "STANDARD_VERIFIED",
    classificationVersion: "fixture-v1",
    classificationEvidence: "fictional-test-standard",
    promotionFlags: [],
    provenance: "fixture",
  }));
}
export const referenceInput = () => ({
  rules: structuredClone(rules),
  startAt: referenceStart,
  observedAt: now,
  selection: "Fictional A",
  sources: referenceSources(),
  evidenceMode: "research" as const,
});
