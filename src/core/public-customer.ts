/** Presentation gate only. SQL independently verifies the active public policy,
 * account, regional approval, consent, sport and saved competition binding. */
export function publicCustomersEnabled(
  env: Record<string, string | undefined> = process.env,
) {
  return (
    env.DOCKED_PUBLIC_CUSTOMERS === "true" && env.DOCKED_BETA_STAGING !== "true"
  );
}
export const publicSports = ["nfl", "afl", "nrl"] as const;
export type PublicSport = (typeof publicSports)[number];
export function isPublicSport(value: unknown): value is PublicSport {
  return (
    typeof value === "string" && publicSports.includes(value as PublicSport)
  );
}
