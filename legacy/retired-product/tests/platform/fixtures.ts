import type { Quote, Rules } from "../../src/core/pricing";
export const now = "2026-10-02T06:00:00.000Z";
export const rules: Rules = {
  eventId: "fictional-event-1",
  competition: "basketball_nba",
  participants: ["Fictional A", "Fictional B"],
  market: "nba_moneyline",
  period: "full_game",
  overtime: true,
  draw: false,
  line: null,
  settlement: "full_game_including_overtime",
  outcomes: ["Fictional A", "Fictional B"],
};
export function quotes(at = now): Quote[] {
  return [
    ["offer", "offer-group", "2.00", "1.85"],
    ["ref-a", "group-a", "1.75", "2.15"],
    ["ref-b", "group-b", "1.75", "2.15"],
  ].map(([bookmaker, operator, a, b]) => ({
    id: bookmaker + at,
    bookmaker,
    operator,
    approved: true,
    rules: structuredClone(rules),
    prices: { "Fictional A": a, "Fictional B": b },
    sourceAt: at,
    snapshotAt: at,
    receivedAt: at,
    suspended: false,
  }));
}
