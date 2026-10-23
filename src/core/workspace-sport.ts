import { isBetaSport } from "./sports-private-beta";
export const activeSportCookie = "docked-active-sport";
// Temporarily hidden at the owner's request. Keep NBA identities, inventory,
// competition history and shared AFL/NRL infrastructure intact.
export const isHiddenWorkspaceSport = (value: unknown) =>
  value === "basketball";
// This is a display preference only. All data APIs still enforce their own
// verified session, MFA, sport admission and feature gates.
export function workspaceSport(query: unknown, saved: unknown) {
  for (const value of [query, saved])
    if (
      typeof value === "string" &&
      !isHiddenWorkspaceSport(value) &&
      (value === "nfl" || value === "football" || isBetaSport(value))
    )
      return value;
  return "nfl";
}
export function privateSportWorkspace(surface: string, sport: string) {
  return ["play", "cards", "packs"].includes(surface) && isBetaSport(sport);
}
