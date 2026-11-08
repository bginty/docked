import config from "../../config/nfl-seven-v1.json";
export function seasonLabel(value: string) {
  const match = /^PRIVATE-TEST-(\d{4})$/.exec(value);
  return match ? `${match[1]} · Test` : value;
}
/** UI terminology only. API `week`, season IDs and saved rules stay unchanged. */
export function competitionRoundWord(sport?: string) {
  return sport === "basketball" || sport === "nba" ? "Week" : "Round";
}
export type RoundDisplay = {
  name?: string;
  season: string;
  round: number;
  sport?: string;
  fixture_kind?: "practice" | "verified";
  opens_at?: string | null;
  locks_at: string;
  scored_at?: string | null;
  rules?: Record<string, unknown>;
};
export function competitionContextBadge(
  c: Pick<RoundDisplay, "name" | "season" | "rules" | "fixture_kind">,
) {
  if (
    c.fixture_kind === "practice" ||
    c.rules?.practice === true ||
    /practice/i.test(`${c.name ?? ""} ${c.season}`)
  )
    return "Practice";
  return /^PRIVATE-TEST(?:-|$)/.test(c.season) ? "Test" : null;
}
/** A passed deadline is not evidence of final statistics or final results. */
export function competitionRoundStatus(c: RoundDisplay, now: number) {
  if (c.scored_at) return "Final";
  if (c.rules?.disabled === true) return "Entries unavailable";
  const locks = Date.parse(c.locks_at);
  if (!Number.isFinite(locks)) return "Schedule pending";
  if (locks <= now) return "Entries closed";
  const opens = c.opens_at ? Date.parse(c.opens_at) : NaN;
  if (opens > now) return "Upcoming";
  return Number.isFinite(opens) ? "Entries open" : "Open for planning";
}
/** Only published, selectable competitions supplied by the server are considered. */
export function hasFutureCompetition(rounds: RoundDisplay[], now: number) {
  return rounds.some(
    (round) =>
      competitionContextBadge(round) !== "Practice" &&
      !round.scored_at &&
      round.rules?.disabled !== true &&
      Date.parse(round.locks_at) > now,
  );
}
export function competitionRoundLabel(
  c: Pick<RoundDisplay, "round" | "sport">,
) {
  return `${competitionRoundWord(c.sport)} ${c.round}`;
}
export function competitionRoundOption(c: RoundDisplay, now: number) {
  const badge = competitionContextBadge(c);
  return `${competitionRoundLabel(c)} — ${competitionRoundStatus(c, now)}${badge ? ` · ${badge}` : ""}`;
}
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
  sport?: string;
}) {
  return c.rules.lineup_version &&
    (c.rules.mode === "SALARY_CAP" || c.rules.mode === "OPEN")
    ? `${competitionName(c.rules.mode)} · ${competitionRoundLabel(c)}${competitionContextBadge(c) ? ` · ${competitionContextBadge(c)}` : ""}`
    : c.name;
}

export function reviewCompetitionLabel(r: {
  name: string;
  mode: string;
  season: string;
  week: number;
  lineup: unknown;
  sport?: string;
}) {
  return r.lineup && (r.mode === "SALARY_CAP" || r.mode === "OPEN")
    ? `${competitionName(r.mode)} · ${competitionRoundWord(r.sport)} ${r.week}${competitionContextBadge(r) ? ` · ${competitionContextBadge(r)}` : ""}`
    : r.name;
}

export type CompetitionDisplayContext = {
  mode: string;
  lineupVersion: string | null;
  season: string;
  week: number;
  sport?: string;
};
export function contextualCompetitionName(
  name: string,
  display?: CompetitionDisplayContext,
) {
  return display?.lineupVersion && ["SALARY_CAP", "OPEN"].includes(display.mode)
    ? `${competitionName(display.mode)} · ${competitionRoundWord(display.sport)} ${display.week}${competitionContextBadge({ ...display, name }) ? ` · ${competitionContextBadge({ ...display, name })}` : ""}`
    : name;
}
