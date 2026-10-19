import { z } from "zod";

export const announcementActions = [
  "create",
  "save",
  "submit",
  "approve",
  "request_changes",
  "archive",
  "restore",
  "publish",
  "pin",
  "unpin",
] as const;
export const announcementMutation = z
  .object({
    requestId: z.uuid(),
    id: z.uuid(),
    action: z.enum(announcementActions),
    version: z.number().int().min(0).max(2147483646),
    title: z.string().trim().min(1).max(120),
    body: z.string().trim().min(1).max(3000),
    audience: z.literal("admitted"),
    reason: z.string().trim().min(3).max(500),
    cta: z
      .enum([
        "/fantasy/prizes",
        "/fantasy/play",
        "/fantasy/cards",
        "/fantasy/market",
        "/fantasy/results",
        "/fantasy/test-wallet?view=packs",
      ])
      .nullable()
      .optional(),
  })
  .strict();
export type AnnouncementMutation = z.infer<typeof announcementMutation>;
export type AnnouncementDraft = {
  id: string;
  title: string;
  body: string;
  audience: "admitted";
  status:
    | "draft"
    | "in_review"
    | "approved"
    | "changes_requested"
    | "archived"
    | "published";
  cta?: AnnouncementMutation["cta"];
  pinned?: boolean;
  published_at?: string | null;
  published?: { title: string; body: string; cta: string | null } | null;
  version: number;
  created_by: string;
  updated_by: string;
  last_edited_by: string;
  created_at: string;
  updated_at: string;
};
export type AnnouncementEvent = {
  action: string;
  reason: string;
  actor: string;
  created_at: string;
  version: number;
};
export type AnnouncementListing = {
  drafts: AnnouncementDraft[];
  hasMore: boolean;
  page: number;
  actor: string;
  canReview: boolean;
  canApproveOwn: boolean;
  canWrite: boolean;
};
