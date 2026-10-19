import type { FantasyState } from "./fantasy";
import { autoSelect, type PlayerRank } from "./lineup-auto-select";
import { sevenEligibility } from "./card-display";
import { rarityRule } from "./card-rarity";
import { hasEstablishedTeam } from "./team-continuity";
/** Runs on the authenticated server snapshot, never on another account's pool. */
export function recommendOwnedLineup(
  data: FantasyState,
  id: string,
  ranks: Record<string, PlayerRank | null>,
  now: number,
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
  if (hasEstablishedTeam(data, comp.sport ?? "nfl", String(comp.rules.mode)))
    throw Error(
      "Your team is established. Replace individual players manually.",
    );
  const entry = data.seven.entries.find((e) => e.competition_id === id);
  if (Date.parse(comp.locks_at) <= now && !entry)
    throw Error("New entries closed");
  const locked = (entry?.snapshot ?? []).filter(
    (c) =>
      Date.parse(c.kickoff) <= now ||
      data.seven!.locks.some(
        (l) => l.competition_id === id && l.slot === c.slot,
      ),
  );
  const fixed = locked.map((c) => ({ slot: c.slot, card: c.card_id }));
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
  return autoSelect(
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
}
