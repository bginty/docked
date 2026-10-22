import "server-only";
import type { TransactionSql } from "postgres";
import {
  sportPrivateBetaEnabled,
  betaSports,
  type BetaSport,
} from "@/core/sports-private-beta";
import { requireIdentity } from "./auth";
import { db } from "./db";
export async function setSportBetaContext(
  tx: TransactionSql,
  sport: BetaSport,
) {
  if (!sportPrivateBetaEnabled(sport)) throw Error("Sport beta unavailable");
  await tx`select set_config('docked.nba_private_beta','enabled',true),set_config('docked.multi_sport','isolated-preview',true),set_config('docked.private_beta_sport',${sport},true),set_config('docked.sports_private_beta',${process.env.DOCKED_SPORTS_PRIVATE_BETA === "true" ? "enabled" : "disabled"},true)`;
}
export async function sportsBetaCapabilities() {
  const who = await requireIdentity();
  const allowed: BetaSport[] = [];
  for (const sport of betaSports) {
    if (!sportPrivateBetaEnabled(sport)) continue;
    try {
      const ok = await db().begin(async (tx) => {
        await tx`select set_config('request.jwt.claim.sub',${who.user.id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: who.user.id, session_id: who.sessionId, aal: who.aal })},true)`;
        await setSportBetaContext(tx, sport);
        return (
          (
            await tx`select sports_feed.private_beta_sport_capability() allowed`
          )[0].allowed === true
        );
      });
      if (ok) allowed.push(sport);
    } catch {
      /* An unavailable sport must not grant access or disable NFL. */
    }
  }
  return allowed;
}
