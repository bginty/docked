import { customerSports } from "./customer-sports";

/** A native shell uses the same server eligibility as the website. Never let a
 * failed public lookup fall through to the more permissive private-beta path. */
export async function mobileSportCapabilities(deps: {
  publicMode: boolean;
  publicSports: () => Promise<readonly string[]>;
  betaSports: () => Promise<readonly string[]>;
}) {
  const allowed = deps.publicMode
    ? await deps.publicSports()
    : ["nfl", ...(await deps.betaSports())];
  return customerSports.filter((sport) => allowed.includes(sport));
}
