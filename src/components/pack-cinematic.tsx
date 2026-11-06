import type { CSSProperties, RefObject } from "react";
import { fantasyAssets } from "@/brand/fantasy-assets";
import { rarityRule, type Rarity } from "@/core/card-rarity";

const effects = {
  CORE: { rarity: 540, flip: 460, sparks: 3, rings: 1 },
  RARE: { rarity: 800, flip: 500, sparks: 9, rings: 1 },
  ELITE: { rarity: 1060, flip: 540, sparks: 13, rings: 2 },
  ULTRA_RARE: { rarity: 1420, flip: 580, sparks: 18, rings: 2 },
  LEGENDARY: { rarity: 1880, flip: 620, sparks: 26, rings: 3 },
  ICON: { rarity: 2320, flip: 680, sparks: 32, rings: 3 },
} satisfies Record<
  Rarity,
  { rarity: number; flip: number; sparks: number; rings: number }
>;

export function revealTiming(tier: string) {
  rarityRule(tier);
  return effects[tier as Rarity];
}

export function PackCinematicBackdrop({ tier }: { tier: string }) {
  const { sparks, rings } = revealTiming(tier);
  const premium = tier === "LEGENDARY" || tier === "ICON";
  return (
    <div className="pack-reveal-effects" aria-hidden="true">
      <i className="pack-reveal-aura" />
      {premium && <i className="pack-reveal-rays" />}
      {Array.from({ length: rings }, (_, i) => (
        <i
          className="pack-reveal-orbit"
          key={i}
          style={{ "--orbit": i } as CSSProperties}
        />
      ))}
      {tier === "ULTRA_RARE" && (
        <svg
          className="pack-reveal-lightning"
          viewBox="0 0 420 430"
          fill="none"
        >
          <path d="m117 22 11 76-57 34 36 42-53 54 34 43-48 79m294-309-37 76 52 37-35 47 54 32-45 56 22 73" />
          <path d="m73 132-49-3-19 35m347 68 45 15 18 45M104 177l43 15m174 96-42 8" />
        </svg>
      )}
      {Array.from({ length: sparks }, (_, i) => {
        const angle = i * 2.399963;
        const radius = premium ? 125 + ((i * 31) % 114) : 78 + ((i * 31) % 96);
        return (
          <i
            className="pack-reveal-spark"
            key={i}
            style={
              {
                "--spark-x": `${Math.round(Math.cos(angle) * radius)}px`,
                "--spark-y": `${Math.round(Math.sin(angle) * radius * 1.15)}px`,
                "--spark-delay": `${i * 15}ms`,
                "--spark-size": `${2 + (i % 4)}px`,
              } as CSSProperties
            }
          />
        );
      })}
      <i className="pack-reveal-flash" />
    </div>
  );
}

export function PackCinematicBack({
  phase,
  tier,
  controlRef,
  onReveal,
  onPhaseEnd,
}: {
  phase: "mystery" | "rarity" | "flipping";
  tier?: string;
  controlRef: RefObject<HTMLButtonElement | null>;
  onReveal: () => void;
  onPhaseEnd: () => void;
}) {
  const face = (
    <span className="pack-reveal-back-face" aria-hidden="true">
      <img
        src={fantasyAssets.compact}
        width="400"
        height="100"
        alt=""
        draggable={false}
      />
      {tier ? (
        <>
          {tier === "LEGENDARY" ? (
            <svg
              className="pack-reveal-mark"
              viewBox="0 0 48 36"
              fill="currentColor"
            >
              <path d="m4 8 12 8 8-13 8 13 12-8-6 20H10Zm7 22h26v3H11Z" />
            </svg>
          ) : tier === "ICON" ? (
            <svg
              className="pack-reveal-mark"
              viewBox="0 0 48 36"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M4 11 12 3h24l8 8-20 22L4 11Zm0 0h40M12 3l5 8 7 22 7-22 5-8" />
            </svg>
          ) : (
            <span className="pack-reveal-sigil" />
          )}
          <span className="pack-reveal-tier">{rarityRule(tier).label}</span>
        </>
      ) : (
        <>
          <span className="pack-reveal-sigil" />
          <span className="pack-reveal-call">Reveal</span>
        </>
      )}
    </span>
  );

  if (phase === "mystery") {
    return (
      <button
        className="pack-reveal-object pack-mystery-trigger"
        ref={controlRef}
        aria-label="Reveal card"
        type="button"
        onClick={onReveal}
      >
        {face}
      </button>
    );
  }
  return (
    <div
      className="pack-reveal-object"
      aria-hidden="true"
      onAnimationEnd={(event) => {
        if (
          event.currentTarget === event.target &&
          event.animationName ===
            (phase === "rarity" ? "docked-reveal-charge" : "docked-reveal-flip")
        ) {
          onPhaseEnd();
        }
      }}
    >
      {face}
      {phase === "flipping" && <span className="pack-reveal-far-face" />}
    </div>
  );
}
