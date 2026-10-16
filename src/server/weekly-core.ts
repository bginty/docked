import "server-only";
import { z } from "zod";
import { requireIdentity } from "./auth";
import { db, rateLimit } from "./db";
import productionManifest from "../../config/hosted-production.json";
import type { WeeklyCoreView } from "@/core/weekly-core";
import type { PackReceipt } from "@/core/pack-opening";
export async function weeklyCore(input?: unknown) {
  const who = await requireIdentity();
  if (
    process.env.DOCKED_WEEKLY_CORE_ENABLED !== "true" ||
    process.env.DOCKED_BETA_STAGING !== "true"
  )
    return {
      state: {
        enabled: false,
        serverTime: Date.now(),
        packs: [],
      } as WeeklyCoreView,
      receipt: null,
    };
  const command =
    input === undefined
      ? null
      : z
          .object({ pack: z.string().uuid(), request: z.string().uuid() })
          .strict()
          .parse(input);
  if (!(await rateLimit(`weekly-core:${who.user.id}`, 60, 60)))
    throw Error("Please wait before checking again");
  return db().begin(async (tx) => {
    await tx`select set_config('request.jwt.claim.sub',${who.user.id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: who.user.id, session_id: who.sessionId, aal: who.aal })},true),set_config('docked.fantasy_production',${productionManifest.supabaseProjectRef!},true),set_config('docked.fantasy_channel',${process.env.DOCKED_RELEASE_CHANNEL ?? "stable"},true)`;
    const receipt: PackReceipt | null = command
      ? (
          await tx`select sports_feed.open_weekly_core(${command.pack}::uuid,${command.request}::uuid) receipt`
        )[0].receipt
      : null;
    const state: WeeklyCoreView = (
      await tx`select sports_feed.my_weekly_core() state`
    )[0].state;
    return { state, receipt };
  });
}
