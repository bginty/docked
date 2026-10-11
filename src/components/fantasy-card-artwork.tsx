import type { CSSProperties } from "react";
import type { AwardedCard } from "@/core/pack-opening";
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
        <span>{card.tier}</span>
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
        {card.season} · {card.kind === "first_year" ? "FIRST YEAR" : "SEASON"}
      </p>
      <div className="card-serial">
        #{String(card.serial).padStart(3, "0")}{" "}
        <span>/ {card.max_supply.toLocaleString()}</span>
      </div>
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
