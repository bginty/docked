"use client";
import Link from "next/link";
import { rarities, rarityRule } from "@/core/card-rarity";
import { rarityStyle } from "@/core/rarity-theme";
/** One palette and count presentation for collection filters and private profile navigation. */
export function RarityCounts({
  cards,
  sport,
  selected,
  onSelect,
}: {
  cards: readonly { sport: string; tier: string }[];
  sport: string;
  selected?: string;
  onSelect?: (tier: string) => void;
}) {
  return (
    <div className="rarity-counts" aria-label="Rarity counts in selected sport">
      {rarities.map((tier) => {
        const count = cards.filter(
          (card) => card.sport === sport && card.tier === tier,
        ).length;
        const content = (
          <>
            <span className="rarity-dot" aria-hidden="true" />
            <span>{rarityRule(tier).label}</span>
            <strong>{count}</strong>
          </>
        );
        return onSelect ? (
          <button
            key={tier}
            style={rarityStyle(tier)}
            aria-pressed={selected === tier}
            onClick={() => onSelect(selected === tier ? "" : tier)}
          >
            {content}
          </button>
        ) : (
          <Link
            key={tier}
            style={rarityStyle(tier)}
            href={`/fantasy/cards?sport=${encodeURIComponent(sport)}&rarity=${tier}`}
            aria-label={`View ${count} ${rarityRule(tier).label} cards in ${sport.toUpperCase()}`}
          >
            {content}
          </Link>
        );
      })}
    </div>
  );
}
