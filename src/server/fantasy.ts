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
import { packExperienceEnabled } from "@/core/pack-experience";
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
      await tx`select set_config('docked.fantasy_channel',${process.env.DOCKED_RELEASE_CHANNEL ?? "stable"},true),set_config('docked.nfl_seven','enabled',true)`;
    if (!production) await setPreviewCommunityContext(tx);
    await tx`select set_config('request.jwt.claim.sub',${who.user.id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: who.user.id, session_id: who.sessionId, aal: who.aal })},true),set_config('docked.fantasy_preview',${production ? "" : "test-credits-only"},true),set_config('docked.fantasy_production',${production ? productionManifest.supabaseProjectRef! : ""},true)`;
    const output = command
      ? production &&
        process.env.DOCKED_BETA_STAGING === "true" &&
        command.action === "name_team"
        ? await tx`select fantasy.name_team(${command.payload.name},${command.request_id}::uuid) as result`
        : production
          ? await tx`select fantasy.production_command(${command.action},${tx.json(command.payload)}::jsonb,${command.request_id}::uuid) as result`
          : await tx`select fantasy.command(${command.action},${tx.json(command.payload)}::jsonb,${command.request_id}::uuid) as result`
      : [];
    const state = production
      ? await tx`select fantasy.production_read_state() as state`
      : await tx`select fantasy.read_state() as state`;
    const view = state[0].state as FantasyState;
    if (
      production &&
      process.env.DOCKED_BETA_STAGING === "true" &&
      view.nfl_beta
    ) {
      view.review = (
        await tx`select sports_feed.member_review_context() context`
      )[0].context;
      // One collection: retain owned historical/free cards and overlay canonical test instances.
      const collection = new Map(view.cards.map((c) => [c.id, c]));
      for (const card of view.seven?.inventory ?? []) {
        const old = collection.get(card.id);
        collection.set(card.id, {
          ...card,
          player_id: old?.player_id ?? card.player_id,
          canonical_player_id: card.canonical_player_id ?? card.player_id,
        });
      }
      view.cards = [...collection.values()];
      const observations =
        await tx`select id,team,verified_jersey_number from credits_sandbox.current_player_jerseys`;
      const numbers = new Map(observations.map((r) => [r.id, r]));
      // View metadata only; locked snapshots and saved receipts are not rewritten.
      for (const card of [...view.cards, ...(view.seven?.inventory ?? [])]) {
        const r = numbers.get(card.canonical_player_id ?? card.player_id);
        card.verifiedJerseyNumber =
          r?.team === card.team ? r.verified_jersey_number : null;
      }
    }
    if (
      production &&
      process.env.DOCKED_BETA_STAGING === "true" &&
      view.nfl_beta
    )
      view.team_name = (await tx`select fantasy.my_team_name() name`)[0].name;
    if (
      production &&
      process.env.DOCKED_BETA_STAGING === "true" &&
      view.nfl_beta &&
      packExperienceEnabled()
    )
      view.starter_receipt = (
        await tx`select fantasy.my_nfl_pack_receipt() receipt`
      )[0].receipt;
    return {
      state: view,
      result: (output[0]?.result ?? {}) as Record<string, unknown>,
    };
  })) as { state: FantasyState; result: Record<string, unknown> };
}
