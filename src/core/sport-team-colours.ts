/** Docked two-colour interpretations, not uniform replicas or official colour specifications.
 * This is a presentation catalogue, NOT an active-team/roster/eligibility list.
 * Stable keys and explicit aliases only: never fuzzy-match a city or provider ID.
 * Sources and review notes: docs/qa/multi-sport/team-colours/verification.json.
 */
export type TeamColourSport = "afl" | "nrl" | "basketball" | "football";
type PaletteRow = readonly [
  key: string,
  name: string,
  primary: string,
  accent: string,
  ...aliases: string[],
];
const rows: Record<TeamColourSport, readonly PaletteRow[]> = {
  afl: [
    ["ADE", "Adelaide Crows", "#002b5c", "#ffd200", "Adelaide"],
    ["BRI", "Brisbane Lions", "#7c1935", "#ffc425", "Brisbane"],
    ["CAR", "Carlton", "#031a29", "#ffffff", "Carlton Blues"],
    ["COL", "Collingwood", "#171717", "#ffffff", "Collingwood Magpies"],
    ["ESS", "Essendon", "#171717", "#cc2031", "Essendon Bombers"],
    ["FRE", "Fremantle", "#351c54", "#ffffff", "Fremantle Dockers"],
    ["GEE", "Geelong", "#002b5c", "#ffffff", "Geelong Cats"],
    ["GCS", "Gold Coast Suns", "#e21b2b", "#ffd200", "Gold Coast", "GC"],
    [
      "GWS",
      "GWS Giants",
      "#f47920",
      "#333f48",
      "Greater Western Sydney Giants",
      "Greater Western Sydney",
    ],
    ["HAW", "Hawthorn", "#4d2004", "#f6b900", "Hawthorn Hawks"],
    ["MEL", "Melbourne", "#061a33", "#cc2031", "Melbourne Demons"],
    [
      "NME",
      "North Melbourne",
      "#003da5",
      "#ffffff",
      "North Melbourne Kangaroos",
      "NM",
    ],
    ["POR", "Port Adelaide", "#101820", "#008aab", "Port Adelaide Power", "PA"],
    ["RIC", "Richmond", "#171717", "#ffd200", "Richmond Tigers"],
    ["STK", "St Kilda", "#ed1b2f", "#171717", "St Kilda Saints"],
    ["SYD", "Sydney Swans", "#ed1b2f", "#ffffff"],
    ["WCE", "West Coast Eagles", "#003087", "#f2a900", "West Coast"],
    ["WBD", "Western Bulldogs", "#0055a4", "#ed1b2f", "WB"],
  ],
  nrl: [
    ["BRI", "Brisbane Broncos", "#6c1d45", "#fbbf15"],
    ["CAN", "Canberra Raiders", "#7ac143", "#ffffff"],
    [
      "CBY",
      "Canterbury-Bankstown Bulldogs",
      "#0055a4",
      "#ffffff",
      "Canterbury Bulldogs",
    ],
    [
      "CRO",
      "Cronulla-Sutherland Sharks",
      "#00a9e0",
      "#101820",
      "Cronulla Sharks",
    ],
    ["DOL", "Dolphins", "#ed1b2f", "#f2e4c4", "The Dolphins"],
    ["GLD", "Gold Coast Titans", "#007ac2", "#f5b335", "GCT"],
    [
      "MAN",
      "Manly-Warringah Sea Eagles",
      "#6f2232",
      "#ffffff",
      "Manly Sea Eagles",
    ],
    ["MEL", "Melbourne Storm", "#582c83", "#f5b335"],
    ["NEW", "Newcastle Knights", "#0055a4", "#ed1b2f"],
    ["NQL", "North Queensland Cowboys", "#002b5c", "#ffcc00"],
    ["PAR", "Parramatta Eels", "#0055a4", "#ffd200"],
    ["PEN", "Penrith Panthers", "#171717", "#e75ba0"],
    ["SOU", "South Sydney Rabbitohs", "#006b3f", "#ed1b2f"],
    [
      "SGI",
      "St George Illawarra Dragons",
      "#ffffff",
      "#ed1b2f",
      "St. George Illawarra Dragons",
    ],
    ["SYD", "Sydney Roosters", "#002b5c", "#ed1b2f"],
    [
      "WAR",
      "New Zealand Warriors",
      "#0055a4",
      "#00a651",
      "Warriors",
      "NZ Warriors",
    ],
    ["WST", "Wests Tigers", "#f58220", "#171717"],
  ],
  basketball: [
    ["ATL", "Atlanta Hawks", "#c8102e", "#fdb927"],
    ["BOS", "Boston Celtics", "#007a33", "#ffffff"],
    ["BKN", "Brooklyn Nets", "#171717", "#ffffff"],
    ["CHA", "Charlotte Hornets", "#00788c", "#a1a1c4"],
    ["CHI", "Chicago Bulls", "#ce1141", "#171717"],
    ["CLE", "Cleveland Cavaliers", "#860038", "#fdbb30"],
    ["DAL", "Dallas Mavericks", "#00538c", "#b8c4ca"],
    ["DEN", "Denver Nuggets", "#0e2240", "#fec524"],
    ["DET", "Detroit Pistons", "#1d42ba", "#c8102e"],
    ["GSW", "Golden State Warriors", "#1d428a", "#ffc72c"],
    ["HOU", "Houston Rockets", "#ce1141", "#ffffff"],
    ["IND", "Indiana Pacers", "#002d62", "#fdbb30"],
    ["LAC", "Los Angeles Clippers", "#1d428a", "#c8102e", "LA Clippers"],
    ["LAL", "Los Angeles Lakers", "#fdb927", "#552583"],
    ["MEM", "Memphis Grizzlies", "#5d76a9", "#12173f"],
    ["MIA", "Miami Heat", "#98002e", "#f9a01b"],
    ["MIL", "Milwaukee Bucks", "#00471b", "#eee1c6"],
    ["MIN", "Minnesota Timberwolves", "#0c2340", "#78be20"],
    ["NOP", "New Orleans Pelicans", "#0c2340", "#b4975a"],
    ["NYK", "New York Knicks", "#006bb6", "#f58426"],
    ["OKC", "Oklahoma City Thunder", "#007ac1", "#ef3b24"],
    ["ORL", "Orlando Magic", "#0077c0", "#c4ced4"],
    ["PHI", "Philadelphia 76ers", "#006bb6", "#ed174c"],
    ["PHX", "Phoenix Suns", "#1d1160", "#e56020"],
    ["POR", "Portland Trail Blazers", "#171717", "#e03a3e"],
    ["SAC", "Sacramento Kings", "#5a2d81", "#b8c4ca"],
    ["SAS", "San Antonio Spurs", "#171717", "#c4ced4"],
    ["TOR", "Toronto Raptors", "#ce1141", "#171717"],
    ["UTA", "Utah Jazz", "#6c3c98", "#8bb8e8"],
    ["WAS", "Washington Wizards", "#002b5c", "#e31837"],
  ],
  football: [
    ["ARS", "Arsenal", "#ef0107", "#ffffff", "Arsenal FC"],
    ["AVL", "Aston Villa", "#670e36", "#95bfe5"],
    ["BOU", "AFC Bournemouth", "#da291c", "#171717", "Bournemouth"],
    ["BRE", "Brentford", "#e30613", "#ffffff"],
    [
      "BHA",
      "Brighton & Hove Albion",
      "#0057b8",
      "#ffffff",
      "Brighton and Hove Albion",
    ],
    ["CHE", "Chelsea", "#034694", "#ffffff", "Chelsea FC"],
    ["COV", "Coventry City", "#6caddf", "#ffffff"],
    ["CRY", "Crystal Palace", "#1b458f", "#c4122e"],
    ["EVE", "Everton", "#003399", "#ffffff"],
    ["FUL", "Fulham", "#ffffff", "#171717"],
    ["HUL", "Hull City", "#f5a12d", "#171717"],
    ["IPS", "Ipswich Town", "#0057b8", "#ffffff"],
    ["LEE", "Leeds United", "#ffffff", "#ffcd00"],
    ["LIV", "Liverpool", "#c8102e", "#ffffff", "Liverpool FC"],
    ["MCI", "Manchester City", "#6cabdd", "#ffffff", "Man City"],
    ["MUN", "Manchester United", "#da291c", "#171717", "Man Utd"],
    ["NEW", "Newcastle United", "#171717", "#ffffff"],
    ["NFO", "Nottingham Forest", "#dd0000", "#ffffff"],
    ["SUN", "Sunderland", "#eb172b", "#ffffff"],
    ["TOT", "Tottenham Hotspur", "#ffffff", "#132257", "Tottenham"],
    // Retained identities for existing cards, not current-season eligibility.
    ["BUR", "Burnley", "#6c1d45", "#99d6ea"],
    ["WHU", "West Ham United", "#7a263a", "#1bb1e7"],
    ["WOL", "Wolverhampton Wanderers", "#fdb913", "#171717", "Wolves"],
  ],
};

export const teamColourCatalogue = Object.entries(rows).flatMap(
  ([sport, teams]) =>
    teams.map(([key, name, primary, accent, ...aliases]) => ({
      sport: sport as TeamColourSport,
      id: `${sport}:${key.toLowerCase()}`,
      key,
      name,
      primary,
      accent,
      aliases,
    })),
);
const normalise = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, " ");
const lookup = new Map<string, (typeof teamColourCatalogue)[number]>(
  teamColourCatalogue.flatMap((team) =>
    [team.id, team.key, team.name, ...team.aliases].map(
      (alias) => [`${team.sport}:${normalise(alias)}`, team] as const,
    ),
  ),
);

/** Provider IDs must be explicitly mapped to a canonical key/name before rendering. */
export function teamColours(sport?: string, team?: string) {
  return sport && team ? lookup.get(`${sport}:${normalise(team)}`) : undefined;
}
