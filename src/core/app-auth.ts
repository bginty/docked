/** App UI context only: never grants identity, region, or tester permissions. */
export function appAuthCallbackDestination(next: string | null) {
  if (next === "/app/reset-password") return next;
  if (next === "/app/verified") return next;
  if (next === "/reset-password") return next;
  return "/dashboard";
}

export const appSports = [
  ["football", "Football"],
  ["nfl", "NFL"],
  ["basketball", "NBA / basketball"],
  ["afl", "AFL"],
  ["tennis", "Tennis"],
  ["cricket", "Cricket"],
  ["horse-racing", "Racing"],
] as const;
