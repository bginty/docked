"use client";
import { useEffect, useState } from "react";
import { FantasySheet } from "./fantasy-player-sheet";
import { FoilPackArtwork } from "./foil-pack-artwork";
import { previewPackReceipt } from "./pack-opening-preview";
import PackOpening from "./pack-opening";
import { fantasyAssets } from "@/brand/fantasy-assets";
import { rarityRule } from "@/core/card-rarity";

/** Local design review only; the receipt is synthetic and there is no purchase callback. */
export function FoilPackOpeningReview({
  premium,
  onClose,
}: {
  premium: boolean;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<"sealed" | "tearing" | "reveal">("sealed");
  const sport = premium ? "nrl" : "afl";
  const name = `${sport.toUpperCase()} ${premium ? "Premium" : "Standard"} 9 Pack`;
  const props = { name, premium, sport, count: 9 };
  useEffect(() => {
    if (phase !== "tearing") return;
    const delay = matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 180
      : 2300;
    const timer = setTimeout(() => setPhase("reveal"), delay);
    return () => clearTimeout(timer);
  }, [phase]);
  if (phase === "reveal") {
    const receipt = previewPackReceipt(sport);
    receipt.id = `foil-review-${sport}-${premium ? "premium" : "standard"}-nine`;
    receipt.notice =
      "Fixed sample sequence for visual review, not a simulation of pack probabilities.";
    receipt.cards = receipt.cards.map((card) => {
      const tier =
        premium && ["CORE", "RARE", "ELITE"].includes(card.tier)
          ? "ULTRA_RARE"
          : card.tier === "CORE"
            ? "RARE"
            : card.tier;
      return { ...card, tier, max_supply: rarityRule(tier).lifetimeCap ?? 0 };
    });
    // Demonstration order only. Production award order and probabilities are untouched.
    receipt.cards = [...receipt.cards].sort(
      (a, b) => Number(b.tier === "LEGENDARY") - Number(a.tier === "LEGENDARY"),
    );
    return (
      <PackOpening
        userId="local-foil-review"
        name={name}
        sport={sport}
        cardCount={9}
        packType={premium ? "PREMIUM" : "STANDARD"}
        receipt={receipt}
        preview
        replay
        onClose={onClose}
        ownedIds={[]}
        onViewCard={() => {}}
        openPack={async () => receipt}
      />
    );
  }
  return (
    <FantasySheet
      className="foil-opening-sheet"
      title={name}
      onClose={onClose}
      historyEntry
    >
      <div className={`foil-opening-scene foil-opening-${phase}`}>
        <p className="foil-opening-eyebrow">
          {phase === "sealed" ? "YOUR PACK IS READY" : "OPENING YOUR PACK"}
        </p>
        <div className="foil-open-hero">
          <div className="foil-open-light" aria-hidden="true" />
          <div className="foil-seal-top" aria-hidden="true">
            <FoilPackArtwork {...props} />
          </div>
          <div className="foil-seal-body">
            <FoilPackArtwork {...props} />
          </div>
          <div className="foil-awarded-fan" aria-hidden="true">
            {Array.from({ length: 9 }, (_, i) => (
              <div
                className="foil-fan-card"
                key={i}
                style={{ "--fan-index": i - 4 } as React.CSSProperties}
              >
                <img
                  src={fantasyAssets.compactLarge}
                  width={800}
                  height={200}
                  alt=""
                />
              </div>
            ))}
          </div>
        </div>
        <p className="foil-open-label">
          <strong>{premium ? "Premium" : "Standard"}</strong> ·{" "}
          {sport.toUpperCase()} · 9 cards
        </p>
        {phase === "sealed" ? (
          <button
            className="pack-control pack-primary foil-open-action"
            onClick={() => setPhase("tearing")}
          >
            Open pack
          </button>
        ) : (
          <button
            className="pack-control secondary foil-open-action"
            onClick={() => setPhase("reveal")}
          >
            Skip opening
          </button>
        )}
        <p className="foil-review-note">
          Design preview · Sample cards only · No credits charged
        </p>
      </div>
    </FantasySheet>
  );
}
