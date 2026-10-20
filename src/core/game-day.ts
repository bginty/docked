import type { StandingPlayer, StandingRound, StandingRow } from "./standings";

export const currentPoints = (row?: StandingRow | null) =>
  row?.currentCentipoints ?? row?.centipoints ?? null;
export const currentRank = (row?: StandingRow | null) =>
  row?.currentRank ?? row?.rank ?? null;
export function gameDayPoints(points: number | null | undefined) {
  return points == null
    ? "—"
    : (points / 100).toLocaleString("en-AU", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 2,
      });
}
export function gameDayStatus(
  round: Pick<
    StandingRound,
    "finalised" | "visible" | "fixtures" | "serverTime"
  >,
) {
  if (!round.visible) return "Under review";
  if (round.finalised) return "Final";
  if (!round.fixtures?.length) return "Awaiting schedule";
  return round.fixtures?.length &&
    round.fixtures.every(
      (f) => Date.parse(f.scheduledAt) > (round.serverTime ?? Date.now()),
    )
    ? "Upcoming"
    : "In progress";
}
export function gameDayPlayerStatus(player: StandingPlayer, now: number) {
  if (player.status === "under-review") return "Under review";
  if (player.status === "dnp") return "DNP";
  if (player.status === "bye") return "Bye";
  if (player.completed || player.status === "final") return "Final";
  if (
    player.fixtures?.some((f) =>
      ["postponed", "cancelled"].includes(f.status ?? ""),
    )
  )
    return "Delayed";
  if (
    player.fixtures?.length &&
    player.fixtures.every((f) => Date.parse(f.scheduledAt) > now)
  )
    return "Not started";
  if (
    player.fixtures?.some((f) =>
      ["live", "in_progress"].includes(f.status ?? ""),
    )
  )
    return "Playing";
  return player.centipoints == null ? "Awaiting stats" : "Provisional";
}
