import { packProducts } from "@/core/pack-products";
export function PackProducts() {
  return (
    <section className="fantasy-section" aria-label="Single-card packs">
      <h2>Single-card packs</h2>
      <p>
        Purchases are not available yet. Collectible tiers never increase match
        points.
      </p>
      <div className="fantasy-grid">
        {packProducts.map((p) => (
          <article key={p.id} className="fantasy-card">
            <h3>{p.name}</h3>
            <strong>A${p.priceCents / 100}</strong>
            <p>
              Exactly one {p.advertisedTier} player card
              {p.inventoryTier === "RARE" ? " (RARE tier)" : ""}, randomly
              selected from a disclosed pool.
            </p>
            <p>
              {p.rankingBand.from === 1
                ? "Top 20 players"
                : "Players ranked 21–170"}{" "}
              by total Docked points in their league’s previous completed
              season. The pool is fixed for the edition.
            </p>
            <p>
              Eligible player names are not available yet. The player pool,
              available supply and selection chances will be shown before
              purchases open.
            </p>
            <button type="button" disabled>
              Not available
            </button>
          </article>
        ))}
      </div>
      <p>
        No payment is being collected. Final tax treatment and purchase terms
        will be shown before checkout becomes available.
      </p>
    </section>
  );
}
