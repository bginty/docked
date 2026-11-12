import { z } from "zod";
const id = z.string().uuid();
const price = z.number().int().min(1).max(1_000_000_000);
const revision = z.number().int().min(1);
/** Fixed-price commercial commands only. No swaps, cash-out or client amounts
 * other than the seller's asking price and the buyer's reviewed-price check. */
export const commercialMarketCommand = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("list"),
      card: id,
      price,
      preference: z.literal("sell"),
    })
    .strict(),
  z
    .object({
      kind: z.literal("reprice-listing"),
      listing: id,
      price,
      expectedRevision: revision,
    })
    .strict(),
  z
    .object({
      kind: z.literal("cancel-listing"),
      listing: id,
      expectedRevision: revision.optional(),
    })
    .strict(),
  z.object({ kind: z.literal("review-buy"), listing: id }).strict(),
  z
    .object({
      kind: z.literal("buy"),
      listing: id,
      review: id,
      expectedPrice: price,
      policy: z.string().max(100),
      confirmed: z.literal(true),
    })
    .strict(),
]);
export const commercialMarketEnvelope = z
  .object({ request: id, command: commercialMarketCommand })
  .strict();
export type CommercialMarketEnvelope = z.infer<typeof commercialMarketEnvelope>;
