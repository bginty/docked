import suppliedTokens from "./brand-tokens.json";

/** Approved Edge Signal identity; the supplied pack is archived unchanged. */
export const brand = suppliedTokens;
export const brandAssets = {
  wordmark: "/brand/logos/docked-primary.png",
  wordmarkOnDark: "/brand/logos/docked-primary-on-dark.png",
  wordmarkWhite: "/brand/logos/docked-primary-white.png",
  mark: "/brand/logos/docked-mark.png",
  markWhite: "/brand/logos/docked-mark-white.png",
  social: "/brand/social/docked-hero-built-for-an-edge.png",
} as const;
