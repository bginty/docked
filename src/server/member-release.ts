import "server-only";
import { z } from "zod";
import { db } from "./db";
import { requireIdentity, requireRole } from "./auth";
import { setCommunityClaims } from "./community-social";
import {
  prizeCommand,
  type PrizeAdminView,
  type PrizeSchedule,
} from "@/core/prize-schedules";
const renameCommand = z
  .object({
    action: z.literal("name"),
    user: z.string().uuid(),
    name: z
      .string()
      .trim()
      .min(2)
      .max(40)
      .regex(/^[A-Za-z0-9][A-Za-z0-9 .'-]*$/),
    previous: z.string().min(2).max(40),
    reason: z.string().trim().min(1).max(500),
    confirmed: z.literal(true),
  })
  .strict();
export async function memberPrizes(): Promise<PrizeSchedule[]> {
  const who = await requireIdentity();
  return db().begin(async (tx) => {
    await setCommunityClaims(tx, who);
    return (await tx`select beta_fantasy.member_prizes() value`)[0].value;
  });
}
export async function memberReleaseAdmin(
  input?: unknown,
): Promise<PrizeAdminView> {
  const who = await requireRole(["owner", "admin"]);
  const command =
    input === undefined
      ? null
      : z
          .discriminatedUnion("action", [prizeCommand, renameCommand])
          .parse(input);
  return db().begin(async (tx) => {
    await setCommunityClaims(tx, who);
    if (command?.action === "prizes")
      await tx`select beta_fantasy.save_prize_schedule(${command.competition}::uuid,${command.scope},${tx.json(command.items)},${command.publish},${command.revision},${command.reason})`;
    if (command?.action === "name")
      await tx`select beta_fantasy.admin_name_team(${command.user}::uuid,${command.name},${command.previous},${command.reason})`;
    return (await tx`select beta_fantasy.admin_prizes() value`)[0].value;
  });
}
