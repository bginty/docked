import "server-only";
import type { Sql } from "postgres";
import {
  betaTradingPolicy,
  localTrading,
  reviewedBetaTrading,
  type TradingMode,
} from "../core/beta-trading";
import { privateOfferEnabled } from "../core/private-card-offers";
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
    return row.value as TradingAccess;
  }
  if (localTrading(process.env))
    return {
      enabled: true,
      sale: true,
      // The original loopback wallet supports direct swaps independently of
      // the newer private-offer UI. Hosted trading never takes this branch.
      swap: true,
      combined: privateOfferEnabled(process.env),
      offers: privateOfferEnabled(process.env),
    };
  return disabled;
}
/** Called only inside CreditsSandboxStore's transaction/advisory lock. */
export async function assertBetaTrade(
  sql: Sql,
  mode: TradingMode | "listing",
  members: string[],
) {
  for (const member of new Set(members)) {
    const access = await betaTradingAccess(sql, member);
    if (
      !access.enabled ||
      (mode === "listing" ? !(access.sale && access.swap) : !access[mode])
    )
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
