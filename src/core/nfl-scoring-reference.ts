import { nflPostgameWeights } from "./nfl-postgame-policy";
import { points } from "./scoring-v1";
export function nflScoringReference(savedWeights?: Record<string, number>) {
  const reference: Record<string, number> = nflPostgameWeights;
  return [
    ...new Set([...Object.keys(reference), ...Object.keys(savedWeights ?? {})]),
  ].map((key) => ({
    statistic: key,
    label: key.replaceAll("_", " ").replace(/([a-z])([A-Z])/g, "$1 $2"),
    base: reference[key] === undefined ? null : points(reference[key]),
    saved: savedWeights?.[key] === undefined ? null : points(savedWeights[key]),
    differs: !!savedWeights && reference[key] !== savedWeights[key],
    unit: key.includes("yards") ? "yard" : "event",
  }));
}
