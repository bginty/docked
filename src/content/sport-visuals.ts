export const sportKeys = [
  "football",
  "basketball",
  "tennis",
  "nfl",
  "horse-racing",
  "cricket",
  "baseball",
  "ice-hockey",
  "motorsport",
  "afl",
] as const;
export type SportKey = (typeof sportKeys)[number];

// Presentation assets only. This catalogue grants no strategy or live coverage.
export const sportVisuals: Record<
  SportKey,
  { name: string; src: string; alt: string; position: string }
> = {
  football: {
    name: "Football",
    src: "/images/sports/football.webp",
    alt: "A football pitch and stadium stands",
    position: "50% 55%",
  },
  basketball: {
    name: "Basketball",
    src: "/images/sports/basketball.webp",
    alt: "A basketball court inside an arena",
    position: "50% 55%",
  },
  tennis: {
    name: "Tennis",
    src: "/images/sports/tennis.webp",
    alt: "Tennis courts and their geometric court markings",
    position: "50% 50%",
  },
  nfl: {
    name: "NFL",
    src: "/images/sports/nfl.webp",
    alt: "An American football field",
    position: "50% 55%",
  },
  "horse-racing": {
    name: "Horse racing",
    src: "/images/sports/horse-racing.webp",
    alt: "A horse racing setting",
    position: "50% 50%",
  },
  cricket: {
    name: "Cricket",
    src: "/images/sports/cricket.webp",
    alt: "A cricket ground and pitch",
    position: "50% 55%",
  },
  baseball: {
    name: "Baseball",
    src: "/images/sports/baseball.webp",
    alt: "A baseball diamond and outfield",
    position: "50% 55%",
  },
  "ice-hockey": {
    name: "Ice hockey",
    src: "/images/sports/ice-hockey.webp",
    alt: "An indoor ice hockey rink",
    position: "50% 55%",
  },
  motorsport: {
    name: "Motorsport",
    src: "/images/sports/motorsport.webp",
    alt: "A motorsport circuit",
    position: "50% 50%",
  },
  afl: {
    name: "AFL",
    src: "/images/sports/afl.webp",
    alt: "An Australian rules football ground",
    position: "50% 55%",
  },
};
export function visualSport(value: string): SportKey {
  const key = value.toLowerCase();
  if (key === "nba" || key.startsWith("basketball")) return "basketball";
  if (key.startsWith("soccer") || key.startsWith("football_"))
    return "football";
  if (key === "american-football" || key.startsWith("americanfootball"))
    return "nfl";
  return sportKeys.includes(key as SportKey) ? (key as SportKey) : "football";
}
export const articleVisuals: Record<
  string,
  { sport: SportKey; atmosphere?: boolean }
> = {
  "value-versus-winners": { sport: "football" },
  "minimum-odds": { sport: "basketball" },
  "no-tip-is-correct": { sport: "football", atmosphere: true },
  "bookmaker-margin": { sport: "tennis" },
  "closing-line-value": { sport: "basketball" },
  "losing-runs-and-variance": { sport: "horse-racing" },
  "backtest-paper-live": { sport: "cricket" },
  "estimated-ev-and-returns": { sport: "baseball" },
};
