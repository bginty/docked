/** Trading is separate from funding/redemption. Hosted access also requires the
 * reviewed database policy and allowlist; an environment flag alone is insufficient. */
export const betaTradingPolicy = "private-beta-trading-v1";
export type TradingMode = "sale" | "swap" | "combined";
/** The deployment-wide pause covers fixture sports too, but permits cancellation
 * and pack operations. A funding flag never overrides this boundary. */
export function assertTradingWriteAvailable(
  command: unknown,
  env: Record<string, string | undefined>,
) {
  if (env.DOCKED_TEST_MARKET_READ_ONLY !== "true") return;
  const kind =
    command && typeof command === "object" && "kind" in command
      ? command.kind
      : null;
  if (
    typeof kind === "string" &&
    [
      "list",
      "replace-listing",
      "reprice-listing",
      "buy",
      "review-buy",
      "offer",
      "accept",
      "private-offer",
      "private-accept",
    ].includes(kind)
  )
    throw Error(
      "Trading is temporarily unavailable. You can still cancel listings and offers.",
    );
}
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
