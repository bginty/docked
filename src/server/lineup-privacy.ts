import "server-only";
import { withCommunityActor } from "./community-social";
export type PublishedLineup = {
  competition: string;
  name: string;
  sport: string;
  season: string;
  round: number;
  mode: string;
  locksAt: string;
  players: {
    slot: string;
    name: string | null;
    position: string | null;
    tier: string | null;
    team: string | null;
    multiplierTenths: number | null;
  }[];
};
export async function memberLockedLineups(
  profile: string,
): Promise<PublishedLineup[]> {
  return withCommunityActor("public_profiles", false, async (tx) => {
    const [row] =
      await tx`select private.social_locked_lineups(${profile}::uuid) teams`;
    return row.teams;
  });
}
