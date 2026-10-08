import { z } from "zod";
import manifest from "../../config/hosted-production.json";
import { assertHostedProduction } from "./hosted-production.mjs";
import { fantasyEnabled, fantasyAction } from "./fantasy";

export function fantasyProductionEnabled(
  env: Record<string, string | undefined> = process.env,
  reviewedManifest: Parameters<typeof assertHostedProduction>[1] = manifest,
) {
  if (
    env.FANTASY_FREE_PLAY_PRODUCTION !== "true" ||
    env.FANTASY_CARDS_PREVIEW === "true" ||
    env.APP_ENV !== "production"
  )
    return false;
  try {
    assertHostedProduction(env, reviewedManifest);
    return true;
  } catch {
    return false;
  }
}
export function fantasyPlatformEnabled(
  env: Record<string, string | undefined> = process.env,
) {
  return fantasyEnabled(env) || fantasyProductionEnabled(env);
}
const allowed = new Set([
  "claim_starter",
  "open_pack",
  "save_lineup",
  "admin_stats",
  "admin_simulate",
]);
export const fantasyProductionAction = z.union([
  z
    .object({
      action: z.literal("admin_starter_stock"),
      payload: z
        .object({ quantity: z.number().int().min(1).max(1000) })
        .strict(),
      request_id: z.uuid(),
    })
    .strict(),
  z
    .object({
      action: z.literal("admin_free_round"),
      payload: z
        .object({
          name: z.string().min(2).max(80),
          season: z.string().min(1).max(20),
          round: z.number().int().min(1).max(1000),
          locks_at: z.iso.datetime(),
        })
        .strict(),
      request_id: z.uuid(),
    })
    .strict(),
  fantasyAction.refine(
    (v) => allowed.has(v.action),
    "Action unavailable in free play",
  ),
  z
    .object({
      action: z.literal("claim_daily"),
      payload: z.object({}).strict(),
      request_id: z.uuid(),
    })
    .strict(),
  z
    .object({
      action: z.literal("admin_reward_policy"),
      payload: z
        .object({
          daily_points: z.number().int().min(1).max(50),
          card_every: z.number().int().min(7).max(365),
          daily_card_limit: z.number().int().min(0).max(100),
        })
        .strict(),
      request_id: z.uuid(),
    })
    .strict(),
]);
