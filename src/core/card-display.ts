import { competitionNames } from "./competition-display";
import { rarityRule } from "./card-rarity";
import { nflSeven } from "./nfl-seven";
import type { FantasyCard, FantasyState } from "./fantasy";
export const scoringContext =
  `${competitionNames.SALARY_CAP} and ${competitionNames.OPEN} use rarity multipliers (1.0×–1.5×). Legacy equal-scoring rounds remain 1.0×. Scoring depends on the competition’s saved rules.`;
export const sevenPositions = [
  ...new Set(nflSeven.slots.flatMap((s) => s.positions)),
];
export function cardIdentity(c: {
  id: string;
  tier: string;
  serial: number;
  max_supply: number;
}) {
  return c.tier === "CORE"
    ? `Core instance ${c.id} · unlimited supply`
    : `#${c.serial} / ${c.max_supply.toLocaleString("en-AU")} lifetime cap`;
}
export function collectibleOnly(position: string, sport: string) {
  return sport === "nfl" && !sevenPositions.includes(position);
}
export function collectionPositions(sport: string) {
  return sport === "nfl"
    ? [...sevenPositions, "K"]
    : sport === "afl"
      ? ["DEF", "MID", "RUC", "FWD"]
      : ["GK", "DEF", "MID", "FWD"];
}
export function availability(
  c: Pick<FantasyCard, "status" | "listed" | "position" | "sport"> & {
    availability_reason?: string;
  },
) {
  if (collectibleOnly(c.position, c.sport))
    return "Collectible only in current seven-player competitions. No eligible lineup slot.";
  if (c.listed)
    return "Listed for sale. Cancel the listing before selecting this card.";
  if (c.status === "active") return "";
  return (
    c.availability_reason ??
    (c.status === "retired"
      ? "Roster reports retired. Existing ownership remains unchanged."
      : c.status === "injured"
        ? "Roster reports injured; participation and competition eligibility require confirmation."
        : "Current roster eligibility is unverified. This does not establish injury, retirement or DNP.")
  );
}
export function sevenEligibility(
  c: FantasyCard,
  data: FantasyState,
  competitionId: string,
) {
  const reason = availability(c);
  if (reason) return reason;
  const fixture = data.seven?.fixtures[competitionId]?.find((f) =>
    f.playerIds.includes(c.canonical_player_id ?? c.player_id),
  );
  if (!fixture)
    return "No mapped fixture for this round. A bye is not assumed.";
  if (
    !fixture.scheduledAt ||
    (fixture.status && fixture.status !== "scheduled")
  )
    return "Fixture time or schedule is under review.";
  if (
    Date.parse(fixture.scheduledAt) <=
    Date.parse(data.seven?.server_time ?? new Date().toISOString())
  )
    return "Game started: cannot add this player.";
  return "";
}
export function multiplierLabel(tier: string) {
  return `${rarityRule(tier).multiplierTenths / 10}× · ${competitionNames.SALARY_CAP} / ${competitionNames.OPEN}`;
}
export function probabilityLabel(p: number) {
  if (p === 1) return "100%";
  if (p === 0) return "0%";
  if (p > 0.99999) return ">99.999%";
  if (p < 0.00001) return "<0.001%";
  return `${(p * 100).toFixed(3)}%`;
}
