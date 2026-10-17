import "server-only";
import { db } from "./db";
import { requireIdentity } from "./auth";
import manifest from "../../config/hosted-production.json";
import {
  playerHistory,
  type PlayerHistorySource,
} from "@/core/player-card-history";
export async function cardPlayerHistory(player: string, season?: string) {
  const who = await requireIdentity();
  if (process.env.DOCKED_BETA_STAGING !== "true") throw Error("Unavailable");
  const rows = await db().begin(async (tx) => {
    await tx`select set_config('docked.fantasy_channel','beta',true),set_config('docked.fantasy_production',${manifest.supabaseProjectRef},true),set_config('request.jwt.claim.sub',${who.user.id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: who.user.id, session_id: who.sessionId, aal: who.aal })},true)`;
    return tx`select sports_feed.card_player_history(${player}) records`;
  });
  return playerHistory(rows[0].records as PlayerHistorySource[], season);
}
