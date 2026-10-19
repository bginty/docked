"use client";
import Link from "next/link";
import { FantasySheet } from "./fantasy-sheet";
import { FantasyCardArtwork } from "./fantasy-card-artwork";
import { rarityStyle } from "@/core/rarity-theme";
import { rarityLabel } from "@/core/card-rarity";
import type { CompletedAcquisition } from "@/core/purchase-celebration";
import { AcquisitionShare } from "./acquisition-share";
import { IconCelebration } from "./icon-celebration";
export function PurchaseCelebration({
  receipt,
  member,
  onClose,
}: {
  receipt: CompletedAcquisition;
  member: string;
  onClose: () => void;
}) {
  const card = receipt.card;
  return (
    <FantasySheet
      title="Congratulations!"
      className="purchase-celebration"
      historyEntry
      onClose={onClose}
    >
      <div
        className={`purchase-stage purchase-${card.tier.toLowerCase()}`}
        style={rarityStyle(card.tier)}
      >
        <p className="purchase-eyebrow">YOU’VE PURCHASED A CARD</p>
        <div className="purchase-card-stage">
          {card.tier === "ICON" && <IconCelebration />}
          <div className="purchase-sparks" aria-hidden="true">
            {Array.from({ length: card.tier === "CORE" ? 8 : 24 }, (_, i) => (
              <i key={i} style={{ "--spark": i } as React.CSSProperties} />
            ))}
          </div>
          <div className="purchase-card">
            <FantasyCardArtwork card={card} faceOnly variant="reveal" />
          </div>
          <div className="purchase-podium" aria-hidden="true" />
        </div>
        <p role="status">
          <strong>{card.name}</strong> is now in your collection.
          <br />
          {rarityLabel(card.tier)} · Paid {receipt.price.toLocaleString()}{" "}
          Docked Credits
        </p>
        <div className="purchase-actions">
          <Link
            className="button"
            href={`/fantasy/cards?sport=${encodeURIComponent(card.sport ?? "nfl")}&card=${encodeURIComponent(card.id)}`}
          >
            View in My Cards
          </Link>
          <button className="button secondary" onClick={onClose}>
            Continue Browsing
          </button>
        </div>
        <AcquisitionShare
          member={member}
          reference={receipt.reference}
          cards={[card]}
        />
      </div>
    </FantasySheet>
  );
}
