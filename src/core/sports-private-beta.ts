import { nbaPrivateBetaEnabled } from "./nba-private-beta";
export const betaSports = ["basketball", "afl", "nrl"] as const;
export type BetaSport = (typeof betaSports)[number];
export const isBetaSport = (sport: string): sport is BetaSport =>
  betaSports.some((s) => s === sport);
/** Separate from live sport/issuance/provider activation. NFL is never routed here. */
export function sportPrivateBetaEnabled(
  sport: string,
  env: Record<string, string | undefined> = process.env,
) {
  if (!isBetaSport(sport) || !nbaPrivateBetaEnabled(env)) return false;
  return sport === "basketball" || env.DOCKED_SPORTS_PRIVATE_BETA === "true";
}
