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
            <p>Exactly one {p.advertisedTier} player card.</p>
            <p>
              Sport and eligible player pool: not available. Selection method
              and supply will be shown before purchases open.
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
