import { rarityRule } from "@/core/card-rarity";
import { rarityPresentation } from "@/core/rarity-theme";
export function RarityBadge({
  tier,
  appliedMultiplier,
  compact = false,
}: {
  tier: string;
  appliedMultiplier?: number;
  compact?: boolean;
}) {
  const rule = rarityRule(tier),
    value = appliedMultiplier ?? rule.multiplierTenths / 10;
  const context =
    appliedMultiplier === undefined
      ? "Card rarity multiplier; applied points depend on the competition rules"
      : "Applied competition multiplier";
  return (
    <span
      className={"rarity-badge" + (compact ? " rarity-badge-compact" : "")}
      title={context}
      aria-label={rule.label + ", " + value.toFixed(1) + " times. " + context}
    >
      <span className="rarity-badge-name">
        {rarityPresentation(tier).emblem === "crown" && (
          <svg
            className="rarity-crown"
            viewBox="0 0 24 18"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M2 4 7 8 12 1 17 8 22 4 19 14H5Z" fill="currentColor" />
            <path d="M5 17H19" stroke="currentColor" strokeWidth="2" />
          </svg>
        )}
        {rule.label.toUpperCase()}
      </span>
      <span className="rarity-badge-value">{value.toFixed(1)}×</span>
    </span>
  );
}
