import type { FantasyState } from "./fantasy";
import { autoSelect, type PlayerRank } from "./lineup-auto-select";
import { sevenEligibility } from "./card-display";
import { rarityRule } from "./card-rarity";
import { fitsSlot, salary, type SlotSelection } from "./nfl-seven";
/** Runs on the authenticated server snapshot, never on another account's pool. */
export function recommendOwnedLineup(
  data: FantasyState,
  id: string,
  ranks: Record<string, PlayerRank | null>,
  now: number,
  draft?: SlotSelection[],
) {
  const comp = data.competitions.find((c) => c.id === id),
    cfg = data.seven?.configurations[String(comp?.rules.lineup_version)];
  if (
    !comp ||
    !cfg ||
    !data.seven ||
    comp.scored_at ||
    comp.rules.disabled ||
    !["OPEN", "SALARY_CAP"].includes(String(comp.rules.mode))
  )
    throw Error("Competition unavailable");
  const entry = data.seven.entries.find((e) => e.competition_id === id);
  if (
    Date.parse(comp.locks_at) <= now &&
    (!entry || comp.rules.lock_policy === "round-wide-v1")
  )
    throw Error("This round is locked. Your lineup is unchanged.");
  const locked = (entry?.snapshot ?? []).filter(
    (c) =>
      Date.parse(c.kickoff) <= now ||
      data.seven!.locks.some(
        (l) => l.competition_id === id && l.slot === c.slot,
      ),
  );
  const fixed = [
    ...(draft ??
      data.seven.drafts.find((d) => d.competition_id === id)?.selections ??
      entry?.snapshot.map((c) => ({ slot: c.slot, card: c.card_id })) ??
      []),
  ];
  for (const c of locked) {
    const supplied = fixed.find((p) => p.slot === c.slot);
    if (supplied && supplied.card !== c.card_id)
      throw Error(
        `${c.slot} is locked. Refresh your lineup before filling empty positions.`,
      );
    if (!supplied) fixed.push({ slot: c.slot, card: c.card_id });
  }
  const state = {
    ...data,
    seven: { ...data.seven, server_time: new Date(now).toISOString() },
  };
  const eligible = data.seven.inventory.filter(
    (c) =>
      c.owner_id === data.user_id &&
      !sevenEligibility(c, state, id) &&
      (!comp.eligible_player_ids ||
        comp.eligible_player_ids.includes(
          c.canonical_player_id ?? c.player_id,
        )),
  );
  const inventory = new Map(eligible.map((c) => [c.id, c]));
  for (const c of locked)
    inventory.set(c.card_id, {
      ...c,
      id: c.card_id,
      status: "active",
      listed: false,
    });
  for (const pick of fixed) {
    const card = inventory.get(pick.card);
    if (!card)
      throw Error(
        `${pick.slot}: the selected card is no longer eligible or owned. Review it before filling empty positions.`,
      );
  }
  const result = autoSelect(
    [...inventory.values()].map((c) => ({
      ...c,
      value:
        ranks[c.canonical_player_id ?? c.player_id]?.average == null
          ? null
          : Math.round(
              ranks[c.canonical_player_id ?? c.player_id]!.average *
                (c.multiplier ?? rarityRule(c.tier).multiplierTenths / 10),
            ),
    })),
    comp.rules.mode as "OPEN" | "SALARY_CAP",
    fixed,
    cfg,
  );
  const used = new Set(
    result.picks.map((p) => {
      const c = inventory.get(p.card)!;
      return c.canonical_player_id ?? c.player_id;
    }),
  );
  const missingReasons = result.missing.map((slot) => {
    const positions = cfg.slots.find((s) => s.id === slot)!.positions;
    const fitting = eligible.filter((c) => fitsSlot(c, positions));
    const unused = fitting.filter(
      (c) => !used.has(c.canonical_player_id ?? c.player_id),
    );
    const reason = !fitting.length
      ? "No eligible, available owned card fits this position."
      : !unused.length
        ? "The fitting cards repeat players already selected in this lineup."
        : comp.rules.mode === "SALARY_CAP" &&
            unused.every(
              (c) => salary(c.tier, cfg) > cfg.salaryCap - result.cost,
            )
          ? "No remaining fitting card fits the available salary budget."
          : "The available cards cannot complete all empty positions together under the formation and uniqueness rules.";
    return { slot, reason };
  });
  return { ...result, missingReasons };
}
