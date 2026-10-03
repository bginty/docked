import suppliedTokens from "./brand-tokens.json";
import canonical from "./canonical-logo.json";

/** Approved Edge Signal identity; the supplied pack is archived unchanged. */
export const brand = suppliedTokens;
export const brandAssets = {
  mark: canonical.master,
  social: canonical.social,
} as const;
