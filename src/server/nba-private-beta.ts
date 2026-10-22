import "server-only";
import { nbaPrivateBetaEnabled } from "@/core/nba-private-beta";
import { requireIdentity } from "./auth";
import { db } from "./db";
export async function nbaBetaCapability() {
  if (!nbaPrivateBetaEnabled()) return false;
  const who = await requireIdentity();
  return db().begin(async (tx) => {
    await tx`select set_config('request.jwt.claim.sub',${who.user.id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: who.user.id, session_id: who.sessionId, aal: who.aal })},true),set_config('docked.nba_private_beta','enabled',true),set_config('docked.multi_sport','isolated-preview',true)`;
    return (
      (await tx`select sports_feed.nba_beta_capability() allowed`)[0]
        .allowed === true
    );
  });
}
