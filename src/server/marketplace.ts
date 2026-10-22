import "server-only";
import { memberTestSource } from "./member-test-wallet";
import { setCommunityClaims } from "./community-social";
import { isFixtureSport } from "@/core/fixture-sports";
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
  const { s, hidden, trading, member, result, sql, who, fixtureSports } =
    await memberTestSource(input);
  if (isFixtureSport(query.sport) && !fixtureSports.includes(query.sport))
    throw Error("Sport test marketplace unavailable");
  const row = await sql.begin(async (tx) => {
    await setCommunityClaims(tx, who);
    const [value] =
      await tx`select credits_sandbox.market_context(${member}::uuid) context`;
    return value;
  });
  const context = row.context as MarketContext & {
    labels: { id: string; label: string }[];
  };
  context.hiddenCards = hidden;
  const fixtureEnabled =
    isFixtureSport(query.sport) && fixtureSports.includes(query.sport);
  context.tradingEnabled = fixtureEnabled || trading.enabled;
  context.offersEnabled = fixtureEnabled;
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
