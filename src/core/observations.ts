import { evaluate, strategyV1, type Quote, type Rules } from "./pricing";
export function observePublication(input: {
  rules: Rules;
  startAt: string;
  observedAt: string;
  publishedAt: string;
  selection: string;
  bookmaker: string;
  minimumOdds: string;
  quotes: Quote[];
  resolutionSeconds: number;
}) {
  const at = Date.parse(input.observedAt),
    start = Date.parse(input.startAt);
  if (!Number.isFinite(at) || !Number.isFinite(start) || at >= start)
    return null;
  const result = evaluate(
    {
      rules: input.rules,
      startAt: input.startAt,
      decisionAt: input.observedAt,
      quotes: input.quotes,
    },
    {
      ...strategyV1,
      windowsSeconds: [(start - at) / 1000],
      windowToleranceSeconds: 0,
    },
  );
  const point = result.universe.find(
    (x) => x.selection === input.selection && x.bookmaker === input.bookmaker,
  );
  const offer =
    point && input.quotes.find((q) => q.bookmaker === input.bookmaker);
  if (!point || !offer) return null;
  const qualifies = result.eligibleCandidates.some(
    (c) =>
      c.selection === input.selection &&
      c.offer.bookmaker === input.bookmaker &&
      Number(c.offer.prices[c.selection]) >= Number(input.minimumOdds),
  );
  const elapsed = (at - Date.parse(input.publishedAt)) / 1000;
  // A five-minute source cannot manufacture one-minute measurements. Late samples stay missing.
  const targets = [1, 5, 15, 60].filter(
    (m) =>
      input.resolutionSeconds <= m * 60 &&
      elapsed >= m * 60 &&
      elapsed <= m * 60 + 60,
  );
  return {
    odds: offer.prices[input.selection],
    probability: point.probability,
    sourceAt: offer.sourceAt,
    referenceSourceAt: point.referenceSourceAt,
    qualifies,
    targets,
    sourceIds: point.referenceIds,
  };
}
