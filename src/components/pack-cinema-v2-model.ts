/** Presentation only. A confirmed receipt supplies the tier and player. */
export type CinemaTier =
  "CORE" | "RARE" | "ELITE" | "ULTRA_RARE" | "LEGENDARY" | "ICON";
export type CinemaPhase = "mystery" | "rarity" | "flipping" | "revealed";

export function cinemaV2Timing(tier: string) {
  return (
    cinemaProfiles[tier as CinemaTier]?.timing ?? cinemaProfiles.CORE.timing
  );
}

export function cinemaEligible(
  sport: string | undefined,
  tier: string | undefined,
) {
  return Boolean(
    ["nfl", "afl", "nrl"].includes(sport ?? "") &&
    tier &&
    Object.hasOwn(cinemaProfiles, tier),
  );
}

/** Presentation budgets only. Never used for awards, supply or odds. Hero values
 * preserve the approved e5dec994 scene; lesser tiers share its rendering engine. */
export const cinemaProfiles = {
  CORE: {
    label: "Core",
    level: 0,
    timing: { rarity: 350, flip: 550 },
    particles: 12,
    rays: 0,
    rings: 0,
    light: 0.18,
    ringScale: 0.7,
    crystals: false,
    caption: "READY FOR YOUR LINEUP",
    arrival: "YOUR COLLECTION GROWS",
  },
  RARE: {
    label: "Rare",
    level: 1,
    timing: { rarity: 650, flip: 650 },
    particles: 35,
    rays: 5,
    rings: 1,
    light: 0.36,
    ringScale: 0.76,
    crystals: false,
    caption: "ELECTRIC POTENTIAL",
    arrival: "A RARE FIND",
  },
  ELITE: {
    label: "Elite",
    level: 2,
    timing: { rarity: 1000, flip: 750 },
    particles: 70,
    rays: 12,
    rings: 2,
    light: 0.6,
    ringScale: 0.88,
    crystals: false,
    caption: "RISE ABOVE",
    arrival: "ELITE COMPANY",
  },
  ULTRA_RARE: {
    label: "Ultra Rare",
    level: 3,
    timing: { rarity: 1500, flip: 850 },
    particles: 115,
    rays: 20,
    rings: 3,
    light: 0.82,
    ringScale: 0.96,
    crystals: true,
    caption: "SOMETHING EXTRAORDINARY",
    arrival: "AN ULTRA RARE MOMENT",
  },
  LEGENDARY: {
    label: "Legendary",
    level: 4,
    timing: { rarity: 2200, flip: 900 },
    particles: 155,
    rays: 26,
    rings: 4,
    light: 1,
    ringScale: 1,
    crystals: false,
    caption: "BUILT FOR GREATNESS",
    arrival: "A LEGEND HAS ARRIVED",
  },
  ICON: {
    label: "Icon",
    level: 5,
    timing: { rarity: 2700, flip: 1000 },
    particles: 210,
    rays: 36,
    rings: 5,
    light: 1,
    ringScale: 1,
    crystals: true,
    caption: "BEYOND EXTRAORDINARY",
    arrival: "AN ICON IS YOURS",
  },
} as const;

export const cinemaPalettes = {
  CORE: {
    main: "#9bc5e8",
    hot: "#f0f7ff",
    deep: "#476782",
    haze: "#1b3449",
    ice: "#d4eaff",
  },
  RARE: {
    main: "#278dff",
    hot: "#d4f2ff",
    deep: "#1644be",
    haze: "#172e70",
    ice: "#78d5ff",
  },
  ELITE: {
    main: "#b45eff",
    hot: "#f0d4ff",
    deep: "#6220b4",
    haze: "#391b61",
    ice: "#d1a1ff",
  },
  ULTRA_RARE: {
    main: "#ff48c8",
    hot: "#ffe2fa",
    deep: "#a51091",
    haze: "#55133f",
    ice: "#b9dfff",
  },
  LEGENDARY: {
    main: "#ffb323",
    hot: "#fff2b3",
    deep: "#c45005",
    haze: "#703b12",
    ice: "#ffe6a2",
  },
  ICON: {
    main: "#a1dfff",
    hot: "#ffffff",
    deep: "#426de3",
    haze: "#233e75",
    ice: "#f4ddaa",
  },
} as const;
