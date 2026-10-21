import "server-only";
import { requireRole } from "./auth";
import { db, rateLimit } from "./db";
import {
  assertSportSandbox,
  sandboxCommand,
  sandboxRecommendation,
  type SandboxState,
} from "@/core/sport-sandbox";
export async function sportSandbox(sport: string, input?: unknown) {
  assertSportSandbox();
  const who = await requireRole(["owner", "admin"]);
  if (!["afl", "nrl", "basketball", "football"].includes(sport))
    throw Error("Unsupported sandbox sport");
  if (!(await rateLimit(`sport-sandbox:${who.user.id}`, 40, 60)))
    throw Error("Please wait before retrying");
  const cmd = input === undefined ? null : sandboxCommand.parse(input);
  if (cmd && cmd.sport !== sport) throw Error("Sport context changed");
  return await db().begin(async (tx) => {
    await tx`select set_config('request.jwt.claim.sub',${who.user.id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: who.user.id, session_id: who.sessionId, aal: who.aal })},true),set_config('docked.multi_sport','isolated-preview',true)`;
    const read = async () =>
      (await tx`select sports_feed.sport_sandbox_state(${sport}) state`)[0]
        .state as SandboxState;
    const before = await read();
    if (cmd && !before.competitions.some((c) => c.id === cmd.competition_id))
      throw Error("Competition context changed");
    if (cmd?.action === "auto_select")
      return {
        state: before,
        recommendation: sandboxRecommendation(before, cmd.competition_id),
      };
    if (cmd)
      await tx`select sports_feed.sport_sandbox_command(${cmd.action},${tx.json({ competition_id: cmd.competition_id, revision: cmd.revision, selections: cmd.selections })}::jsonb,${cmd.request_id}::uuid)`;
    return { state: cmd ? await read() : before };
  });
}
