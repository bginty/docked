/** Test inventory namespaces cannot be confused with canonical real players. */
export const fixtureSports = {
  basketball: {
    label: "NBA",
    prefix: "nba",
    positions: ["PG", "SG", "SF", "PF", "C"],
  },
  afl: { label: "AFL", prefix: "afl", positions: ["DEF", "MID", "FWD", "RUC"] },
  nrl: {
    label: "NRL",
    prefix: "nrl",
    positions: ["WFB", "CTR", "HLF", "EDG", "MID"],
  },
} as const;
export type FixtureSport = keyof typeof fixtureSports;
export const isFixtureSport = (sport: string): sport is FixtureSport =>
  Object.hasOwn(fixtureSports, sport);
