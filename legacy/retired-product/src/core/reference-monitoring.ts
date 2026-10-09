import Decimal from "decimal.js";
import type { MarketReference } from "./market-reference";
import { binaryPrice } from "./pricing";

/** Observe a fixed publication without refitting its probability or accounting price. */
export function referenceMonitoringPrice(input: {
  pricingModel: "market_reference_v1" | "football_independent_v1";
  publicationProbability: string;
  reference: MarketReference | null;
  minEV: string;
  tick: string;
  maxOdds: string;
  maxEV: string;
}) {
  const independent = input.pricingModel === "football_independent_v1",
    r = input.reference;
  if (!r || (!independent && !r.pricing)) return null;
  try {
    const price = binaryPrice(
      input.publicationProbability,
      r.decimalPrice,
      input.minEV,
      input.tick,
    );
    if (
      independent &&
      (new Decimal(r.decimalPrice).gt(input.maxOdds) ||
        new Decimal(price.ev).gt(input.maxEV))
    )
      return null;
    return {
      price,
      probability: independent
        ? input.publicationProbability
        : r.pricing!.probability,
      // Captured model p is not a closing-market estimate. No constant-p CLV is recorded.
      closingProbability: independent ? null : r.pricing!.probability,
    };
  } catch {
    return null;
  }
}
