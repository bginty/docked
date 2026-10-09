import { z } from "zod";
export const communityReferenceDraftSchema = z
  .object({
    marketId: z.string().min(1).max(200),
    selection: z.string().min(1).max(150),
  })
  .strict();
export const communitySubmitSchema = communityReferenceDraftSchema
  .extend({
    reviewToken: z.string().regex(/^[a-f0-9]{64}$/),
    confirmedPermanent: z.literal(true),
    idempotencyKey: z.string().uuid(),
    reasoning: z.string().max(4000).optional(),
    personalBookmaker: z.string().trim().min(1).max(100).optional(),
    personalPrice: z
      .string()
      .regex(/^\d{1,4}(?:\.\d{1,3})?$/)
      .refine((v) => Number(v) > 1 && Number(v) <= 1000)
      .optional(),
    personalPromotional: z.boolean().optional(),
    mediaIds: z
      .array(z.string().uuid())
      .max(4)
      .refine((ids) => new Set(ids).size === ids.length, "Duplicate media")
      .optional(),
  })
  .strict();
