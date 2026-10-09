import type { SportSlug } from "@/content/sports";
const competitions = {
  soccer_epl: { sport: "football", label: "English Premier League" },
  soccer_spain_la_liga: { sport: "football", label: "La Liga" },
  basketball_nba: { sport: "basketball", label: "NBA" },
} as const;
export function sportCoverage(
  sport: SportSlug,
  configuredCompetitions: readonly string[],
) {
  const configured = Object.entries(competitions)
    .filter(
      ([id, item]) =>
        item.sport === sport && configuredCompetitions.includes(id),
    )
    .map(([id, item]) => ({ id, label: item.label }));
  return {
    status: configured.length
      ? ("RESEARCH" as const)
      : ("COMING SOON" as const),
    label: configured.length ? "Research coverage" : "Coming soon",
    explanation: configured.length
      ? "Implemented research scope. Strategy validation and live activation are separate requirements."
      : "Planned coverage. No pricing pipeline or live selections are configured.",
    competitions: configured,
  };
}
