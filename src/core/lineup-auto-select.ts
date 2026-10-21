import {
  nflSeven,
  salary,
  fitsSlot,
  type NflMode,
  type SevenCard,
  type SlotSelection,
} from "./nfl-seven";
import type { PlayerHistory } from "./player-card-history";

export type PlayerRank = {
  average: number;
  appearances: number;
  throughWeek: number;
};
/** Centipoints, verified final appearances only. Unknown/DNP is not a zero observation. */
export function historicalRank(
  history: PlayerHistory,
  beforeWeek: number,
  beforeTime: number,
): PlayerRank | null {
  const games = (history.games ?? [])
    .filter(
      (g) =>
        g.played &&
        g.base !== null &&
        g.gameStatus === "final" &&
        !g.incomplete &&
        !g.missing.length &&
        g.week < beforeWeek &&
        g.kickoff !== null &&
        Date.parse(g.kickoff) < beforeTime,
    )
    .sort((a, b) => b.week - a.week || b.id.localeCompare(a.id))
    .slice(0, 5);
  return games.length
    ? {
        average: Math.round(
          games.reduce((n, g) => n + g.base!, 0) / games.length,
        ),
        appearances: games.length,
        throughWeek: Math.max(...games.map((g) => g.week)),
      }
    : null;
}
export type RankedCard = SevenCard & { value: number | null };
type Option = {
  picks: SlotSelection[];
  cost: number;
  value: number;
  known: number;
  mask: number;
};
const keyOf = (p: Option) =>
  p.picks
    .map((v) => `${v.slot}:${v.card}`)
    .sort()
    .join("|");
function better(a: Option, b: Option) {
  return (
    a.picks.length > b.picks.length ||
    (a.picks.length === b.picks.length &&
      (a.known > b.known ||
        (a.known === b.known &&
          (a.value > b.value ||
            (a.value === b.value &&
              (a.cost < b.cost ||
                (a.cost === b.cost && keyOf(a) < keyOf(b))))))))
  );
}
/** Exact multiple-choice DP: one card per player, each slot once, no greedy FLEX/cap trap.
 * Inputs are already eligibility-filtered. Unknown performance remains explicitly unranked.
 * Cardinality, known observations, historical value, lower cost, stable IDs break ties. */
export function autoSelect(
  cards: RankedCard[],
  mode: NflMode,
  fixed: SlotSelection[] = [],
  config = nflSeven,
) {
  if (config.slots.length > 30) throw Error("Unsupported lineup size");
  // Equivalent unfilled positions are symmetric. Explore only the first open
  // slot in each eligibility group (6/8/6/2 AFL), not all 2^22 permutations.
  // Locked positions remain fixed and FLEX has its own eligibility signature.
  const signatures = config.slots.map((s) => [...s.positions].sort().join("|"));
  const fixedPlayers = new Set<string>();
  const seed: Option = {
    picks: [...fixed],
    cost: 0,
    value: 0,
    known: 0,
    mask: 0,
  };
  for (const p of fixed) {
    const c = cards.find((c) => c.id === p.card),
      index = config.slots.findIndex((s) => s.id === p.slot);
    if (
      !c ||
      index < 0 ||
      !fitsSlot(c, config.slots[index].positions) ||
      seed.mask & (1 << index) ||
      fixedPlayers.has(c.canonical_player_id ?? c.player_id)
    )
      throw Error("Invalid locked selections");
    fixedPlayers.add(c.canonical_player_id ?? c.player_id);
    seed.mask |= 1 << index;
    seed.cost += salary(c.tier, config);
  }
  const cap = mode === "SALARY_CAP" ? config.salaryCap : Infinity;
  if (seed.cost > cap)
    throw Error("Locked lineup exceeds the configured salary cap");
  const groups = new Map<string, RankedCard[]>();
  for (const c of [...cards].sort((a, b) => a.id.localeCompare(b.id))) {
    const id = c.canonical_player_id ?? c.player_id;
    if (
      fixedPlayers.has(id) ||
      c.listed ||
      c.status !== "active" ||
      (c.sport && c.sport !== config.sport)
    )
      continue;
    // Multiple instances of the same player/tier cannot both enter. Keep the
    // stable first ID when position, cost and evidence are identical.
    if (
      groups
        .get(id)
        ?.some(
          (v) =>
            v.tier === c.tier &&
            v.position === c.position &&
            JSON.stringify(v.eligible_positions) ===
              JSON.stringify(c.eligible_positions) &&
            v.value === c.value,
        )
    )
      continue;
    groups.set(id, [...(groups.get(id) ?? []), c]);
  }
  let states = new Map<string, Option>([
    [`${seed.mask}:${mode === "OPEN" ? 0 : seed.cost}`, seed],
  ]);
  for (const variants of groups.values()) {
    const next = new Map(states);
    for (const prev of states.values())
      for (const c of variants)
        for (let i = 0; i < config.slots.length; i++) {
          if (
            prev.mask & (1 << i) ||
            !fitsSlot(c, config.slots[i].positions) ||
            signatures.some(
              (signature, earlier) =>
                earlier < i &&
                signature === signatures[i] &&
                !(prev.mask & (1 << earlier)),
            )
          )
            continue;
          const cost = prev.cost + salary(c.tier, config);
          if (cost > cap) continue;
          const candidate: Option = {
            picks: [...prev.picks, { slot: config.slots[i].id, card: c.id }],
            cost,
            value: prev.value + (c.value ?? 0),
            known: prev.known + Number(c.value !== null),
            mask: prev.mask | (1 << i),
          };
          const k = `${candidate.mask}:${mode === "OPEN" ? 0 : cost}`,
            old = next.get(k);
          if (!old || better(candidate, old)) next.set(k, candidate);
        }
    states = next;
  }
  const best = [...states.values()].reduce(
    (a, b) => (better(b, a) ? b : a),
    seed,
  );
  return {
    picks: best.picks,
    cost: best.cost,
    missing: config.slots
      .filter((s) => !best.picks.some((p) => p.slot === s.id))
      .map((s) => s.id),
    unranked: best.picks
      .filter(
        (p) =>
          !fixed.some((f) => f.slot === p.slot) &&
          cards.find((c) => c.id === p.card)?.value === null,
      )
      .map((p) => p.card),
  };
}
