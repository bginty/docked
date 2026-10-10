import "server-only";
import { requireIdentity } from "./auth";
import { db, rateLimit } from "./db";
import { fantasyProductionEnabled } from "@/core/fantasy-production";
import { sandboxSwapAction, type SwapState } from "@/core/sandbox-swaps";
import manifest from "../../config/hosted-production.json";
export async function sandboxSwaps(input?: unknown) {
  if (
    process.env.DOCKED_BETA_STAGING !== "true" ||
    process.env.DOCKED_TWO_PERSON_BETA !== "true" ||
    !fantasyProductionEnabled()
  )
    throw Error("Two-person sandbox unavailable");
  const who = await requireIdentity();
  const command = input === undefined ? null : sandboxSwapAction.parse(input);
  if (command && !(await rateLimit(`sandbox-swap:${who.user.id}`, 30, 60)))
    throw Error("Rate limit");
  return db().begin(async (tx) => {
    await tx`select set_config('docked.fantasy_channel','beta',true),set_config('docked.fantasy_production',${manifest.supabaseProjectRef!},true),set_config('docked.fantasy_preview','',true),set_config('request.jwt.claim.sub',${who.user.id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: who.user.id, session_id: who.sessionId, aal: who.aal })},true)`;
    const result = command
      ? await tx`select fantasy.swap_command(${command.action},${tx.json(command.payload)}::jsonb,${command.request_id}::uuid) result`
      : [];
    const state = await tx`select fantasy.swap_read_state() state`;
    return {
      state: state[0].state as SwapState,
      result: result[0]?.result ?? {},
    };
  });
}
