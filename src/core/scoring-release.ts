import { rulesets, points, type Rules } from "./scoring-v1";

// Old frozen rules and saved competitions keep v1. Only NEW periods use this catalogue.
export const currentRulesets = {
  ...rulesets,
  afl: {
    ...structuredClone(rulesets.afl),
    version: "docked-afl-events-beta-v2",
    title: "Docked AFL Scoring v2",
    weights: { ...rulesets.afl.weights, kicks: 200, handballs: 100 },
    policy: [
      "Owner-approved update: kick 2, handball 1, goal 6. Other event weights are retained from v1. A mark, kick and goal now scores 11. Applies to new periods only.",
      ...rulesets.afl.policy.slice(1),
    ],
  },
};
const label = (key: string) =>
  key.replaceAll("_", " ").replace(/([a-z])([A-Z])/g, "$1 $2");
export function scoringRows(
  rules: Rules,
): { action: string; points: string }[] {
  if (rules.sport !== "epl")
    return Object.entries(rules.weights).map(([key, rate]) => ({
      action: `${label(key)} · per ${key.includes("yards") ? "yard" : "event"}`,
      points: points(rate),
    }));
  const w = rules.weights;
  const row = (action: string, rate: number) => ({
    action,
    points: points(rate),
  });
  return [
    row("Appearance · played, under 60 regulation minutes", w.shortAppearance),
    row("Appearance · 60+ regulation minutes (total)", w.fullAppearance),
    ...Object.entries(rules.goal!).map(([p, n]) => row(`Goal · ${p}`, n)),
    row("Assist", w.assists),
    ...Object.entries(rules.clean!).map(([p, n]) =>
      row(`Clean sheet · ${p}, 60+ minutes`, n),
    ),
    row("Saves · GK, each complete 3", w.savesPerThree),
    row("Penalty save · GK, additional", w.penaltySaves),
    row("Penalty missed", w.penaltiesMissed),
    row("Yellow card · excluding second-yellow dismissal", w.yellowCards),
    row("Dismissal · second yellow replaces both yellows", w.dismissal),
    row("Own goal", w.ownGoals),
    row("Conceded on pitch · GK/DEF, each complete 2", w.concededPerTwo),
  ];
}
