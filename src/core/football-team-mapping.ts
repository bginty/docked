/** Explicit reviewed identities; no fuzzy matching or suffix stripping. */
export const footballTeamMappingVersion = "epl-team-aliases-2026-10-04-v1";
/** Canonical fixture labels observed in the retained Docked Preview catalogue. */
export const canonicalFootballAliases: Readonly<Record<string, string>> =
  Object.freeze({
    Arsenal: "football:england:arsenal",
    "Leeds United": "football:england:leeds",
    "Aston Villa": "football:england:aston-villa",
    Brentford: "football:england:brentford",
    "Ipswich Town": "football:england:ipswich",
    Fulham: "football:england:fulham",
    Sunderland: "football:england:sunderland",
    "Brighton and Hove Albion": "football:england:brighton",
    Chelsea: "football:england:chelsea",
    Bournemouth: "football:england:bournemouth",
    "Manchester United": "football:england:manchester-united",
    "Tottenham Hotspur": "football:england:tottenham",
  });
export const footballTeamAliases: Readonly<Record<string, string>> =
  Object.freeze({
    "AFC Bournemouth": "bournemouth",
    "Arsenal FC": "arsenal",
    "Aston Villa FC": "aston-villa",
    "Brentford FC": "brentford",
    "Brighton & Hove Albion FC": "brighton",
    "Burnley FC": "burnley",
    "Chelsea FC": "chelsea",
    "Coventry City FC": "coventry",
    "Crystal Palace FC": "crystal-palace",
    "Everton FC": "everton",
    "Fulham FC": "fulham",
    "Hull City AFC": "hull",
    "Ipswich Town FC": "ipswich",
    "Leeds United FC": "leeds",
    "Liverpool FC": "liverpool",
    "Manchester City FC": "manchester-city",
    "Manchester United FC": "manchester-united",
    "Newcastle United FC": "newcastle",
    "Nottingham Forest FC": "nottingham-forest",
    "Sunderland AFC": "sunderland",
    "Tottenham Hotspur FC": "tottenham",
    "West Ham United FC": "west-ham",
    "Wolverhampton Wanderers FC": "wolves",
  });
export function openFootballTeamId(alias: string): string {
  const value = Object.hasOwn(footballTeamAliases, alias)
    ? footballTeamAliases[alias]
    : undefined;
  if (!value) throw Error(`TEAM_MAPPING_REVIEW_REQUIRED: ${alias}`);
  return `football:england:${value}`;
}
