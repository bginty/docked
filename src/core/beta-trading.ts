/** Trading is separate from funding/redemption. Hosted access also requires the
 * reviewed database policy and allowlist; an environment flag alone is insufficient. */
export const betaTradingPolicy = "private-beta-trading-v1";
export type TradingMode = "sale" | "swap" | "combined";
export function reviewedBetaTrading(env: Record<string, string | undefined>) {
  return (
    env.DOCKED_BETA_TRADING === betaTradingPolicy &&
    env.DOCKED_FRIENDS_BETA === "true" &&
    env.DOCKED_BETA_STAGING === "true"
  );
}
export function localTrading(env: Record<string, string | undefined>) {
  if (env.VERCEL || env.NODE_ENV === "production") return false;
  try {
    return ["127.0.0.1", "localhost", "[::1]"].includes(
      new URL(env.DATABASE_URL ?? "").hostname,
    );
  } catch {
    return false;
  }
}
export function tradingCommandMode(command: {
  kind: string;
  preference?: string;
  price?: number;
  offeredCards?: unknown[];
}): TradingMode | "listing" | null {
  if (["list", "replace-listing", "reprice-listing"].includes(command.kind))
    return command.preference === "both"
      ? "listing"
      : command.preference === "swap"
        ? "swap"
        : "sale";
  if (["buy", "review-buy"].includes(command.kind)) return "sale";
  if (["offer", "accept"].includes(command.kind)) return "swap";
  if (command.kind === "private-offer")
    return command.offeredCards?.length
      ? command.price
        ? "combined"
        : "swap"
      : "sale";
  return null;
}
