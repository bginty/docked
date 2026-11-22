import { z } from "zod";
import type { CommercialSport } from "./commercial-billing";

export const maximumOwnerAwardPacks = 20;
/** The transaction definitively declined before any award was committed. */
export class OwnerPackAwardRejected extends Error {}
export const ownerPackAwardReason = z.enum(["PROMOTION", "PRIZE"]);
const line = z
  .object({
    sport: z.enum(["nfl", "afl", "nrl"]),
    family: z.enum(["STANDARD", "PREMIUM"]),
    size: z.union([z.literal(1), z.literal(3), z.literal(9)]),
    quantity: z.number().int().min(1).max(maximumOwnerAwardPacks),
    configurationHash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

/** An award describes products, never customer balances, chosen cards or prices. */
export const ownerPackAwardCommand = z
  .object({
    request: z.string().uuid(),
    member: z.string().uuid(),
    reason: ownerPackAwardReason,
    reference: z
      .string()
      .trim()
      .min(3)
      .max(200)
      .regex(/^[^\x00-\x1f\x7f]+$/),
    lines: z.array(line).min(1).max(maximumOwnerAwardPacks),
    confirmed: z.literal(true),
  })
  .strict()
  .superRefine((command, context) => {
    const products = new Set<string>();
    let quantity = 0;
    for (const [index, item] of command.lines.entries()) {
      const product = `${item.sport}:${item.family}:${item.size}`;
      if (products.has(product))
        context.addIssue({
          code: "custom",
          path: ["lines", index],
          message: "Use one quantity for each pack option",
        });
      products.add(product);
      quantity += item.quantity;
    }
    if (quantity > maximumOwnerAwardPacks)
      context.addIssue({
        code: "custom",
        path: ["lines"],
        message: `Issue no more than ${maximumOwnerAwardPacks} packs at once`,
      });
  })
  .transform((command) => ({
    ...command,
    lines: [...command.lines].sort((a, b) => {
      const left = `${a.sport}:${a.family}:${a.size}`;
      const right = `${b.sport}:${b.family}:${b.size}`;
      return left < right ? -1 : left > right ? 1 : 0;
    }),
  }));

export type OwnerPackAwardCommand = z.infer<typeof ownerPackAwardCommand>;
export type OwnerPackAwardProduct = {
  id: string;
  name: string;
  sport: CommercialSport;
  family: "STANDARD" | "PREMIUM";
  size: 1 | 3 | 9;
  configurationHash: string;
  available: boolean;
};
export type OwnerPackAwardReceipt = {
  id: string;
  request: string;
  member: string;
  recipientName: string;
  actor: string;
  reason: "PROMOTION" | "PRIZE";
  reference: string;
  createdAt: string;
  packs: {
    id: string;
    sport: CommercialSport;
    family: "STANDARD" | "PREMIUM";
    size: 1 | 3 | 9;
    name: string;
  }[];
};
export type OwnerPackAwardView = {
  enabled: boolean;
  products: OwnerPackAwardProduct[];
  awards: OwnerPackAwardReceipt[];
  next: number | null;
};
