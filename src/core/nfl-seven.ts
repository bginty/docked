import configuration from "../../config/nfl-seven-v1.json";
import { rarityRule, type Rarity } from "./card-rarity";
import { nflRarityRules } from "./scoring-v1";
export const nflSeven = configuration;
export const sevenTransferNotice =
  "Salary Cap and Open reserve cards in submitted, unlocked slots: replace the card in each team, or withdraw before entries close, before transferring. After kickoff, a transfer preserves the original team's locked points; the buyer cannot add that started player to the same round. Drafts do not reserve cards. Older competitions keep their original transfer restrictions.";
export type NflMode = "SALARY_CAP" | "OPEN";
export type SlotSelection = { slot: string; card: string };
/** An unsent draft cannot disguise which submitted card actually locked. */
export function restoreLockedSelections(
  picks: SlotSelection[],
  locks: SlotSelection[],
) {
  const fixed = new Map(locks.map((p) => [p.slot, p]));
  return [...picks.filter((p) => !fixed.has(p.slot)), ...fixed.values()];
}
export type SevenCard = {
  id: string;
  player_id: string;
  canonical_player_id?: string;
  tier: string;
  position: string;
  status: string;
  listed: boolean;
};
export function sevenRules() {
  const rules = nflRarityRules();
  return {
    ...rules,
    version: "docked-nfl-seven-rolling-test-v1",
    slots: structuredClone(nflSeven.slots),
    policy: [
      ...rules.policy,
      "New entries close at the first included kickoff. Each selected slot locks permanently at its player's kickoff; later transfers preserve that scoring entitlement.",
    ],
  };
}
export function salary(tier: string, config = nflSeven) {
  rarityRule(tier);
  return config.salaries[tier as Rarity];
}
/** Advisory UI validation; trusted inventory, fixture time and constraints are rechecked in SQL. */
export function sevenIssues(
  mode: NflMode,
  picks: SlotSelection[],
  inventory: SevenCard[],
  complete = false,
  config = nflSeven,
) {
  const errors: string[] = [],
    players = new Set<string>(),
    slots = new Set<string>();
  let total = 0;
  for (const pick of picks) {
    const slot = config.slots.find((s) => s.id === pick.slot),
      card = inventory.find((c) => c.id === pick.card);
    if (!slot || slots.has(pick.slot)) errors.push("Invalid or repeated slot.");
    slots.add(pick.slot);
    if (!card) {
      errors.push("A selected card is no longer in your collection.");
      continue;
    }
    if (!slot?.positions.includes(card.position))
      errors.push(
        `${pick.slot} requires ${slot?.positions.join(" / ") ?? "an eligible position"}.`,
      );
    const player = card.canonical_player_id ?? card.player_id;
    if (players.has(player))
      errors.push("Select only one card of each player.");
    players.add(player);
    if (card.status !== "active" || card.listed)
      errors.push("A selected card is unavailable or listed for sale.");
    total += salary(card.tier, config);
  }
  if (complete && picks.length !== config.slots.length)
    errors.push("Fill all seven positions before entering.");
  if (mode === "SALARY_CAP" && total > config.salaryCap)
    errors.push(
      `Salary ${total.toLocaleString("en-AU")} exceeds the ${config.salaryCap.toLocaleString("en-AU")} cap.`,
    );
  return {
    errors: [...new Set(errors)],
    total,
    remaining: config.salaryCap - total,
  };
}
