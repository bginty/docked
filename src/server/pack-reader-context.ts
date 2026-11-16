import type { TransactionSql } from "postgres";
import production from "../../config/hosted-production.json";
import {
  assertPackHostedAcceptance,
  packAcceptanceTarget,
} from "../core/pack-hosted-acceptance.mjs";
/** Truthful target context: synthetic readers never assert a Production project. */
export async function setPackReaderContext(tx: TransactionSql) {
  const acceptance = assertPackHostedAcceptance(process.env);
  await tx`select set_config('docked.fantasy_production',${acceptance ? "" : production.supabaseProjectRef!},true),set_config('docked.pack_acceptance',${acceptance ? packAcceptanceTarget.projectRef : ""},true),set_config('docked.fantasy_channel',${process.env.DOCKED_RELEASE_CHANNEL ?? "stable"},true)`;
}
