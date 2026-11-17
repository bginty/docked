import { z } from "zod";

export const publicOwnerSections = new Set([
  "users",
  "cards",
  "packs",
  "payments",
  "settings",
  "analytics",
]);
export const ownerSupportCommand = z
  .object({
    request: z.string().uuid(),
    action: z.enum([
      "note",
      "restrict_customer",
      "restore_customer",
      "emergency_pause",
    ]),
    target: z.string().uuid().nullable(),
    reason: z.string().trim().min(12).max(600),
    expectedDisabledAt: z.string().datetime({ offset: true }).nullable(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if ((v.action === "emergency_pause") !== (v.target === null))
      ctx.addIssue({ code: "custom", message: "Invalid command target" });
  });
