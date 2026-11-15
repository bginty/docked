import type { NinePackProduct } from "./card-economy";
import { fixtureSports } from "./fixture-sports";
import { paidPackOffers, paidPackWeights } from "./paid-pack-catalogue";

/** New immutable offers; previous receipts/configurations remain untouched. */
export function founderCreditProducts(): NinePackProduct[] {
  return (["nfl", "afl", "nrl"] as const).flatMap((sport) =>
    paidPackOffers.map((offer) => {
      const id = `${offer.type.toLowerCase()}-${offer.cards}-${sport}-founder-credits-v1`;
      return {
        id,
        version: id,
        cataloguePolicy: "founder-credit-season-v1",
        type: offer.type,
        name: offer.name,
        cards: offer.cards,
        priceCredits: offer.priceCredits,
        sport,
        positions:
          sport === "nfl"
            ? ["QB", "RB", "WR", "TE"]
            : [...fixtureSports[sport].positions],
        ...(sport === "nfl"
          ? {}
          : { inventoryScope: "real-roster-beta-v1" as const }),
        weights: { ...paidPackWeights[offer.type] },
        guaranteedSlots: {},
        duplicatePlayers: "deny",
        status: "TEST_ONLY",
        effectiveAt: Date.UTC(2026, 10, 15),
        expiresAt: null,
        freshnessHours: 72,
        exhaustion: "FAIL_ENTIRE_PACK",
      };
    }),
  );
}
