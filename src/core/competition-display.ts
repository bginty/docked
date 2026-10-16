import config from "../../config/nfl-seven-v1.json";
/** Presentation only: persisted modes and historical rules remain unchanged. */
export const competitionNames = {
  SALARY_CAP: "Traditional",
  OPEN: "All-Star",
} as const;
export function competitionName(mode: unknown) {
  return mode === "SALARY_CAP" || mode === "OPEN"
    ? competitionNames[mode]
    : "Legacy";
}
export function competitionSubtitle(mode: unknown) {
  return mode === "SALARY_CAP"
    ? `$${(config.salaryCap / 1_000_000).toLocaleString("en-AU")}m salary cap`
    : "No salary cap";
}
export function competitionLabel(c: {
  name: string;
  rules: Record<string, unknown>;
  season: string;
  round: number;
}) {
  return c.rules.lineup_version &&
    (c.rules.mode === "SALARY_CAP" || c.rules.mode === "OPEN")
    ? `${competitionName(c.rules.mode)} · ${c.season} · Week ${c.round}`
    : c.name;
}

export function reviewCompetitionLabel(r: {
  name: string;
  mode: string;
  season: string;
  week: number;
  lineup: unknown;
}) {
  return r.lineup && (r.mode === "SALARY_CAP" || r.mode === "OPEN")
    ? `${competitionName(r.mode)} · ${r.season} · Week ${r.week}`
    : r.name;
}

export type CompetitionDisplayContext = {
  mode: string;
  lineupVersion: string | null;
  season: string;
  week: number;
};
export function contextualCompetitionName(
  name: string,
  display?: CompetitionDisplayContext,
) {
  return display?.lineupVersion && ["SALARY_CAP", "OPEN"].includes(display.mode)
    ? `${competitionName(display.mode)} · ${display.season} · Week ${display.week}`
    : name;
}
