import "server-only";
import { z } from "zod";
import { publicCustomersEnabled, isPublicSport } from "@/core/public-customer";
import {
  sandboxCommand,
  sandboxRecommendation,
  type SandboxState,
} from "@/core/sport-sandbox";
import { rosterCardMetadata } from "@/core/roster-card-metadata";
import { requireIdentity } from "./auth";
import { db, rateLimit } from "./db";

const command = sandboxCommand.extend({ sport: z.enum(["nfl", "afl", "nrl"]) });
const naming = z
  .object({
    action: z.literal("name_team"),
    payload: z.object({ name: z.string().trim().min(2).max(40) }).strict(),
    request_id: z.uuid(),
  })
  .strict();
export async function publicGameplay(sport?: string | null, input?: unknown) {
  if (!publicCustomersEnabled()) throw Error("Public gameplay unavailable");
  if (sport != null && !isPublicSport(sport)) throw Error("Sport unavailable");
  const who = await requireIdentity();
  if (!(await rateLimit(`public-gameplay:${who.user.id}`, 40, 60)))
    throw Error("Please wait before retrying");
  return db().begin(async (tx) => {
    await tx`select set_config('request.jwt.claim.sub',${who.user.id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: who.user.id, session_id: who.sessionId, aal: who.aal })},true),set_config('docked.public_gameplay','enabled',true)`;
    const allowed = (await tx`select public_gameplay.capabilities() allowed`)[0]
      .allowed as string[];
    if (!sport) return { allowed };
    if (!allowed.includes(sport)) throw Error("Sport unavailable");
    const read = async () => {
      const state = (
        await tx`select public_gameplay.read_state(${sport}) state`
      )[0].state as SandboxState;
      const decorate = <T extends SandboxState["cards"][number]>(
        card: T,
      ): T => ({
        ...card,
        ...rosterCardMetadata(
          card.canonical_player_id ?? card.player_id,
          sport,
          card.team ?? "",
        ),
      });
      state.cards = state.cards.map(decorate);
      state.entries = state.entries.map((e) => ({
        ...e,
        snapshot: e.snapshot.map(decorate),
      }));
      return state;
    };
    if (input !== undefined) {
      const name = naming.safeParse(input);
      if (name.success)
        await tx`select public_gameplay.name_team(${name.data.payload.name},${name.data.request_id}::uuid)`;
      else {
        const cmd = command.parse(input);
        if (cmd.sport !== sport) throw Error("Sport context changed");
        if (cmd.action === "auto_select") {
          const state = await read();
          return {
            state,
            recommendation: sandboxRecommendation(state, cmd.competition_id),
          };
        }
        await tx`select public_gameplay.command(${sport},${cmd.action},${tx.json({ competition_id: cmd.competition_id, revision: cmd.revision, selections: cmd.selections })}::jsonb,${cmd.request_id}::uuid)`;
      }
    }
    return { state: await read() };
  });
}
