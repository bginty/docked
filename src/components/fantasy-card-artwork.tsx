"use client";
import { jerseyPresentation } from "@/core/card-presentation";
import type { CSSProperties } from "react";
import type { AwardedCard } from "@/core/pack-opening";
import {
  cardIdentity,
  collectibleOnly,
  multiplierLabel,
} from "@/core/card-display";
import { rarityStyle } from "@/core/rarity-theme";
import { CollectibleFace, type CollectibleVariant } from "./collectible-face";
export function FantasyCardArtwork({
  card,
  children,
  faceOnly = false,
  onInspect,
  scoringLabel,
  appliedMultiplier,
  showNumber = true,
  variant = "standard",
}: {
  card: AwardedCard;
  children?: React.ReactNode;
  faceOnly?: boolean;
  onInspect?: () => void;
  scoringLabel?: string;
  appliedMultiplier?: number;
  showNumber?: boolean;
  variant?: CollectibleVariant;
}) {
  const jersey = jerseyPresentation(card);
  return (
    <article
      className={`fantasy-card compact-card docked-collectible tier-${card.tier.toLowerCase()}`}
      style={
        {
          ...rarityStyle(card.tier),
          "--shirt": jersey.primary,
          "--shirt-accent": jersey.accent,
        } as CSSProperties
      }
    >
      <div
        className="card-face"
        role={onInspect ? "button" : undefined}
        tabIndex={onInspect ? 0 : undefined}
        onClick={onInspect}
        onKeyDown={(e) => {
          if (onInspect && ["Enter", " "].includes(e.key)) {
            e.preventDefault();
            onInspect();
          }
        }}
        aria-label={onInspect ? `View ${card.name} card details` : undefined}
      >
        <CollectibleFace
          showNumber={showNumber}
          variant={variant}
          card={card}
          appliedMultiplier={appliedMultiplier}
        />
      </div>
      {scoringLabel && (
        <span className="card-scoring-context">{scoringLabel}</span>
      )}
      {!faceOnly && !onInspect && (
        <details className="card-information">
          <summary>Card details</summary>
          <p>
            Test economy ·{" "}
            {card.season.toLowerCase().includes("lifetime")
              ? "Permanent identity"
              : `Artwork edition ${card.season}`}
          </p>
          {card.tier === "CORE" ? (
            <p className="card-serial">
              Free Core · unlimited supply
              <br />
              <small>Instance {card.id.slice(-8)}</small>
            </p>
          ) : (
            <div className="card-serial">
              #{String(card.serial).padStart(3, "0")}{" "}
              <span>/ {card.max_supply.toLocaleString()}</span>
            </div>
          )}
          <p>{multiplierLabel(card.tier)}</p>
          <p className="small-note">
            {collectibleOnly(card.position, card.sport)
              ? "Collectible only in current seven-player competitions"
              : "Eligibility depends on the competition"}
          </p>
          <details>
            <summary>Permanent card identity</summary>
            <p>{cardIdentity(card)}</p>
            <code>{card.id}</code>
          </details>
          <p className="card-status">
            {["retired", "delisted"].includes(card.status)
              ? "RETIRED / COLLECTIBLE ONLY"
              : card.status.toUpperCase()}
          </p>
          {!card.tradeable && <p className="starter-label">Not tradeable</p>}
        </details>
      )}
      {children}
    </article>
  );
}
