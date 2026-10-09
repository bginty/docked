import suppliedTokens from "./brand-tokens.json";
import { fantasyAssets } from "./fantasy-assets";
/** Fantasy card identity supplied by the owner. */
export const brand = suppliedTokens;
export const brandAssets = {
  mark: fantasyAssets.icon512,
  social: fantasyAssets.social,
} as const;
