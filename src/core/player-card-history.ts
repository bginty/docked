import { scorePlayer, type Rules } from "./scoring-v1";
export { formatBasePoints, adjustedCardPoints } from "./card-score-display";

/** Narrow read model: no member, entry, ownership or wallet fields. */
export type PlayerHistorySource = {
  season: string;
  week: number;
  fixture: string;
  scheduledAt: string;
  revision: number;
  observedAt: string | null;
  final: boolean;
  visible: boolean;
  position: string;
  rules: Rules;
  source: { status: string; availability: string; stats: unknown } | null;
};
export type PlayerHistory = {
  season: string | null;
  seasons: string[];
  averageBase: number | null;
  bestBase: number | null;
  played: number;
  rows: {
    week: number;
    base: number | null;
    status: string;
    updatedAt: string | null;
  }[];
};
export function playerHistory(
  input: PlayerHistorySource[],
  requested?: string,
): PlayerHistory {
  const seasons = [...new Set(input.map((r) => r.season))].sort().reverse();
  const season = requested ?? seasons[0] ?? null;
  // Traditional and All-Star share fixtures. A newer correction wins, never a sum of both modes.
  const fixtures = new Map<string, PlayerHistorySource>();
  for (const r of input.filter((r) => r.season === season)) {
    const old = fixtures.get(r.fixture);
    if (
      !old ||
      (Date.parse(r.observedAt ?? "") || 0) >
        (Date.parse(old.observedAt ?? "") || 0) ||
      (r.observedAt === old.observedAt && r.revision > old.revision)
    )
      fixtures.set(r.fixture, r);
    // A review hold in either competition must not be bypassed through its other mode.
    if (old && (!old.visible || !r.visible))
      fixtures.set(r.fixture, { ...fixtures.get(r.fixture)!, visible: false });
  }
  const weeks = new Map<
    number,
    {
      base: number | null;
      status: string;
      played: boolean;
      at: string | null;
    }[]
  >();
  for (const r of fixtures.values()) {
    const s = r.source;
    let base: number | null = null,
      status = "Pending",
      played = false;
    if (!r.visible) status = "Under review";
    else if (!s) status = "Missing data";
    else if (s.status === "completed" && s.availability !== "pending") {
      if (s.availability === "confirmed-dnp" || s.availability === "bye") {
        base = 0;
        status = s.availability === "bye" ? "Bye" : "DNP";
      } else if (s.availability === "complete") {
        // Exactly the scoring service's base calculator; never recalculate saved entry results.
        base = scorePlayer(r.rules, r.position, s.stats).centipoints;
        status = r.final ? "Final" : "Provisional";
        played = true;
      }
    }
    weeks.set(r.week, [
      ...(weeks.get(r.week) ?? []),
      { base, status, played, at: r.observedAt },
    ]);
  }
  const games = [...weeks.values()]
    .flat()
    .filter((r) => r.played && r.base !== null);
  const rows = [...weeks.entries()]
    .map(([week, values]) => ({
      week,
      base: values.every((v) => v.base !== null)
        ? values.reduce((n, v) => n + v.base!, 0)
        : null,
      status:
        values.find((v) => v.base === null)?.status ??
        (values.some((v) => v.status === "Provisional")
          ? "Provisional"
          : values.every((v) => !v.played)
            ? values[0].status
            : "Final"),
      updatedAt:
        values
          .map((v) => v.at)
          .filter((v): v is string => !!v)
          .sort()
          .at(-1) ?? null,
    }))
    .sort((a, b) => b.week - a.week);
  return {
    season,
    seasons,
    rows,
    played: games.length,
    averageBase: games.length
      ? games.reduce((n, r) => n + r.base!, 0) / games.length
      : null,
    bestBase: games.length ? Math.max(...games.map((r) => r.base!)) : null,
  };
}
