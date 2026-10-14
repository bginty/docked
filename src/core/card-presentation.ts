/** Original generic jersey palette keyed to the catalogue's current NFL team.
 * These are colour treatments, not licensed uniform artwork or team marks.
 * Never use the legacy `shirt` placeholder as an NFL jersey number.
 */
const nflColours: Record<string, readonly [string, string]> = {
  ARI: ["#97233f", "#ffffff"],
  ATL: ["#a71930", "#151515"],
  BAL: ["#241773", "#c5a34a"],
  BUF: ["#00338d", "#c60c30"],
  CAR: ["#0085ca", "#101820"],
  CHI: ["#0b162a", "#c83803"],
  CIN: ["#fb4f14", "#101820"],
  CLE: ["#311d00", "#ff3c00"],
  DAL: ["#003594", "#b0b7bc"],
  DEN: ["#fb4f14", "#002244"],
  DET: ["#0076b6", "#b0b7bc"],
  GB: ["#203731", "#ffb612"],
  HOU: ["#03202f", "#a71930"],
  IND: ["#002c5f", "#ffffff"],
  JAX: ["#006778", "#d7a22a"],
  KC: ["#e31837", "#ffb81c"],
  LV: ["#161616", "#a5acaf"],
  LAC: ["#0080c6", "#ffc20e"],
  LA: ["#003594", "#ffa300"],
  LAR: ["#003594", "#ffa300"],
  MIA: ["#008e97", "#fc4c02"],
  MIN: ["#4f2683", "#ffc62f"],
  NE: ["#002244", "#c60c30"],
  NO: ["#101820", "#d3bc8d"],
  NYG: ["#0b2265", "#a71930"],
  NYJ: ["#125740", "#ffffff"],
  PHI: ["#004c54", "#a5acaf"],
  PIT: ["#101820", "#ffb612"],
  SEA: ["#002244", "#69be28"],
  SF: ["#aa0000", "#b3995d"],
  TB: ["#d50a0a", "#34302b"],
  TEN: ["#0c2340", "#4b92db"],
  WAS: ["#5a1414", "#ffb612"],
};
export type JerseyMetadata = {
  sport?: string;
  team?: string;
  colour?: string;
  shirt?: number;
  verifiedJerseyNumber?: number | null;
};
export function jerseyPresentation(card?: JerseyMetadata) {
  if (card?.sport === "nfl") {
    const colours = nflColours[card.team?.trim().toUpperCase() ?? ""] ?? [
      "#17294b",
      "#59cce5",
    ];
    const n = card.verifiedJerseyNumber;
    return {
      primary: colours[0],
      accent: colours[1],
      number: Number.isInteger(n) && n! >= 0 && n! <= 99 ? String(n) : "—",
    };
  }
  return {
    primary: card?.colour ?? "#17294b",
    accent: "#9fc7e2",
    number: card?.shirt ? String(card.shirt) : "—",
  };
}

/** Full current-team display names; unknown provider codes are not guessed. */
const nflTeamNames: Record<string, string> = {
  ARI: "Arizona Cardinals",
  ATL: "Atlanta Falcons",
  BAL: "Baltimore Ravens",
  BUF: "Buffalo Bills",
  CAR: "Carolina Panthers",
  CHI: "Chicago Bears",
  CIN: "Cincinnati Bengals",
  CLE: "Cleveland Browns",
  DAL: "Dallas Cowboys",
  DEN: "Denver Broncos",
  DET: "Detroit Lions",
  GB: "Green Bay Packers",
  HOU: "Houston Texans",
  IND: "Indianapolis Colts",
  JAX: "Jacksonville Jaguars",
  KC: "Kansas City Chiefs",
  LV: "Las Vegas Raiders",
  LAC: "Los Angeles Chargers",
  LA: "Los Angeles Rams",
  LAR: "Los Angeles Rams",
  MIA: "Miami Dolphins",
  MIN: "Minnesota Vikings",
  NE: "New England Patriots",
  NO: "New Orleans Saints",
  NYG: "New York Giants",
  NYJ: "New York Jets",
  PHI: "Philadelphia Eagles",
  PIT: "Pittsburgh Steelers",
  SEA: "Seattle Seahawks",
  SF: "San Francisco 49ers",
  TB: "Tampa Bay Buccaneers",
  TEN: "Tennessee Titans",
  WAS: "Washington Commanders",
};
export function fullTeamName(card: Pick<JerseyMetadata, "sport" | "team">) {
  if (card.sport !== "nfl") return card.team || "Team unavailable";
  return (
    nflTeamNames[card.team?.trim().toUpperCase() ?? ""] ?? "Team unavailable"
  );
}
