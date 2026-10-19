import "server-only";
import type { Sql } from "postgres";
import {
  betaTradingPolicy,
  localTrading,
  reviewedBetaTrading,
  type TradingMode,
} from "../core/beta-trading";
import { CreditsRejected } from "./credits-sandbox-store";
import { setCommunityClaims } from "./community-social";

export type TradingAccess = {
  enabled: boolean;
  offers: boolean;
  sale: boolean;
  swap: boolean;
  combined: boolean;
};
const disabled: TradingAccess = {
  enabled: false,
  offers: false,
  sale: false,
  swap: false,
  combined: false,
};
export async function betaTradingAccess(
  sql: Sql,
  member: string,
): Promise<TradingAccess> {
  if (process.env.DOCKED_TEST_MARKET_READ_ONLY === "true") return disabled;
  if (reviewedBetaTrading(process.env)) {
    if (process.env.DOCKED_TEST_MARKET_READ_ONLY !== "false") return disabled;
    const [row] =
      await sql`select credits_sandbox.trading_access(${member}::uuid,${betaTradingPolicy}) value`;
    return {
      ...row.value,
      offers: false,
      swap: false,
      combined: false,
    } as TradingAccess;
  }
  if (localTrading(process.env))
    return {
      enabled: true,
      sale: true,
      // Retired modes remain disabled in local acceptance too.
      swap: false,
      combined: false,
      offers: false,
    };
  return disabled;
}
/** Called only inside CreditsSandboxStore's transaction/advisory lock. */
export async function assertBetaTrade(
  sql: Sql,
  mode: TradingMode | "listing",
  members: string[],
) {
  if (mode !== "sale")
    throw new CreditsRejected("Only fixed-price credit sales are supported.");
  for (const member of new Set(members)) {
    const access = await betaTradingAccess(sql, member);
    if (!access.enabled || !access.sale)
      throw new CreditsRejected(
        "Trading is temporarily unavailable. You can still cancel listings and offers.",
      );
  }
}
export async function recordTradingFailure(
  sql: Sql,
  who: Parameters<typeof setCommunityClaims>[1],
  request: string,
  error: unknown,
) {
  if (!reviewedBetaTrading(process.env)) return;
  try {
    await sql.begin(async (tx) => {
      await setCommunityClaims(tx, who);
      const note =
        error instanceof CreditsRejected
          ? "Rejected trading request"
          : "Trading outcome unknown; reconcile request";
      await tx`select credits_sandbox.trading_record(${request}::uuid,'failure',${note})`;
    });
  } catch {
    // A telemetry failure must never replace an uncertain settlement result.
    console.error("Marketplace failure audit unavailable");
  }
}
