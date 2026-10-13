import "server-only";
import { db } from "./db";
import { requireIdentity } from "./auth";
import manifest from "../../config/hosted-production.json";
import type { results } from "@/core/scoring-engine";
export type PostgameView = {
  id: string;
  purpose: "member" | "historical-acceptance";
  revision: number;
  recordedAt: string;
  metadata: { players?: Record<string, string>; source?: string };
  view: ReturnType<typeof results>;
};
export type NflStanding = {
  competitionId: string;
  label: string;
  rows: {
    isMe?: boolean;
    name: string;
    points: number | null;
    rank: number | null;
    status: string;
  }[];
};
export async function nflStandings(): Promise<NflStanding[]> {
  if (process.env.DOCKED_BETA_STAGING !== "true")
    throw Error("Isolated beta only");
  const who = await requireIdentity();
  const rows = await db().begin(async (tx) => {
    await tx`select set_config('docked.fantasy_channel','beta',true),set_config('docked.fantasy_production',${manifest.supabaseProjectRef},true),set_config('request.jwt.claim.sub',${who.user.id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: who.user.id, session_id: who.sessionId, aal: who.aal })},true)`;
    return tx`select sports_feed.nfl_standings() records`;
  });
  return rows[0].records;
}
export async function postgameResults(): Promise<PostgameView[]> {
  if (process.env.DOCKED_BETA_STAGING !== "true")
    throw Error("Isolated beta only");
  const who = await requireIdentity();
  const output = await db().begin(async (tx) => {
    await tx`select set_config('docked.fantasy_channel','beta',true),set_config('docked.fantasy_production',${manifest.supabaseProjectRef},true),set_config('request.jwt.claim.sub',${who.user.id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: who.user.id, session_id: who.sessionId, aal: who.aal })},true)`;
    return await tx`select sports_feed.member_results() as records`;
  });
  return output[0].records;
}
