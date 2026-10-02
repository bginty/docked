import type { Rules } from "./pricing";
import { hash } from "./pricing";
export type Result = {
  source: string;
  sourceEventId: string;
  revision: string;
  authorised: boolean;
  eventId: string;
  status: "final" | "cancelled" | "postponed" | "abandoned" | "disputed";
  rules: Rules;
  scores: Record<string, number>;
  observedAt: string;
};
export function settle(
  rules: Rules,
  selection: string,
  result: Result,
): "won" | "lost" | "void" | "pending" | "disputed" {
  if (
    !result.authorised ||
    result.eventId !== rules.eventId ||
    result.status !== "final"
  )
    return result.status === "disputed" ? "disputed" : "pending";
  if (
    !rules.outcomes.includes(selection) ||
    hash(result.rules) !== hash(rules) ||
    rules.participants.some(
      (p) => !Number.isInteger(result.scores[p]) || result.scores[p] < 0,
    )
  )
    return "disputed";
  const [a, b] = rules.participants,
    sa = result.scores[a],
    sb = result.scores[b];
  if (sa === sb && rules.market !== "football_1x2") return "disputed";
  const winner = sa === sb ? "Draw" : sa > sb ? a : b;
  return winner === selection ? "won" : "lost";
}
