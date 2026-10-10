import "server-only";
import { db, rateLimit } from "./db";
import { requireIdentity } from "./auth";
import {
  assertFantasyEnvironment,
  fantasyAction,
  type FantasyState,
} from "@/core/fantasy";
import { setPreviewCommunityContext } from "./preview-community";
import {
  fantasyProductionEnabled,
  fantasyProductionAction,
} from "@/core/fantasy-production";
import productionManifest from "../../config/hosted-production.json";
export async function fantasyRequest(
  input?: unknown,
): Promise<{ state: FantasyState; result: Record<string, unknown> }> {
  const production = fantasyProductionEnabled();
  if (!production) assertFantasyEnvironment();
  const who = await requireIdentity();
  const command =
    input === undefined
      ? null
      : (production ? fantasyProductionAction : fantasyAction).parse(input);
  if (command && !(await rateLimit(`fantasy:${who.user.id}`, 40, 60)))
    throw Error("Rate limit");
  return (await db().begin(async (tx) => {
    if (production)
      await tx`select set_config('docked.fantasy_channel',${process.env.DOCKED_RELEASE_CHANNEL ?? "stable"},true)`;
    if (!production) await setPreviewCommunityContext(tx);
    await tx`select set_config('request.jwt.claim.sub',${who.user.id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: who.user.id, session_id: who.sessionId, aal: who.aal })},true),set_config('docked.fantasy_preview',${production ? "" : "test-credits-only"},true),set_config('docked.fantasy_production',${production ? productionManifest.supabaseProjectRef! : ""},true)`;
    const output = command
      ? production
        ? await tx`select fantasy.production_command(${command.action},${tx.json(command.payload)}::jsonb,${command.request_id}::uuid) as result`
        : await tx`select fantasy.command(${command.action},${tx.json(command.payload)}::jsonb,${command.request_id}::uuid) as result`
      : [];
    const state = production
      ? await tx`select fantasy.production_read_state() as state`
      : await tx`select fantasy.read_state() as state`;
    return {
      state: state[0].state as FantasyState,
      result: (output[0]?.result ?? {}) as Record<string, unknown>,
    };
  })) as { state: FantasyState; result: Record<string, unknown> };
}
