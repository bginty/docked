import "server-only";
import { memberTestSource } from "./member-test-wallet";
import {
  marketQuery,
  marketplaceView,
  type MarketContext,
} from "@/core/marketplace";
export async function memberMarketplace(
  params: URLSearchParams,
  input?: unknown,
) {
  const query = marketQuery.parse(Object.fromEntries(params));
  const { s, hidden, trading, member, result, sql } =
    await memberTestSource(input);
  const [row] =
    await sql`select credits_sandbox.market_context(${member}::uuid) context`;
  const context = row.context as MarketContext & {
    labels: { id: string; label: string }[];
  };
  context.hiddenCards = hidden;
  context.tradingEnabled = trading.enabled;
  context.offersEnabled = trading.offers;
  const safeResult =
    result && typeof result === "object"
      ? Object.fromEntries(
          Object.entries(result).filter(([key]) => key !== "seller"),
        )
      : result;
  return {
    state: marketplaceView(s, member, context.labels, query, context),
    result: safeResult,
  };
}
