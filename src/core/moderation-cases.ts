import { z } from "zod";
export const moderationCaseMutation = z
  .object({
    requestId: z.uuid(),
    reportId: z.uuid(),
    version: z.number().int().min(0).max(2147483646),
  action: z.enum(["update", "hide", "restore", "review_hold"]),
    assignee: z.uuid().nullable(),
    severity: z.enum(["untriaged", "low", "medium", "high", "urgent"]),
    status: z.enum(["triage", "investigating", "escalated", "resolved"]),
    resolution: z.enum(["pending", "no_action", "action_taken"]),
    reason: z.string().trim().min(12).max(1000),
  })
  .strict();
export type ModerationCaseMutation = z.infer<typeof moderationCaseMutation>;
export type ModerationCase = {
  report_id: string;
  assignee: string | null;
  severity: ModerationCaseMutation["severity"];
  status: ModerationCaseMutation["status"];
  resolution: ModerationCaseMutation["resolution"];
  version: number;
  content_hold: boolean;
  review_due_at: string | null;
  updated_at: string;
};
export type ModerationCaseView = {
  case: ModerationCase | null;
  actor: string;
  canWrite: boolean;
  canAssign: boolean;
  targetType: string;
  targetStatus: string | null;
  reportStatus: string;
  staff: { id: string; name: string }[];
  events: {
    version: number;
    action: string;
    actor: string;
    reason: string;
    created_at: string;
  }[];
};
