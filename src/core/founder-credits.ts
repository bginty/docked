import { z } from "zod";
/** Existing free-credit campaign limit. No backing, redemption or cash event. */
export const founderCreditCampaign = "founder-private-beta-credits-20261115";
export const founderCreditIssue = z
  .object({
    request: z.string().uuid(),
    member: z.string().uuid(),
    amount: z.number().int().min(1).max(100000),
    reason: z.string().trim().min(10).max(500),
    confirmed: z.literal(true),
  })
  .strict();
export function founderCreditCommand(
  input: z.infer<typeof founderCreditIssue>,
) {
  return {
    kind: "promotion" as const,
    member: input.member,
    amount: input.amount,
    campaign: founderCreditCampaign,
    reason: input.reason,
    confirmed: true as const,
    redeemable: false,
  };
}
