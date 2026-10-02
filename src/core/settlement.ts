import type { Rules } from "./pricing";
import { hash } from "./pricing";
export type Result = {
  source: string;
  sourceEventId: string;
  revision: string;
  authorised: boolean;
  eventId: string;
  status:
    | "final"
    | "cancelled"
    | "postponed"
    | "rescheduled"
    | "abandoned"
    | "disputed"
    | "manual_review"
    | "void";
  rules: Rules;
  scores: Record<string, number>;
  observedAt: string;
  scheduledStartAt?: string;
  supersedesRevision?: string;
  // A void is an explicit reviewed settlement instruction, never inferred
  // from a postponed/cancelled fixture or missing score.
  reason?: string;
  settlementBasis?: string;
};
export function settle(
  rules: Rules,
  selection: string,
  result: Result,
): "won" | "lost" | "void" | "pending" | "disputed" {
  if (!result.authorised || result.eventId !== rules.eventId) return "pending";
  if (
    !result.source.trim() ||
    !result.sourceEventId.trim() ||
    !result.revision.trim() ||
    !Number.isFinite(Date.parse(result.observedAt))
  )
    return "disputed";
  if (!rules.outcomes.includes(selection) || hash(result.rules) !== hash(rules))
    return "disputed";
  if (result.status === "void")
    return result.reason?.trim() && result.settlementBasis?.trim()
      ? "void"
      : "disputed";
  if (result.status !== "final")
    return ["disputed", "manual_review"].includes(result.status)
      ? "disputed"
      : "pending";
  if (
    rules.participants.length !== 2 ||
    Object.keys(result.scores).sort().join("\u0000") !==
      [...rules.participants].sort().join("\u0000") ||
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
