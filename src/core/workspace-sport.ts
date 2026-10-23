import { isBetaSport } from "./sports-private-beta";
export const activeSportCookie = "docked-active-sport";
// This is a display preference only. All data APIs still enforce their own
// verified session, MFA, sport admission and feature gates.
export function workspaceSport(query: unknown, saved: unknown) {
  for (const value of [query, saved])
    if (
      typeof value === "string" &&
      (value === "nfl" || value === "football" || isBetaSport(value))
    )
      return value;
  return "nfl";
}
export function privateSportWorkspace(surface: string, sport: string) {
  return ["play", "cards", "packs"].includes(surface) && isBetaSport(sport);
}
