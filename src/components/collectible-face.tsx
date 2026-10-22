import {
  collectiblePresentation,
  type JerseyMetadata,
} from "@/core/card-presentation";
import { rarityStyle, rarityPresentation } from "@/core/rarity-theme";
import { fantasyAssets } from "@/brand/fantasy-assets";
import { PlayerJersey } from "./player-jersey";
import { RarityBadge } from "./rarity-badge";
import { CollectibleFrame } from "./collectible-frame";

export type CollectibleIdentity = JerseyMetadata & {
  name: string;
  position: string;
  tier: string;
  serial?: number;
  max_supply?: number;
};
export type CollectibleVariant =
  "compact" | "standard" | "detailed" | "reveal" | "lineup";
/** The entire collectible. Context actions must be siblings, never children of this face. */
export function CollectibleFace({
  card,
  appliedMultiplier,
  showNumber = true,
  variant = "standard",
}: {
  card: CollectibleIdentity;
  appliedMultiplier?: number;
  showNumber?: boolean;
  variant?: CollectibleVariant;
}) {
  const p = collectiblePresentation(card);
  return (
    <span
      className={`collectible-face collectible-${variant} collectible-material-${rarityPresentation(card.tier).treatment}${p.longName ? " collectible-long-name" : ""}`}
      style={rarityStyle(card.tier)}
      data-card-design="futuristic-v1"
    >
      <span className="collectible-watermark" aria-hidden="true" />
      <CollectibleFrame />
      <span className="collectible-top">
        <span className="collectible-position">{card.position || "—"}</span>
        <RarityBadge
          tier={card.tier}
          appliedMultiplier={
            appliedMultiplier ?? (card.sport === "basketball" ? 1 : undefined)
          }
          compact
        />
      </span>
      <span className="collectible-art" aria-hidden="true">
        <PlayerJersey card={card} showNumber={showNumber} />
      </span>
      <span className="collectible-name" data-player-name={p.name}>
        {p.given && <span className="collectible-given">{p.given} </span>}
        <span className="collectible-family">{p.family}</span>
      </span>
      <span className="collectible-city">{p.location}</span>
      <span className="collectible-edition">
        <span className="collectible-serial">{p.serial}</span>
        <img
          className="collectible-brand"
          src={fantasyAssets.compact}
          width="100"
          height="28"
          alt="Docked"
          loading="lazy"
        />
      </span>
    </span>
  );
}
