import type { FantasyCard, FantasyCompetition, FantasyState } from "./fantasy";

// These are the existing Docked football rules, not an imported FPL squad.
export const footballFormation = { GK: 1, DEF: 4, MID: 4, FWD: 2 };
export const fantasySports = [
  { id: "football", name: "Football", ready: true },
  { id: "afl", name: "AFL", ready: false },
  { id: "nfl", name: "NFL", ready: false },
  { id: "basketball", name: "Basketball", ready: false },
] as const;
export function formationFor(
  comp?: FantasyCompetition,
): Record<string, number> | null {
  if (!comp || (comp.sport && comp.sport !== "football")) return null;
  const positions = comp.rules.positions ?? footballFormation;
  if (!positions || typeof positions !== "object" || Array.isArray(positions))
    return null;
  const entries = Object.entries(positions);
  if (
    !entries.length ||
    entries.some(
      ([p, n]) =>
        !Object.hasOwn(footballFormation, p) ||
        typeof n !== "number" ||
        !Number.isInteger(n) ||
        n < 0 ||
        n > 11,
    ) ||
    entries.reduce((n, [, v]) => n + Number(v), 0) !== 11
  )
    return null;
  return Object.fromEntries(entries) as Record<string, number>;
}
export function lineupIssues(
  cards: FantasyCard[],
  ids: string[],
  comp: FantasyCompetition,
  owner: string,
) {
  const formation = formationFor(comp);
  if (!formation) return ["This sport’s approved formation is unavailable."];
  const picked = ids.map((id) => cards.find((c) => c.id === id));
  const issues: string[] = [];
  if (ids.length !== 11)
    issues.push(`Select 11 players (${ids.length} selected).`);
  if (new Set(ids).size !== ids.length)
    issues.push("Each card can appear only once.");
  if (
    picked.some(
      (c) =>
        !c ||
        c.owner_id !== owner ||
        c.sport !== (comp.sport ?? "football") ||
        c.season !== comp.season ||
        (Array.isArray(comp.rules.tiers) &&
          !comp.rules.tiers.includes(c.tier)) ||
        ["retired", "delisted"].includes(c.status),
    )
  )
    issues.push("Use owned, eligible cards from this sport and season.");
  if (
    !comp.rules.duplicates &&
    new Set(picked.map((c) => c?.player_id)).size !== picked.length
  )
    issues.push("Only one card per player is allowed.");
  for (const [position, count] of Object.entries(formation))
    if (picked.filter((c) => c?.position === position).length !== count)
      issues.push(`${position}: select ${count}.`);
  for (const [tier, max] of Object.entries(
    (comp.rules.tier_max ?? {}) as Record<string, number>,
  ))
    if (picked.filter((c) => c?.tier === tier).length > max)
      issues.push(`${tier}: maximum ${max}.`);
  if (
    picked.filter((c) => c?.tier === "CORE").length <
    Number(comp.rules.core_min ?? 0)
  )
    issues.push(`At least ${comp.rules.core_min} CORE cards required.`);
  if (
    picked.filter((c) => c?.kind === "first_year").length <
    Number(comp.rules.first_year_min ?? 0)
  )
    issues.push(
      `At least ${comp.rules.first_year_min} First Year cards required.`,
    );
  return issues;
}
export function eligibleForPosition(
  card: FantasyCard,
  position: string,
  comp: FantasyCompetition,
  owner: string,
  selected: FantasyCard[],
  replacing?: string,
) {
  return (
    card.owner_id === owner &&
    card.position === position &&
    card.sport === (comp.sport ?? "football") &&
    card.season === comp.season &&
    (!Array.isArray(comp.rules.tiers) ||
      comp.rules.tiers.includes(card.tier)) &&
    !["retired", "delisted"].includes(card.status) &&
    !selected.some(
      (c) =>
        c.id !== replacing &&
        (c.id === card.id ||
          (!comp.rules.duplicates && c.player_id === card.player_id)),
    )
  );
}
export function playRounds(state: FantasyState, sport: string, now: number) {
  const rounds = state.competitions.filter(
    (c) => (c.sport ?? "football") === sport,
  );
  const current = rounds
    .filter((c) => Date.parse(c.locks_at) <= now)
    .sort((a, b) => Date.parse(b.locks_at) - Date.parse(a.locks_at))[0];
  const next = rounds
    .filter(
      (c) =>
        !c.scored_at &&
        Date.parse(c.locks_at) > now &&
        (!c.opens_at || Date.parse(c.opens_at) <= now),
    )
    .sort((a, b) => Date.parse(a.locks_at) - Date.parse(b.locks_at))[0];
  return { rounds, current, next };
}
export function countdown(until: string, now: number) {
  const seconds = Math.max(0, Math.floor((Date.parse(until) - now) / 1000));
  if (!Number.isFinite(seconds)) return "Time unavailable";
  if (!seconds) return "Deadline reached";
  const days = Math.floor(seconds / 86400),
    hours = Math.floor((seconds % 86400) / 3600),
    mins = Math.floor((seconds % 3600) / 60);
  return `${days ? `${days}d ` : ""}${hours}h ${mins}m ${seconds % 60}s`;
}
export const localTime = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

/** Rebuild only from immutable entry/score data, never from today's ownership selection. */
export function historicalCards(state: FantasyState, competitionId: string) {
  return (
    state.round_details?.find((r) => r.competition_id === competitionId)
      ?.cards ?? []
  );
}
export function footballBreakdown(
  stats: Record<string, number>,
  position: string,
  rules: Record<string, unknown>,
): { label: string; points: number }[] | null {
  const keys = [
    "minutes",
    "goals",
    "assists",
    "conceded",
    "saves",
    "yellow",
    "red",
    "own_goals",
  ];
  if (keys.some((k) => !Number.isFinite(stats[k]))) return null;
  const goal = rules.goal as Record<string, number>,
    clean = rules.clean_sheet as Record<string, number>;
  const scalar = [
    "appearance",
    "sixty_minutes",
    "assist",
    "save_group",
    "save_points",
    "yellow",
    "red",
    "own_goal",
    "conceded_group",
    "conceded_points",
  ];
  if (
    scalar.some((k) => !Number.isFinite(rules[k])) ||
    !Number.isFinite(goal?.[position]) ||
    !Number.isFinite(clean?.[position]) ||
    Number(rules.save_group) <= 0 ||
    Number(rules.conceded_group) <= 0
  )
    return null;
  if (stats.minutes === 0) return [{ label: "Did not play", points: 0 }];
  return [
    { label: "Appearance", points: Number(rules.appearance) },
    {
      label: "60+ minutes",
      points: stats.minutes >= 60 ? Number(rules.sixty_minutes) : 0,
    },
    { label: "Goals", points: stats.goals * goal[position] },
    { label: "Assists", points: stats.assists * Number(rules.assist) },
    {
      label: "Clean sheet",
      points: stats.minutes >= 60 && stats.conceded === 0 ? clean[position] : 0,
    },
    {
      label: "Saves",
      points:
        position === "GK"
          ? Math.floor(stats.saves / Number(rules.save_group)) *
            Number(rules.save_points)
          : 0,
    },
    {
      label: "Goals conceded",
      points: ["GK", "DEF"].includes(position)
        ? Math.floor(stats.conceded / Number(rules.conceded_group)) *
          Number(rules.conceded_points)
        : 0,
    },
    { label: "Yellow cards", points: stats.yellow * Number(rules.yellow) },
    { label: "Red cards", points: stats.red * Number(rules.red) },
    { label: "Own goals", points: stats.own_goals * Number(rules.own_goal) },
  ];
}
