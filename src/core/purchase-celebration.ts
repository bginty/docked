import type { AwardedCard } from "./pack-opening";
import { rarities } from "./card-rarity";
export type CompletedAcquisition = {
  reference: string;
  listing: string;
  price: number;
  card: AwardedCard;
};
/** The successful command response carries the atomic settlement's immutable receipt.
 * A review/request acknowledgement or client-selected card is never sufficient. */
export function completedAcquisition(
  result: Record<string, unknown>,
  command: Record<string, unknown>,
): CompletedAcquisition | null {
  if (command.kind !== "buy" || result.listing !== command.listing) return null;
  const r = result.receipt as
    | {
        reference?: unknown;
        cardSnapshot?: AwardedCard;
        price?: unknown;
        at?: unknown;
      }
    | undefined;
  const c = r?.cardSnapshot;
  if (
    !r ||
    typeof r.reference !== "string" ||
    !r.reference ||
    typeof r.at !== "number" ||
    !c ||
    c.id !== result.card ||
    typeof c.name !== "string" ||
    !rarities.includes(c.tier as (typeof rarities)[number]) ||
    !Number.isSafeInteger(r.price) ||
    Number(r.price) < 1 ||
    r.price !== result.price
  )
    return null;
  return {
    reference: r.reference,
    listing: String(result.listing),
    price: Number(r.price),
    card: c,
  };
}
