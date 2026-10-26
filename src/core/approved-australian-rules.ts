import { nflSeven } from "./nfl-seven";
import { aflConfiguration, nrlConfiguration } from "./sport-configuration";
import type { PrizeItem } from "./prize-schedules";

export const australianRulesVersion = "docked-australian-owner-2026-10-24-v1";
/** Approved salary dollars; old QA configurations are deliberately not changed. */
export function approvedAustralianLineup(sport: "afl" | "nrl") {
  return {
    ...nflSeven,
    version: `${australianRulesVersion}-${sport}`,
    sport,
    inventoryScope: "isolated-multi-sport-v1",
    slots: (sport === "afl" ? aflConfiguration : nrlConfiguration).slots,
    salaryCap: sport === "afl" ? 13_800_000 : 8_200_000,
    salaries: { ...nflSeven.salaries },
    salaryUnit: "fantasy-dollars",
    lockPolicy: "round-wide-v1",
    commerciallyApproved: false,
  };
}
export function approvedAustralianPrizes(
  sport: "afl" | "nrl",
  mode: "SALARY_CAP" | "OPEN",
) {
  const premium = mode === "OPEN";
  const productVersion = `${premium ? "premium" : "standard"}-9-${sport}-real-roster-beta-v1`;
  const credits = (place: number, amount: number): PrizeItem => ({
    from: place,
    to: place,
    type: "credits",
    amount,
    description: `${amount.toLocaleString("en-AU")} Docked Credits`,
  });
  const packs = (place: number): PrizeItem => ({
    from: place,
    to: place,
    type: "pack",
    amount: 5,
    productVersion,
    description: `${premium ? "Premium" : "Standard"} 9 Pack ${sport.toUpperCase()}`,
  });
  return {
    version: `${australianRulesVersion}-${sport}-${mode}`,
    sport,
    mode,
    scope: "weekly" as const,
    active: false,
    // No approved AFL/NRL tie resolution was found. Fail closed for all awards.
    tiePolicy: null,
    season: "To be announced",
    items: [
      credits(1, premium ? 100_000 : 25_000),
      credits(2, premium ? 25_000 : 10_000),
      packs(2),
      packs(3),
    ],
  };
}
export function usesApprovedAustralianSalary(config?: { version: string }) {
  return (
    config?.version === `${australianRulesVersion}-afl` ||
    config?.version === `${australianRulesVersion}-nrl`
  );
}
export function australianSalaryLabel(config?: {
  version: string;
  salaryCap: number;
}) {
  return config && usesApprovedAustralianSalary(config)
    ? `$${(config.salaryCap / 1_000_000).toFixed(1)}m salary cap`
    : undefined;
}
