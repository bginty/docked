"use client";

import { rarityRule } from "@/core/card-rarity";
import type { AwardedCard } from "@/core/pack-opening";
import { rarityStyle } from "@/core/rarity-theme";
import { PackPullShare } from "./pack-pull-share";

/** One receipt-backed presentation for every pull; never performs fulfilment. */
export function PackReviewCard({
  card,
  bestPull = false,
  onView,
}: {
  card: AwardedCard;
  bestPull?: boolean;
  onView: (card: AwardedCard) => void;
}) {
  return (
    <li
      className={`pack-review-card${bestPull ? " pack-best-pull" : ""}`}
      style={rarityStyle(card.tier)}
    >
      <div className="pack-review-badge">
        <span className={`pack-position tier-${card.tier.toLowerCase()}`}>
          {card.position}
        </span>
        {bestPull && <span className="pack-best-label">Best pull</span>}
      </div>
      <div className="pack-review-details">
        <div className="pack-review-name">
          <strong title={card.name}>{card.name}</strong>
        </div>
        <span className="pack-review-team" title={card.team}>
          {card.team}
        </span>
        <div className="pack-review-metadata">
          <span>{rarityRule(card.tier).label}</span>
          <span>{card.tier === "CORE" ? "Unlimited" : `#${card.serial}`}</span>
        </div>
      </div>
      <div className="pack-summary-card-actions">
        <PackPullShare card={card} />
        <button
          type="button"
          className="pack-control secondary pack-review-view"
          aria-label={`View ${card.name}`}
          onClick={() => onView(card)}
        >
          View
        </button>
      </div>
    </li>
  );
}
