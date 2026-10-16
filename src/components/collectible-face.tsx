import {
  displayCity,
  collectibleSerial,
  type JerseyMetadata,
} from "@/core/card-presentation";
import { PlayerJersey } from "./player-jersey";
import { RarityBadge } from "./rarity-badge";

export type CollectibleIdentity = JerseyMetadata & {
  name: string;
  position: string;
  tier: string;
  serial?: number;
  max_supply?: number;
};
/** One non-interactive face, also safe inside a selection button or a card link. */
export function CollectibleFace({
  card,
  appliedMultiplier,
  showNumber = false,
}: {
  card: CollectibleIdentity;
  appliedMultiplier?: number;
  showNumber?: boolean;
}) {
  return (
    <span className="collectible-face">
      <span className="collectible-top">
        <span className="collectible-position">{card.position || "—"}</span>
        <RarityBadge
          tier={card.tier}
          appliedMultiplier={appliedMultiplier}
          compact
        />
      </span>
      <span className="collectible-art" aria-hidden="true">
        <PlayerJersey card={card} showNumber={showNumber} />
      </span>
      <span className="collectible-name">{card.name}</span>
      <span className="collectible-city">{displayCity(card)}</span>
      <span className="collectible-serial">{collectibleSerial(card)}</span>
    </span>
  );
}
