import { z } from "zod";
const id = z.string().uuid();
export const sandboxSwapAction = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("offer"),
      request_id: id,
      payload: z
        .object({
          give_card: id,
          take_card: id,
          fee_cents: z.union([z.literal(0), z.literal(250)]),
          policy_revision: z.number().int().positive(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      action: z.literal("accept"),
      request_id: id,
      payload: z
        .object({
          swap_id: id,
          fee_cents: z.union([z.literal(0), z.literal(250)]),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      action: z.enum(["reject", "cancel"]),
      request_id: id,
      payload: z.object({ swap_id: id }).strict(),
    })
    .strict(),
  z
    .object({
      action: z.literal("fee_mode"),
      request_id: id,
      payload: z
        .object({ mode: z.enum(["scheduled", "free", "paid"]) })
        .strict(),
    })
    .strict(),
  z
    .object({
      action: z.enum(["practice_credit", "reserve_pack"]),
      request_id: id,
      payload: z.object({}).strict(),
    })
    .strict(),
]);
export type SwapCard = {
  id: string;
  owner_id: string;
  name: string;
  position: string;
  serial: number;
  rarity: string;
  in_lineup: boolean;
  unopened: boolean;
};
export type SwapState = {
  mode: "TWO_PERSON_SIMULATED" | "FRIENDS_CARD_SWAP";
  user_id: string;
  peer_id: string;
  owner: boolean;
  balance_cents: number;
  credited: boolean;
  reserves_granted: boolean;
  window: {
    free: boolean;
    fee_cents: number;
    revision: number;
    expires_at: string;
    next_boundary: string;
    server_time: string;
    override_mode: string;
  };
  cards: SwapCard[];
  swaps: {
    id: string;
    sender: string;
    recipient: string;
    give_card: string;
    take_card: string;
    state: string;
    fee_cents: number;
    expires_at: string;
    created_at: string;
  }[];
  ledger: {
    kind: string;
    amount_cents: number;
    reference: string;
    created_at: string;
  }[];
  ownership_history: {
    card_id: string;
    from_user: string;
    to_user: string;
    reference: string;
    created_at: string;
  }[];
};
