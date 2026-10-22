import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { nbaWeeklyLineup, nbaWeeklyRules } from "../src/core/nba-weekly";
import { scorePlayer } from "../src/core/scoring-v1";
import { autoSelect } from "../src/core/lineup-auto-select";
import { sevenIssues } from "../src/core/nfl-seven";
const cfg = nbaWeeklyLineup(),
  rules = nbaWeeklyRules();
let seed = 20261022;
const random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
const integer = (n: number) => Math.floor(random() * n);
const tiers = Object.keys(cfg.salaries);
const simple = (tier: string) =>
  cfg.slots.map((s, i) => ({
    id: `qa:${i}`,
    player_id: `qa:p${i}`,
    position: s.positions[0],
    sport: "basketball",
    tier,
    status: "active",
    listed: false,
    value: 4000,
  }));
const uniform = tiers.map((tier) => ({
  tier,
  cost: cfg.salaries[tier as keyof typeof cfg.salaries] * 8,
  filledSalaryCap: autoSelect(simple(tier), "SALARY_CAP", [], cfg).picks.length,
  filledOpen: autoSelect(simple(tier), "OPEN", [], cfg).picks.length,
}));
const trials = [];
for (let trial = 0; trial < 50; trial++) {
  const cards = Array.from({ length: 25 }, (_, i) => {
    const games = 1 + integer(4),
      stats = {
        points: 8 + integer(28),
        rebounds: integer(14),
        assists: integer(13),
        steals: integer(4),
        blocks: integer(4),
        turnovers: integer(6),
        threePointers: integer(6),
      };
    const value =
      scorePlayer(rules, ["PG", "SG", "SF", "PF", "C"][i % 5], stats)
        .centipoints * games;
    return {
      id: `qa:${trial}:${i}`,
      player_id: `qa:p${i}`,
      sport: "basketball",
      position: ["PG", "SG", "SF", "PF", "C"][i % 5],
      tier: tiers[integer(6)],
      status: "active",
      listed: false,
      value,
    };
  });
  const capped = autoSelect(cards, "SALARY_CAP", [], cfg),
    open = autoSelect(cards, "OPEN", [], cfg);
  assert.equal(capped.picks.length, 8);
  assert.deepEqual(
    sevenIssues("SALARY_CAP", capped.picks, cards, true, cfg).errors,
    [],
  );
  const total = (p: typeof capped) =>
    p.picks.reduce((n, s) => n + cards.find((c) => c.id === s.card)!.value, 0);
  assert.ok(total(capped) <= total(open));
  assert.deepEqual(
    autoSelect([...cards].reverse(), "SALARY_CAP", [], cfg).picks,
    capped.picks,
  );
  trials.push({
    trial,
    capCost: capped.cost,
    capCentipoints: total(capped),
    openCentipoints: total(open),
    changedByCap: total(capped) < total(open),
  });
}
const example = {
  points: 28,
  rebounds: 9,
  assists: 7,
  steals: 2,
  blocks: 1,
  turnovers: 3,
  threePointers: 3,
};
const schedules = [1, 2, 3, 4].map((games) => ({
  games,
  centipoints: games * scorePlayer(rules, "PG", example).centipoints,
  oneConfirmedDnpCentipoints: (games - 1) * 5530,
}));
const outlier = {
  points: 70,
  rebounds: 20,
  assists: 15,
  steals: 4,
  blocks: 3,
  turnovers: 7,
  threePointers: 8,
};
const independent = (s: typeof example) =>
  10 * s.points +
  12 * s.rebounds +
  15 * s.assists +
  30 * s.steals +
  30 * s.blocks -
  10 * s.turnovers +
  ([s.points, s.rebounds, s.assists, s.steals, s.blocks].filter((v) => v >= 10)
    .length >= 2
    ? 15
    : 0) +
  ([s.points, s.rebounds, s.assists, s.steals, s.blocks].filter((v) => v >= 10)
    .length >= 3
    ? 30
    : 0);
for (let i = 0; i < 1000; i++) {
  const s = {
    points: integer(90),
    rebounds: integer(30),
    assists: integer(30),
    steals: integer(15),
    blocks: integer(15),
    turnovers: integer(20),
    threePointers: 0,
  };
  assert.equal(scorePlayer(rules, "C", s).centipoints, independent(s) * 10);
}
const mixed = simple("CORE").map((c, i) => ({
  ...c,
  tier: i < 4 ? "ICON" : "CORE",
}));
assert.equal(autoSelect(mixed, "SALARY_CAP", [], cfg).cost, 5_200_000);
const report = {
  proposal: true,
  synthetic: true,
  seed: 20261022,
  simulation: "No real players, provider observations or assets",
  uniform,
  schedules,
  mixedFourIconFourCoreCost: 5_200_000,
  outlierCentipoints: scorePlayer(rules, "C", outlier).centipoints,
  trials,
  summary: {
    collections: trials.length,
    capChangesOptimum: trials.filter((t) => t.changedByCap).length,
    meanCapScore:
      trials.reduce((n, t) => n + t.capCentipoints, 0) / trials.length / 100,
    meanOpenScore:
      Math.round(
        trials.reduce((n, t) => n + t.openCentipoints, 0) / trials.length,
      ) / 100,
  },
  findings: [
    "All-Core costs $4m; all-Elite exactly $5.2m; all-Ultra Rare and above cannot fill eight capped slots.",
    "A cheaper copy of the same player weakly dominates a dearer one for fantasy points. Rarity does not create a scoring advantage in this proposal.",
    "Four equal performances earn four times one performance. Schedule volume is a deliberate strategic factor requiring owner acceptance; no normalisation implemented.",
    "Salary scarcity can change the optimum when available higher-performing players are owned only at higher rarities. Synthetic distributions are not forecasts of member collections.",
    "Shared leaderboard ranks remain ties; ID ordering is presentation only and does not authorise prize tie-breaking.",
  ],
};
mkdirSync("docs/qa/multi-sport/nba-weekly", { recursive: true });
writeFileSync(
  "docs/qa/multi-sport/nba-weekly/simulation.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report.summary));
