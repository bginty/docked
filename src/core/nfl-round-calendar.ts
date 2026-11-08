import { createHash } from "node:crypto";

export type NflCalendarGame = {
  id: string;
  round: number;
  home: string;
  away: string;
  kickoff: string;
};
export const nflCalendarModes = ["SALARY_CAP", "OPEN"] as const;
export function nflCalendarStream(season: number, round: number, mode: string) {
  return `beta-real:nfl:seven:${mode.toLowerCase()}:${season}:${round}`;
}

/** A complete calendar, never the highest imported statistic, determines rounds.
 * This is an operator preparation plan, not permission to publish a competition. */
export function planNflCalendar(input: {
  season: number;
  source: string;
  verifiedAt: string;
  now: string;
  games: NflCalendarGame[];
  existingStreams: string[];
  permitExpiresAt: string;
}) {
  const now = Date.parse(input.now),
    verified = Date.parse(input.verifiedAt);
  if (
    !Number.isInteger(input.season) ||
    input.season < 2020 ||
    !input.source.startsWith("https://") ||
    !Number.isFinite(now) ||
    !Number.isFinite(verified) ||
    verified > now ||
    now - verified > 3600000
  )
    throw Error("Fresh verified calendar evidence required");
  // Current approved NFL regular-season structure: 32 teams, 17 games each.
  // Fail closed if a future season changes format; do not guess partial weeks.
  const appearances = new Map<string, number>();
  for (const game of input.games) {
    if (
      !game.id ||
      !game.home ||
      !game.away ||
      game.home === game.away ||
      !Number.isInteger(game.round) ||
      game.round < 1 ||
      game.round > 18
    )
      throw Error("Invalid regular-season calendar");
    for (const team of [game.home, game.away])
      appearances.set(team, (appearances.get(team) ?? 0) + 1);
  }
  if (
    input.games.length !== 272 ||
    new Set(input.games.map((g) => g.id)).size !== 272 ||
    appearances.size !== 32 ||
    [...appearances.values()].some((n) => n !== 17)
  )
    throw Error("Complete 272-game regular-season calendar required");
  const games = [...input.games].sort((a, b) => a.id.localeCompare(b.id));
  const calendarHash = createHash("sha256")
    .update(
      JSON.stringify({
        season: input.season,
        source: input.source,
        games,
      }),
    )
    .digest("hex");
  const existing = new Set(input.existingStreams);
  const permitExpiry = Date.parse(input.permitExpiresAt);
  const rounds = Array.from({ length: 18 }, (_, i) => {
    const round = i + 1,
      fixtures = games.filter((g) => g.round === round);
    const times = fixtures.map((g) => Date.parse(g.kickoff));
    const teams = fixtures.flatMap((g) => [g.home, g.away]);
    const valid =
      fixtures.length > 0 &&
      times.every(Number.isFinite) &&
      new Set(teams).size === teams.length;
    const first = Math.min(...times),
      last = Math.max(...times);
    const missingModes = nflCalendarModes.filter(
      (mode) => !existing.has(nflCalendarStream(input.season, round, mode)),
    );
    const status = !valid
      ? "calendar-review"
      : !missingModes.length
        ? "existing"
        : first <= now
          ? "past-deadline"
          : !Number.isFinite(permitExpiry) || permitExpiry <= last
            ? "provider-renewal-required"
            : "draft-ready";
    return {
      round,
      status,
      missingModes,
      games: fixtures,
      locksAt: valid ? new Date(first).toISOString() : null,
      lastKickoffAt: valid ? new Date(last).toISOString() : null,
    };
  });
  return {
    version: "nfl-calendar-plan-v1",
    season: input.season,
    source: input.source,
    verifiedAt: input.verifiedAt,
    asOf: input.now,
    calendarHash,
    rounds,
    publication: "separate-owner-review-required" as const,
  };
}
