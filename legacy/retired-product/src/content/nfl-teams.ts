/** Current franchise identities checked against https://www.nfl.com/teams/.
 * Text identifiers only, not a licence for NFL logos, player imagery or feeds.
 * Provider identities remain separately scoped; never fuzzy-match franchises.
 */
export const nflTeams = [
  { id: "ARI", name: "Arizona Cardinals", conference: "NFC", division: "West" },
  { id: "ATL", name: "Atlanta Falcons", conference: "NFC", division: "South" },
  { id: "BAL", name: "Baltimore Ravens", conference: "AFC", division: "North" },
  { id: "BUF", name: "Buffalo Bills", conference: "AFC", division: "East" },
  {
    id: "CAR",
    name: "Carolina Panthers",
    conference: "NFC",
    division: "South",
  },
  { id: "CHI", name: "Chicago Bears", conference: "NFC", division: "North" },
  {
    id: "CIN",
    name: "Cincinnati Bengals",
    conference: "AFC",
    division: "North",
  },
  { id: "CLE", name: "Cleveland Browns", conference: "AFC", division: "North" },
  { id: "DAL", name: "Dallas Cowboys", conference: "NFC", division: "East" },
  { id: "DEN", name: "Denver Broncos", conference: "AFC", division: "West" },
  { id: "DET", name: "Detroit Lions", conference: "NFC", division: "North" },
  { id: "GB", name: "Green Bay Packers", conference: "NFC", division: "North" },
  { id: "HOU", name: "Houston Texans", conference: "AFC", division: "South" },
  {
    id: "IND",
    name: "Indianapolis Colts",
    conference: "AFC",
    division: "South",
  },
  {
    id: "JAX",
    name: "Jacksonville Jaguars",
    conference: "AFC",
    division: "South",
  },
  { id: "KC", name: "Kansas City Chiefs", conference: "AFC", division: "West" },
  {
    id: "LAC",
    name: "Los Angeles Chargers",
    conference: "AFC",
    division: "West",
  },
  { id: "LAR", name: "Los Angeles Rams", conference: "NFC", division: "West" },
  { id: "LV", name: "Las Vegas Raiders", conference: "AFC", division: "West" },
  { id: "MIA", name: "Miami Dolphins", conference: "AFC", division: "East" },
  {
    id: "MIN",
    name: "Minnesota Vikings",
    conference: "NFC",
    division: "North",
  },
  {
    id: "NE",
    name: "New England Patriots",
    conference: "AFC",
    division: "East",
  },
  {
    id: "NO",
    name: "New Orleans Saints",
    conference: "NFC",
    division: "South",
  },
  { id: "NYG", name: "New York Giants", conference: "NFC", division: "East" },
  { id: "NYJ", name: "New York Jets", conference: "AFC", division: "East" },
  {
    id: "PHI",
    name: "Philadelphia Eagles",
    conference: "NFC",
    division: "East",
  },
  {
    id: "PIT",
    name: "Pittsburgh Steelers",
    conference: "AFC",
    division: "North",
  },
  { id: "SEA", name: "Seattle Seahawks", conference: "NFC", division: "West" },
  {
    id: "SF",
    name: "San Francisco 49ers",
    conference: "NFC",
    division: "West",
  },
  {
    id: "TB",
    name: "Tampa Bay Buccaneers",
    conference: "NFC",
    division: "South",
  },
  { id: "TEN", name: "Tennessee Titans", conference: "AFC", division: "South" },
  {
    id: "WAS",
    name: "Washington Commanders",
    conference: "NFC",
    division: "East",
  },
] as const;

export function nflTeamByName(name: string) {
  return nflTeams.find((team) => team.name === name);
}

/** Season labels extend across January/February; never infer finality from date. */
export function nflSeasonAt(instant: string) {
  const date = new Date(instant);
  if (!Number.isFinite(date.getTime()))
    throw new Error("Invalid NFL season date");
  return date.getUTCFullYear() - (date.getUTCMonth() < 2 ? 1 : 0);
}
