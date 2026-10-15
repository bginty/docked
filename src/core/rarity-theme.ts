import type { CSSProperties } from "react";
import { rarityRule, type Rarity } from "./card-rarity";
/** Presentation only. Scoring/supply stay in card-rarities-v1. */
export const rarityThemes = {
  CORE: {
    accent: "#b4c1d2",
    frame: "linear-gradient(135deg,#526071,#d3dce6 22%,#8190a3 45%,#b6c4d4 75%,#526071)",
    badge: "#536174",
    ink: "#ffffff",
    treatment: "matte",
    emblem: null,
  },
  RARE: {
    accent: "#2865ed",
    frame: "linear-gradient(135deg,#397aff,#1747cb,#326cef)",
    badge: "#1747cb",
    ink: "#ffffff",
    treatment: "solid",
    emblem: null,
  },
  ELITE: {
    accent: "#ad75ee",
    frame: "linear-gradient(135deg,#ce9dff,#8242c4,#b77cf4)",
    badge: "#7434ac",
    ink: "#ffffff",
    treatment: "double",
    emblem: null,
  },
  ULTRA_RARE: {
    accent: "#24e1ef",
    frame: "linear-gradient(135deg,#93fbff,#00bedb,#47eefa)",
    badge: "#39e6ef",
    ink: "#05202b",
    treatment: "corners",
    emblem: null,
  },
  LEGENDARY: {
    accent: "#e2bb56",
    frame:
      "linear-gradient(125deg,#8b6320 0%,#edc86d 20%,#fff0b4 35%,#ad7e25 50%,#f1d481 70%,#b58a36 100%)",
    badge: "linear-gradient(110deg,#c79b3b,#ffe9a0,#d1a645)",
    ink: "#251a05",
    treatment: "foil",
    emblem: null,
  },
  ICON: {
    accent: "#e9edf9",
    frame:
      "linear-gradient(130deg,#f9fdff 0%,#c7c9f3 18%,#f8fbff 35%,#c0eff0 52%,#f1d5eb 68%,#ffffff 84%,#d8e5f2 100%)",
    badge: "linear-gradient(110deg,#e8f5ff,#f5e7fb,#d8f7f1)",
    ink: "#18243a",
    treatment: "prism",
    emblem: "crown",
  },
} as const satisfies Record<
  Rarity,
  {
    accent: string;
    frame: string;
    badge: string;
    ink: string;
    treatment: string;
    emblem: string | null;
  }
>;
export function rarityPresentation(tier: string) {
  rarityRule(tier); // Reject unknown tiers rather than presenting them as Core.
  return rarityThemes[tier as Rarity];
}
export function rarityStyle(tier: string): CSSProperties {
  const t = rarityPresentation(tier);
  return {
    "--tier": t.accent,
    "--rarity-frame": t.frame,
    "--rarity-badge": t.badge,
    "--rarity-ink": t.ink,
  } as CSSProperties;
}
export function rarityFrame(tier: string) {
  return "rarity-frame rarity-" + rarityPresentation(tier).treatment;
}
