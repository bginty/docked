import { useState } from "react";
import { PackArtwork } from "../../src/components/pack-artwork";
import { foilArtworkVariants } from "../../src/core/foil-pack-artwork";
import PackOpening from "../../src/components/pack-opening";
import { previewPackReceipt } from "../../src/components/pack-opening-preview";
import type { PackReceipt } from "../../src/core/pack-opening";
import { rarityRule } from "../../src/core/card-rarity";

export function FoilGallery() {
  const [selected, setSelected] = useState<
    (typeof foilArtworkVariants)[number] | null
  >(null);
  const [receipt, setReceipt] = useState<PackReceipt | null>(null);
  return (
    <main className="foil-gallery">
      <h1>Docked · Complete foil collection</h1>
      <p>
        LOCAL DESIGN REVIEW · Existing catalogue · Synthetic opening results
        only
      </p>
      <a href="/fantasy/cards?view=packs&sport=nfl">View the mobile store</a>
      {["STARTER", "STANDARD", "PREMIUM"].map((tier) => (
        <section
          className="foil-gallery-family"
          data-gallery-family={tier}
          key={tier}
        >
          <h2>{tier}</h2>
          <div className="foil-gallery-grid">
            {foilArtworkVariants
              .filter((v) => v.tier === tier)
              .map((v) => (
                <article key={`${v.sport}-${v.count}`}>
                  <PackArtwork
                    name={tier}
                    sport={v.sport}
                    count={v.count}
                    core={tier === "STARTER"}
                    premium={tier === "PREMIUM"}
                  />
                  <h3>
                    {v.sport.toUpperCase()} · {v.count}{" "}
                    {v.count === 1 ? "card" : "cards"}
                  </h3>
                  <button
                    className="pack-control secondary"
                    onClick={() => {
                      setReceipt(null);
                      setSelected(v);
                    }}
                  >
                    Preview opening
                  </button>
                </article>
              ))}
          </div>
        </section>
      ))}
      {selected && (
        <PackOpening
          userId="isolated-artwork-review"
          name={`${selected.sport.toUpperCase()} ${selected.tier} ${selected.count} Pack`}
          sport={selected.sport}
          cardCount={selected.count}
          packType={
            selected.tier === "STARTER"
              ? "WEEKLY_CORE"
              : selected.tier === "PREMIUM"
                ? "PREMIUM"
                : "STANDARD"
          }
          receipt={receipt}
          onClose={() => setSelected(null)}
          ownedIds={receipt?.cards.map((c) => c.id) ?? []}
          onViewCard={() => {}}
          openPack={async () => {
            const sample = previewPackReceipt(selected.sport);
            const result = {
              ...sample,
              id: `foil-gallery-${selected.tier}-${selected.sport}-${selected.count}`,
              name: `${selected.tier} ${selected.count} Pack`,
              notice:
                "Fixed synthetic samples for artwork review, not a simulation of rarity probabilities.",
              cards: sample.cards.slice(0, selected.count).map((c) => {
                const tier =
                  selected.tier === "STARTER"
                    ? "CORE"
                    : selected.tier === "PREMIUM" &&
                        ["CORE", "RARE", "ELITE"].includes(c.tier)
                      ? "ULTRA_RARE"
                      : c.tier === "CORE"
                        ? "RARE"
                        : c.tier;
                return {
                  ...c,
                  tier,
                  max_supply: rarityRule(tier).lifetimeCap ?? 0,
                };
              }),
            };
            setReceipt(result);
            return result;
          }}
          collectionHref={`/fantasy/cards?view=packs&sport=${selected.sport}`}
        />
      )}
    </main>
  );
}
