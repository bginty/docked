import { z } from "zod";

// This is a review record, never a command accepted by the credit ledger.
// Bounds match the existing credit command's technical input bounds; they are
// not a discretionary funding limit or an approved campaign policy.
export const betaCreditRequestMutation = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("request"),
      requestId: z.uuid(),
      recipient: z.uuid(),
      amount: z.number().int().positive().max(1_000_000_000),
      reason: z.string().trim().min(12).max(600),
      confirmed: z.literal(true),
    })
    .strict(),
  z
    .object({
      action: z.enum(["approve", "decline", "cancel"]),
      requestId: z.uuid(),
      id: z.uuid(),
      revision: z.number().int().positive(),
      reason: z.string().trim().min(12).max(600),
      confirmed: z.literal(true),
    })
    .strict(),
]);
export type BetaCreditRequestMutation = z.infer<
  typeof betaCreditRequestMutation
>;
export type BetaCreditRequest = {
  id: string;
  recipient: string;
  recipientName: string;
  amount: number;
  reason: string;
  status: "requested" | "approved" | "declined" | "cancelled";
  revision: number;
  created_at: string;
  updated_at: string;
  requested_by: string;
  policy_context: string;
  history: {
    id: string;
    actor: string;
    action: string;
    reason: string;
    created_at: string;
  }[];
};
export type BetaCreditRequestListing = {
  requests: BetaCreditRequest[];
  recipients: { id: string; name: string; handle: string | null }[];
  page: number;
  hasMore: boolean;
  executionEnabled: false;
};
export const betaCreditRequestStatus = {
  requested: "Awaiting request review — credits not issued",
  approved: "Request approved — credits not issued",
  declined: "Request declined — credits not issued",
  cancelled: "Request cancelled — credits not issued",
} as const;
