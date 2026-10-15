"use client";
import { jerseyPresentation, fullTeamName } from "@/core/card-presentation";
import type { CSSProperties } from "react";
import type { AwardedCard } from "@/core/pack-opening";
import {
  cardIdentity,
  collectibleOnly,
  multiplierLabel,
} from "@/core/card-display";
import { rarityFrame, rarityStyle } from "@/core/rarity-theme";
import { RarityBadge } from "./rarity-badge";
export function FantasyCardArtwork({
  card,
  children,
  faceOnly = false,
  onInspect,
  scoringLabel,
  appliedMultiplier,
}: {
  card: AwardedCard;
  children?: React.ReactNode;
  faceOnly?: boolean;
  onInspect?: () => void;
  scoringLabel?: string;
  appliedMultiplier?: number;
}) {
  const jersey = jerseyPresentation(card);
  return (
    <article
      className={`fantasy-card compact-card tier-${card.tier.toLowerCase()} ${rarityFrame(card.tier)}`}
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
        <div className="card-top">
          <RarityBadge tier={card.tier} appliedMultiplier={appliedMultiplier} />
          <span>{card.position}</span>
        </div>
        <div className="card-shirt" aria-hidden="true">
          <svg viewBox="0 0 160 150">
            <path
              d="M49 10 12 31 29 65 44 57 44 138 116 138 116 57 131 65 148 31 111 10 97 20 63 20Z"
              fill="var(--shirt)"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M16 33 31 57 M129 57 144 33 M49 115 H111"
              stroke="var(--shirt-accent)"
              strokeWidth="8"
              fill="none"
            />
            <path
              d="M63 20Q80 43 97 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
            />
          </svg>
        </div>
        <h3>{card.name}</h3>
        <p className="card-team">{fullTeamName(card)}</p>
        {scoringLabel && (
          <span className="card-scoring-context">{scoringLabel}</span>
        )}
      </div>
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
