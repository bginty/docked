import { z } from "zod";
export const moderationRetentionMutation = z
  .object({
    requestId: z.uuid(),
    targetType: z.enum(["post", "comment", "media"]),
    targetId: z.uuid(),
    version: z.number().int().min(1).max(2147483646),
    action: z.enum(["review", "restore", "erase"]),
    reason: z.string().trim().min(12).max(1000),
    confirmation: z.string().max(10),
  })
  .strict()
  .refine(
    (value) => value.action !== "erase" || value.confirmation === "ERASE",
    { message: "Type ERASE to confirm" },
  );
export type RetentionRecord = {
  target_type: "post" | "comment" | "media";
  target_id: string;
  state: "held" | "restored" | "erased";
  version: number;
  reason: string;
  actor: string;
  review_due_at: string | null;
  updated_at: string;
  policy_version: string;
};
export type RetentionView = {
  records: RetentionRecord[];
  hasMore: boolean;
  page: number;
  canManage: boolean;
};
