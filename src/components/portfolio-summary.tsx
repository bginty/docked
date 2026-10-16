import {
  portfolioValuationPolicy,
  type PortfolioValuation,
} from "@/core/portfolio-valuation";

export function PortfolioSummary({
  value,
  collectionCount,
}: {
  value: PortfolioValuation | null;
  collectionCount: number;
}) {
  const policy = value?.policy ?? portfolioValuationPolicy;
  const total = Math.max(collectionCount, value?.totalCards ?? 0);
  return (
    <section className="portfolio-summary" aria-label="Portfolio valuation">
      <div>
        <span>Estimated portfolio value</span>
        <strong>
          {value?.estimatedCredits != null
            ? `${value.estimatedCredits.toLocaleString("en-AU")} test credits`
            : value
              ? "Not enough sales yet"
              : "Estimate unavailable"}
        </strong>
        <small>
          {value
            ? `${value.valuedCards} of ${total} cards valued · ${total - value.valuedCards} unvalued`
            : "Market estimate unavailable"}
        </small>
      </div>
      <details>
        <summary>How it’s valued</summary>
        <p>
          Median completed public credit-sale price over the last {policy.days}{" "}
          days for the same player, rarity and edition. At least{" "}
          {policy.minimumSales} distinct cards, {policy.minimumBuyers} buyers
          and {policy.minimumSellers} sellers are required. Only the latest sale
          of each card counts.
        </p>
        <p>
          Unvalued cards are excluded, not worth zero. Asking prices, private
          offers and swaps are excluded. Estimates are before selling fees and
          are not guaranteed sale prices. Test Docked Credits have no cash
          value.
        </p>
        {value && (
          <p>
            Updated{" "}
            <time dateTime={new Date(value.asOf).toISOString()}>
              {new Date(value.asOf).toLocaleString("en-AU", {
                timeZone: "Australia/Sydney",
              })}{" "}
              Sydney
            </time>
            .
          </p>
        )}
      </details>
    </section>
  );
}
