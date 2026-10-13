import type { CSSProperties } from "react";
import type { AwardedCard } from "@/core/pack-opening";
import {
  cardIdentity,
  collectibleOnly,
  multiplierLabel,
} from "@/core/card-display";
import { rarityRule } from "@/core/card-rarity";
export function FantasyCardArtwork({
  card,
  children,
}: {
  card: AwardedCard;
  children?: React.ReactNode;
}) {
  return (
    <article
      className={`fantasy-card tier-${card.tier.toLowerCase()}`}
      style={{ "--shirt": card.colour } as CSSProperties}
    >
      <div className="card-top">
        <span>{rarityRule(card.tier).label}</span>
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
            d="M63 20Q80 43 97 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          />
        </svg>
        <b>{card.sport === "nfl" ? "D" : card.shirt}</b>
      </div>
      <p className="card-team">{card.team}</p>
      <h3>{card.name}</h3>
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
      {children}
    </article>
  );
}
