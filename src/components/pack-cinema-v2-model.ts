/** Presentation only. A confirmed receipt supplies the tier and player. */
export type CinemaTier = "LEGENDARY" | "ICON";
export type CinemaPhase = "mystery" | "rarity" | "flipping" | "revealed";

export function cinemaV2Timing(tier: string) {
  return tier === "ICON"
    ? { rarity: 2700, flip: 1000 }
    : { rarity: 2200, flip: 900 };
}

export function cinemaV2Eligible(
  preview: boolean | undefined,
  requested: boolean | undefined,
  sport: string | undefined,
  tier: string | undefined,
) {
  return Boolean(
    preview &&
    requested &&
    ["nfl", "afl", "nrl"].includes(sport ?? "") &&
    (tier === "LEGENDARY" || tier === "ICON"),
  );
}

export const cinemaPalettes = {
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
